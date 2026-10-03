import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { prisma, Prisma } from '@cafeos/db';
import { getSession } from '@/lib/auth';
import { hasRole, hasPermission } from '@/lib/rbac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GST_RATES = [0, 5, 12, 18, 28];

/** A station is now any configured kitchen slug (Outlet.settings.kitchens), so
 *  accept any trimmed, bounded slug — empty/blank collapses to null. */
function cleanStation(v: unknown): string | null {
  const s = String(v ?? '').trim().slice(0, 40);
  return s || null;
}

/**
 * POST /api/dashboard/menu — manage menu items (products).
 *   { action: 'availability', itemId, isAvailable }
 *   { action: 'price', itemId, pricePaise }
 *   { action: 'create', name, pricePaise, gstRate?, station?, categoryId?, description? }
 *   { action: 'update', itemId, name?, pricePaise?, gstRate?, station?, categoryId?, description?, isAvailable? }
 *   { action: 'delete', itemId }
 *   { action: 'category_create', name }
 * Owner/manager only, scoped to the session's outlet.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!hasRole(session, ['owner', 'manager']) && !hasPermission(session, 'menu:view') && !hasPermission(session, 'menu:edit')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  // ---- create a category ----
  if (action === 'category_create') {
    const name = String(body.name ?? '').trim();
    if (!name) return NextResponse.json({ error: 'missing_name' }, { status: 400 });
    const count = await prisma.category.count({ where: { outletId: session.outletId } });
    const sort = typeof body.sort === 'number' && Number.isFinite(body.sort) ? Math.round(body.sort) : count;
    const cat = await prisma.category.create({
      data: { outletId: session.outletId, name, sort },
      select: { id: true, name: true, sort: true },
    });
    return NextResponse.json({ ok: true, category: cat });
  }

  // ---- update / edit category ----
  if (action === 'category_update') {
    const { categoryId, name, sort } = body;
    if (!categoryId) return NextResponse.json({ error: 'missing_category' }, { status: 400 });
    const cat = await prisma.category.findFirst({ where: { id: categoryId, outletId: session.outletId } });
    if (!cat) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    const data: { name?: string; sort?: number } = {};
    if (typeof name === 'string' && name.trim()) data.name = name.trim();
    if (typeof sort === 'number' && Number.isFinite(sort)) data.sort = Math.round(sort);
    const updated = await prisma.category.update({
      where: { id: categoryId },
      data,
      select: { id: true, name: true, sort: true },
    });
    return NextResponse.json({ ok: true, category: updated });
  }

  // ---- delete category ----
  if (action === 'category_delete') {
    const { categoryId } = body;
    if (!categoryId) return NextResponse.json({ error: 'missing_category' }, { status: 400 });
    const cat = await prisma.category.findFirst({ where: { id: categoryId, outletId: session.outletId } });
    if (!cat) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    // Safe unlink: items in this category become Uncategorised so no products or past receipts are lost
    await prisma.menuItem.updateMany({
      where: { categoryId, outletId: session.outletId },
      data: { categoryId: null },
    });
    await prisma.category.delete({ where: { id: categoryId } });
    return NextResponse.json({ ok: true, deleted: categoryId });
  }

  // ---- reorder categories ----
  if (action === 'category_reorder') {
    const { order } = body;
    if (Array.isArray(order)) {
      await Promise.all(
        order.map((catId: string, idx: number) =>
          prisma.category.updateMany({
            where: { id: catId, outletId: session.outletId },
            data: { sort: idx },
          })
        )
      );
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'invalid_order' }, { status: 400 });
  }

  // ---- import menu (JSON / Excel parsed payload) ----
  if (action === 'import_menu') {
    let items = Array.isArray(body.items) ? body.items : [];
    let categories: string[] = Array.isArray(body.categories) ? body.categories.map((c: any) => String(c).trim()).filter(Boolean) : [];
    const mode = body.mode === 'append' ? 'append' : 'replace';

    // If preset is requested and no items provided, load from public/kaawa_menu_parsed.json
    if (items.length === 0 && (body.preset === 'kaawa' || body.preset === 'default')) {
      const presetCandidates = [
        path.resolve(process.cwd(), 'public/kaawa_menu_parsed.json'),
        path.resolve(process.cwd(), '../../public/kaawa_menu_parsed.json'),
        path.resolve(process.cwd(), '../../../public/kaawa_menu_parsed.json'),
      ];
      for (const p of presetCandidates) {
        if (fs.existsSync(p)) {
          try {
            const parsed = JSON.parse(fs.readFileSync(p, 'utf-8'));
            if (Array.isArray(parsed.categories)) categories = parsed.categories;
            if (Array.isArray(parsed.items)) items = parsed.items;
            break;
          } catch (e) {
            console.error('Failed reading preset file:', e);
          }
        }
      }
    }

    if (!items.length) {
      return NextResponse.json({ error: 'no_items_to_import', message: 'No items provided for import.' }, { status: 400 });
    }

    // Filter valid items that have a non-empty name
    const validItems = items.filter((it: any) => it && typeof it.name === 'string' && it.name.trim().length > 0);
    if (!validItems.length) {
      return NextResponse.json({ error: 'no_valid_items', message: 'None of the items had a valid product name.' }, { status: 400 });
    }

    // Collect all category names if not explicitly specified
    if (!categories.length) {
      const seen = new Set<string>();
      for (const it of validItems) {
        const cat = String(it.category || '').trim();
        if (cat && !seen.has(cat.toLowerCase())) {
          seen.add(cat.toLowerCase());
          categories.push(cat);
        }
      }
    }

    try {
      if (mode === 'replace') {
        // 1. Decouple past order items to prevent FK violations while preserving historic receipts
        await prisma.orderItem.updateMany({
          where: { item: { outletId: session.outletId } },
          data: { itemId: null },
        });

        // 2. Safely clean up dependent mappings
        await prisma.itemModifierGroup.deleteMany({ where: { item: { outletId: session.outletId } } }).catch(() => {});
        await prisma.comboItem.deleteMany({ where: { item: { outletId: session.outletId } } }).catch(() => {});
        await prisma.recipe.deleteMany({ where: { item: { outletId: session.outletId } } }).catch(() => {});
        await prisma.itemSalesRollup.deleteMany({ where: { item: { outletId: session.outletId } } }).catch(() => {});
        await prisma.modifier.deleteMany({ where: { group: { outletId: session.outletId } } }).catch(() => {});
        await prisma.modifierGroup.deleteMany({ where: { outletId: session.outletId } }).catch(() => {});

        // 3. Delete existing menu items
        await prisma.menuItem.deleteMany({ where: { outletId: session.outletId } });

        // 4. Delete existing categories
        await prisma.category.deleteMany({ where: { outletId: session.outletId } });
      }

      // 5. Establish category map (name.toLowerCase() -> id)
      const catMap = new Map<string, string>();
      if (mode === 'append') {
        const existingCats = await prisma.category.findMany({
          where: { outletId: session.outletId },
          select: { id: true, name: true },
        });
        existingCats.forEach((c) => catMap.set(c.name.trim().toLowerCase(), c.id));
      }

      let currentSort = catMap.size;
      for (const catName of categories) {
        const trimmed = catName.trim();
        if (!trimmed) continue;
        if (!catMap.has(trimmed.toLowerCase())) {
          const createdCat = await prisma.category.create({
            data: {
              outletId: session.outletId,
              name: trimmed,
              sort: currentSort++,
            },
            select: { id: true, name: true },
          });
          catMap.set(trimmed.toLowerCase(), createdCat.id);
        }
      }

      // 6. Insert all items
      let insertedCount = 0;
      for (const it of validItems) {
        const rawCat = String(it.category || '').trim();
        let catId: string | null = null;
        if (rawCat) {
          if (!catMap.has(rawCat.toLowerCase())) {
            const newCat = await prisma.category.create({
              data: {
                outletId: session.outletId,
                name: rawCat,
                sort: currentSort++,
              },
              select: { id: true },
            });
            catMap.set(rawCat.toLowerCase(), newCat.id);
            catId = newCat.id;
          } else {
            catId = catMap.get(rawCat.toLowerCase()) || null;
          }
        }

        // Calculate price in paise
        let pricePaise = 0;
        if (it.pricePaise !== undefined && it.pricePaise !== null && !isNaN(Number(it.pricePaise))) {
          pricePaise = Math.round(Number(it.pricePaise));
        } else if (it.price !== undefined && it.price !== null && !isNaN(Number(it.price))) {
          pricePaise = Math.round(Number(it.price) * 100);
        }
        if (!Number.isFinite(pricePaise) || pricePaise < 0) pricePaise = 0;

        // GST rate
        let gstRate = 5.0;
        if (it.gstRate !== undefined && it.gstRate !== null) {
          const r = Number(it.gstRate);
          if (Number.isFinite(r) && r >= 0 && r <= 100) gstRate = r;
        }

        // Tags parsing
        let tags: string[] = [];
        if (Array.isArray(it.tags)) {
          tags = it.tags.map((t: any) => String(t).trim()).filter(Boolean);
        } else if (typeof it.tags === 'string' && it.tags.trim()) {
          tags = it.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
        }

        await prisma.menuItem.create({
          data: {
            outletId: session.outletId,
            categoryId: catId,
            name: String(it.name).trim(),
            pricePaise,
            gstRate: new Prisma.Decimal(gstRate),
            hsnCode: it.hsnCode ? String(it.hsnCode).trim() : '2106',
            station: cleanStation(it.station),
            isAvailable: it.isAvailable !== undefined ? (it.isAvailable === true || it.isAvailable === 'true' || it.isAvailable === 1 || it.isAvailable === '1') : true,
            tags,
            description: it.description ? String(it.description).trim() : null,
          },
        });
        insertedCount++;
      }

      // 7. Kitchen station auto-registration in outlet.settings
      try {
        const outlet = await prisma.outlet.findUnique({
          where: { id: session.outletId },
          select: { settings: true },
        });
        const currentSettings = (outlet?.settings as Record<string, any>) || {};
        let kitchens = Array.isArray(currentSettings.kitchens) ? [...currentSettings.kitchens] : [];
        let kitchensModified = false;

        const detectedStations = new Set<string>();
        validItems.forEach((it: any) => {
          if (it.station && typeof it.station === 'string') {
            detectedStations.add(it.station.trim().toUpperCase());
          }
        });

        if (detectedStations.has('P1') && !kitchens.some((k) => k.id?.toLowerCase() === 'p1')) {
          kitchens.push({ id: 'p1', name: 'P1 · Tea & Beverages', sort: 0, color: '#d9a93a' });
          kitchensModified = true;
        }
        if (detectedStations.has('P2') && !kitchens.some((k) => k.id?.toLowerCase() === 'p2')) {
          kitchens.push({ id: 'p2', name: 'P2 · Food & Snacks', sort: 1, color: '#c3492f' });
          kitchensModified = true;
        }
        for (const st of detectedStations) {
          if (st !== 'P1' && st !== 'P2') {
            const slug = st.toLowerCase().replace(/[^a-z0-9_-]/g, '');
            if (slug && !kitchens.some((k) => k.id?.toLowerCase() === slug)) {
              kitchens.push({ id: slug, name: st, sort: kitchens.length, color: '#4f46e5' });
              kitchensModified = true;
            }
          }
        }

        if (kitchensModified) {
          await prisma.outlet.update({
            where: { id: session.outletId },
            data: {
              settings: {
                ...currentSettings,
                kitchens,
              },
            },
          });
        }
      } catch (stErr) {
        console.warn('Could not auto-register kitchen stations:', stErr);
      }

      return NextResponse.json({
        ok: true,
        count: insertedCount,
        categoriesCount: catMap.size,
        mode,
      });
    } catch (err: any) {
      console.error('[MENU:IMPORT] Error importing menu:', err);
      return NextResponse.json({
        error: 'import_failed',
        message: err?.message || 'Failed to import menu data.',
      }, { status: 500 });
    }
  }

  // ---- create a new product ----
  if (action === 'create') {
    const name = String(body.name ?? '').trim();
    if (!name) return NextResponse.json({ error: 'missing_name' }, { status: 400 });
    const pricePaise = Math.round(Number(body.pricePaise));
    if (!Number.isFinite(pricePaise) || pricePaise < 0) return NextResponse.json({ error: 'invalid_price' }, { status: 400 });
    
    // Support custom rates
    let gstRate = 5.0;
    if (body.gstRate !== undefined) {
      const rate = Number(body.gstRate);
      if (Number.isFinite(rate) && rate >= 0 && rate <= 100) {
        gstRate = rate;
      }
    }

    // verify category ownership when provided
    let categoryId: string | null = null;
    if (body.categoryId) {
      const cat = await prisma.category.findFirst({ where: { id: body.categoryId, outletId: session.outletId }, select: { id: true } });
      if (!cat) return NextResponse.json({ error: 'bad_category' }, { status: 400 });
      categoryId = cat.id;
    }

    const created = await prisma.menuItem.create({
      data: {
        outletId: session.outletId,
        name,
        pricePaise,
        gstRate: new Prisma.Decimal(gstRate),
        hsnCode: body.hsnCode ? String(body.hsnCode).trim() : null,
        station: cleanStation(body.station),
        categoryId,
        description: body.description ? String(body.description).trim() : null,
        isAvailable: body.isAvailable !== undefined ? !!body.isAvailable : true,
        tags: Array.isArray(body.tags) ? body.tags.map((t: any) => String(t).trim()) : [],
      },
      select: { id: true, name: true },
    });
    return NextResponse.json({ ok: true, item: created });
  }

  const { itemId } = body;
  if (!itemId) return NextResponse.json({ error: 'missing_item' }, { status: 400 });

  // ownership guard for all item-scoped actions
  const item = await prisma.menuItem.findFirst({ where: { id: itemId, outletId: session.outletId }, select: { id: true } });
  if (!item) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  if (action === 'availability') {
    const updated = await prisma.menuItem.update({ where: { id: itemId }, data: { isAvailable: !!body.isAvailable }, select: { id: true, isAvailable: true } });
    return NextResponse.json({ ok: true, item: updated });
  }

  if (action === 'price') {
    const pricePaise = Math.round(Number(body.pricePaise));
    if (!Number.isFinite(pricePaise) || pricePaise < 0) return NextResponse.json({ error: 'invalid_price' }, { status: 400 });
    const updated = await prisma.menuItem.update({ where: { id: itemId }, data: { pricePaise }, select: { id: true, pricePaise: true } });
    return NextResponse.json({ ok: true, item: updated });
  }

  // ---- full customize update ----
  if (action === 'update') {
    const data: Prisma.MenuItemUpdateInput = {};
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
    if (body.pricePaise !== undefined) {
      const pricePaise = Math.round(Number(body.pricePaise));
      if (!Number.isFinite(pricePaise) || pricePaise < 0) return NextResponse.json({ error: 'invalid_price' }, { status: 400 });
      data.pricePaise = pricePaise;
    }
    
    // Support custom rates
    if (body.gstRate !== undefined) {
      const rate = Number(body.gstRate);
      if (Number.isFinite(rate) && rate >= 0 && rate <= 100) {
        data.gstRate = new Prisma.Decimal(rate);
      }
    }
    
    if (body.hsnCode !== undefined) {
      data.hsnCode = body.hsnCode ? String(body.hsnCode).trim() : null;
    }
    
    if (body.station !== undefined) data.station = cleanStation(body.station);
    if (body.description !== undefined) data.description = body.description ? String(body.description).trim() : null;
    if (body.isAvailable !== undefined) data.isAvailable = !!body.isAvailable;
    if (body.tags !== undefined && Array.isArray(body.tags)) {
      data.tags = body.tags.map((t: any) => String(t).trim());
    }
    if (body.categoryId !== undefined) {
      if (body.categoryId) {
        const cat = await prisma.category.findFirst({ where: { id: body.categoryId, outletId: session.outletId }, select: { id: true } });
        if (!cat) return NextResponse.json({ error: 'bad_category' }, { status: 400 });
        data.category = { connect: { id: cat.id } };
      } else {
        data.category = { disconnect: true };
      }
    }
    const updated = await prisma.menuItem.update({ where: { id: itemId }, data, select: { id: true, name: true } });
    return NextResponse.json({ ok: true, item: updated });
  }

  // ---- delete (blocked if the item is referenced by past orders) ----
  if (action === 'delete') {
    const orderCount = await prisma.orderItem.count({ where: { itemId } });
    if (orderCount > 0) {
      return NextResponse.json({ error: 'has_orders', message: 'This item appears on past orders — mark it Sold Out instead of deleting.' }, { status: 409 });
    }
    try {
      // Clean up dependent combo items, recipes and rollups if any exist before deleting
      await prisma.comboItem.deleteMany({ where: { itemId } }).catch(() => {});
      await prisma.itemSalesRollup.deleteMany({ where: { itemId } }).catch(() => {});
      await prisma.recipe.deleteMany({ where: { itemId } }).catch(() => {});
      await prisma.menuItem.delete({ where: { id: itemId } });
      return NextResponse.json({ ok: true, deleted: itemId });
    } catch (delErr: any) {
      console.error('[MENU:DELETE] Failed to delete menu item:', delErr);
      return NextResponse.json({
        error: 'delete_failed',
        message: 'Could not delete item. It may be referenced by existing records.',
      }, { status: 409 });
    }
  }

  return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
}
