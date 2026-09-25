import { NextRequest, NextResponse } from 'next/server';
import { prisma, type Prisma } from '@cafeos/db';
import { getSession } from '@/lib/auth';
import { readFloors, readTableFloors, readDisabledTables, type Floor } from '@/lib/floors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Floor & Table Management API
 *
 * GET  /api/dashboard/floor — returns all sections/floors and tables with occupancy & active status
 * POST /api/dashboard/floor — perform section and table operations:
 *   Section actions:
 *     - floor_add: { name, description? }
 *     - floor_update: { floorId, name?, description?, sort?, active? }
 *     - floor_rename: { floorId, name }
 *     - floor_reorder: { floorIds: string[] }
 *     - floor_delete: { floorId, reassignToFloorId? }
 *   Table actions:
 *     - create: { label, seats?, floorId?, active? }
 *     - update: { id, label?, seats?, floorId?, active?, state? }
 *     - assign: { id, floorId }
 *     - regenerate: { id }
 *     - bulk: { count, prefix?, seats?, floorId? }
 *     - delete: { id }
 */

const STATES = ['free', 'seated', 'billed'] as const;

/** short, URL-safe, collision-resistant token for a table QR. */
const newToken = () => crypto.randomUUID().replace(/-/g, '').slice(0, 14);

const cleanLabel = (v: unknown) => String(v ?? '').trim().slice(0, 24);
const cleanDescription = (v: unknown) => {
  if (typeof v !== 'string') return undefined;
  const s = v.trim().slice(0, 150);
  return s.length > 0 ? s : undefined;
};
const cleanSeats = (v: unknown, fallback = 2) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 1 && n <= 50 ? n : fallback;
};

/** Read the outlet's settings JSON (floors + table→floor map live here). */
async function readSettings(outletId: string) {
  const outlet = await prisma.outlet.findUnique({ where: { id: outletId }, select: { settings: true } });
  return (outlet?.settings as Record<string, unknown>) ?? {};
}

/** Merge a partial patch back into Outlet.settings. */
async function writeSettings(outletId: string, current: Record<string, unknown>, patch: Record<string, unknown>) {
  await prisma.outlet.update({
    where: { id: outletId },
    data: { settings: { ...current, ...patch } as Prisma.InputJsonValue },
  });
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const outletId = session.outletId;

  const [outlet, tables, activeOrders] = await Promise.all([
    prisma.outlet.findUnique({ where: { id: outletId }, select: { settings: true } }),
    prisma.tableMap.findMany({
      where: { outletId },
      orderBy: { label: 'asc' },
      select: { id: true, label: true, seats: true, state: true, qrToken: true },
    }),
    prisma.order.findMany({
      where: {
        outletId,
        tableId: { not: null },
        type: 'dine_in',
        status: { in: ['open', 'in_kitchen', 'ready', 'served'] },
        settledAt: null,
      },
      orderBy: { placedAt: 'asc' },
      select: { id: true, tableId: true, number: true, placedAt: true, totalPaise: true, status: true },
    }),
  ]);

  const settings = (outlet?.settings as Record<string, unknown>) ?? {};
  const floors = readFloors(settings);
  const tableFloors = readTableFloors(settings);
  const disabledTables = readDisabledTables(settings);

  const freeTableIds = new Set(tables.filter((t) => t.state === 'free').map((t) => t.id));
  const occMap = new Map<string, { id: string; orderId: string; number: number; sinceMs: number; billPaise: number; orders: number; status: string }>();
  for (const o of activeOrders) {
    if (!o.tableId || freeTableIds.has(o.tableId)) continue;
    const cur = occMap.get(o.tableId);
    if (cur) {
      cur.billPaise += o.totalPaise;
      cur.orders += 1;
      cur.status = o.status;
      cur.id = o.id;
      cur.orderId = o.id;
    } else {
      occMap.set(o.tableId, { id: o.id, orderId: o.id, number: o.number, sinceMs: o.placedAt.getTime(), billPaise: o.totalPaise, orders: 1, status: o.status });
    }
  }

  const roster = tables.map((t) => ({
    id: t.id,
    label: t.label,
    seats: t.seats,
    state: t.state,
    qrToken: t.qrToken,
    floorId: tableFloors[t.id] ?? null,
    active: !disabledTables.includes(t.id),
    activeOrders: occMap.get(t.id)?.orders ?? 0,
    occupancy: occMap.get(t.id) ?? null,
  }));

  return NextResponse.json({
    ok: true,
    floors,
    tables: roster,
    occupied: Object.fromEntries(occMap),
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'owner' && session.role !== 'manager') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const outletId = session.outletId;
  const body = await req.json().catch(() => ({}));
  const audit = (action: string, entityId: string | null, after?: unknown) =>
    prisma.auditLog.create({
      data: { outletId, actorId: session.staffId, action, entity: 'table', entityId, after: (after ?? {}) as Prisma.InputJsonValue },
    }).catch(() => {});

  // ============================ floors / sections ============================
  if (body.action === 'floor_add') {
    const name = cleanLabel(body.name);
    if (!name) return NextResponse.json({ error: 'missing_label', message: 'Enter a section name.' }, { status: 400 });
    const description = cleanDescription(body.description);
    const settings = await readSettings(outletId);
    const floors = readFloors(settings);
    if (floors.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
      return NextResponse.json({ error: 'duplicate_label', message: `Section “${name}” already exists.` }, { status: 409 });
    }
    const floor: Floor = {
      id: crypto.randomUUID(),
      name,
      description,
      sort: floors.length,
      active: true,
    };
    const nextFloors = [...floors, floor];
    await writeSettings(outletId, settings, { floors: nextFloors });
    await audit('floor.created', floor.id, floor);
    return NextResponse.json({ ok: true, floor, floors: nextFloors });
  }

  if (body.action === 'floor_rename' || body.action === 'floor_update') {
    const floorId = String(body.floorId ?? '');
    if (!floorId) return NextResponse.json({ error: 'missing_id' }, { status: 400 });
    const settings = await readSettings(outletId);
    const floors = readFloors(settings);
    const target = floors.find((f) => f.id === floorId);
    if (!target) return NextResponse.json({ error: 'not_found', message: 'Section not found.' }, { status: 404 });

    const nextName = body.name !== undefined ? cleanLabel(body.name) : target.name;
    if (!nextName) return NextResponse.json({ error: 'missing_label', message: 'Enter a section name.' }, { status: 400 });
    if (floors.some((f) => f.id !== floorId && f.name.toLowerCase() === nextName.toLowerCase())) {
      return NextResponse.json({ error: 'duplicate_label', message: `Section “${nextName}” already exists.` }, { status: 409 });
    }

    const nextDesc = body.description !== undefined ? cleanDescription(body.description) : target.description;
    const nextActive = typeof body.active === 'boolean' ? body.active : (target.active !== false);
    const nextSort = typeof body.sort === 'number' && Number.isFinite(body.sort) ? body.sort : target.sort;

    const nextFloors = floors.map((f) =>
      f.id === floorId
        ? { ...f, name: nextName, description: nextDesc, active: nextActive, sort: nextSort }
        : f
    );
    await writeSettings(outletId, settings, { floors: nextFloors });
    await audit('floor.updated', floorId, { name: nextName, description: nextDesc, active: nextActive });
    return NextResponse.json({ ok: true, floors: nextFloors });
  }

  if (body.action === 'floor_reorder') {
    const floorIds = Array.isArray(body.floorIds) ? (body.floorIds as string[]) : [];
    if (!floorIds.length) return NextResponse.json({ error: 'missing_floor_ids' }, { status: 400 });
    const settings = await readSettings(outletId);
    const floors = readFloors(settings);
    const reordered = [...floors].sort((a, b) => {
      const idxA = floorIds.indexOf(a.id);
      const idxB = floorIds.indexOf(b.id);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.sort - b.sort;
    }).map((f, i) => ({ ...f, sort: i }));

    await writeSettings(outletId, settings, { floors: reordered });
    await audit('floor.reordered', null, { order: floorIds });
    return NextResponse.json({ ok: true, floors: reordered });
  }

  if (body.action === 'floor_delete') {
    const floorId = String(body.floorId ?? '');
    if (!floorId) return NextResponse.json({ error: 'missing_id' }, { status: 400 });
    const settings = await readSettings(outletId);
    const floors = readFloors(settings);
    const target = floors.find((f) => f.id === floorId);
    if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const map = readTableFloors(settings);
    const reassignToFloorId = body.reassignToFloorId ? String(body.reassignToFloorId) : '';
    const reassignValid = reassignToFloorId && floors.some((f) => f.id === reassignToFloorId && f.id !== floorId);

    for (const [tid, fid] of Object.entries(map)) {
      if (fid === floorId) {
        if (reassignValid) {
          map[tid] = reassignToFloorId;
        } else {
          delete map[tid];
        }
      }
    }

    const nextFloors = floors.filter((f) => f.id !== floorId);
    await writeSettings(outletId, settings, { floors: nextFloors, tableFloors: map });
    await audit('floor.deleted', floorId, { name: target.name, reassignedTo: reassignValid ? reassignToFloorId : null });
    return NextResponse.json({ ok: true, floors: nextFloors });
  }

  if (body.action === 'assign') {
    const tableId = String(body.id ?? '');
    if (!tableId) return NextResponse.json({ error: 'missing_id' }, { status: 400 });
    const exists = await prisma.tableMap.findFirst({ where: { id: tableId, outletId }, select: { id: true } });
    if (!exists) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    const settings = await readSettings(outletId);
    const map = readTableFloors(settings);
    const floorId = body.floorId ? String(body.floorId) : '';
    if (floorId) map[tableId] = floorId; else delete map[tableId];
    await writeSettings(outletId, settings, { tableFloors: map });
    return NextResponse.json({ ok: true });
  }

  // ============================ tables ============================
  // ----------------------------------------------------------- create
  if (body.action === 'create') {
    const label = cleanLabel(body.label);
    if (!label) return NextResponse.json({ error: 'missing_label', message: 'Enter a table name/number.' }, { status: 400 });
    const clash = await prisma.tableMap.findFirst({ where: { outletId, label }, select: { id: true } });
    if (clash) return NextResponse.json({ error: 'duplicate_label', message: `Table “${label}” already exists in this restaurant.` }, { status: 409 });

    const table = await prisma.tableMap.create({
      data: { outletId, label, seats: cleanSeats(body.seats), qrToken: newToken() },
      select: { id: true, label: true, seats: true, state: true, qrToken: true },
    });

    const settings = await readSettings(outletId);
    let patchNeeded = false;
    const patch: Record<string, unknown> = {};

    // floor assignment
    if (body.floorId) {
      const map = readTableFloors(settings);
      map[table.id] = String(body.floorId);
      patch.tableFloors = map;
      patchNeeded = true;
    }

    // active / disabled status
    if (body.active === false) {
      const disabled = readDisabledTables(settings);
      if (!disabled.includes(table.id)) {
        patch.disabledTables = [...disabled, table.id];
        patchNeeded = true;
      }
    }

    if (patchNeeded) {
      await writeSettings(outletId, settings, patch);
    }

    await audit('table.created', table.id, table);
    return NextResponse.json({ ok: true, table: { ...table, floorId: body.floorId || null, active: body.active !== false } });
  }

  // ------------------------------------------------------------- bulk
  if (body.action === 'bulk') {
    const count = Math.min(50, Math.max(1, Math.round(Number(body.count) || 0)));
    if (!count) return NextResponse.json({ error: 'invalid_count' }, { status: 400 });
    const prefix = (cleanLabel(body.prefix) || 'T').slice(0, 8);
    const seats = cleanSeats(body.seats);

    const existing = await prisma.tableMap.findMany({ where: { outletId }, select: { label: true } });
    const taken = new Set(existing.map((t) => t.label.toLowerCase()));
    let next = 1;
    for (const { label } of existing) {
      const m = label.match(new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`, 'i'));
      if (m) next = Math.max(next, Number(m[1]) + 1);
    }

    const data: Prisma.TableMapCreateManyInput[] = [];
    let made = 0;
    while (made < count) {
      const label = `${prefix}${next++}`;
      if (taken.has(label.toLowerCase())) continue;
      taken.add(label.toLowerCase());
      data.push({ id: crypto.randomUUID(), outletId, label, seats, qrToken: newToken() });
      made++;
    }
    await prisma.tableMap.createMany({ data });

    if (body.floorId) {
      const settings = await readSettings(outletId);
      const map = readTableFloors(settings);
      for (const row of data) map[row.id as string] = String(body.floorId);
      await writeSettings(outletId, settings, { tableFloors: map });
    }
    await audit('table.bulk_created', null, { count: made, prefix });
    return NextResponse.json({ ok: true, created: made });
  }

  // everything below needs an id that belongs to this outlet
  const id = String(body.id ?? '');
  if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });
  const owned = await prisma.tableMap.findFirst({ where: { id, outletId }, select: { id: true, label: true, seats: true, state: true, qrToken: true } });
  if (!owned) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // ----------------------------------------------------------- update
  if (body.action === 'update') {
    const data: Prisma.TableMapUpdateInput = {};
    if (body.label !== undefined) {
      const label = cleanLabel(body.label);
      if (!label) return NextResponse.json({ error: 'missing_label', message: 'Enter a table name/number.' }, { status: 400 });
      const clash = await prisma.tableMap.findFirst({ where: { outletId, label, id: { not: id } }, select: { id: true } });
      if (clash) return NextResponse.json({ error: 'duplicate_label', message: `Table “${label}” already exists in this restaurant.` }, { status: 409 });
      data.label = label;
    }
    if (body.seats !== undefined) data.seats = cleanSeats(body.seats);
    if (body.state !== undefined && STATES.includes(body.state)) data.state = body.state;

    let updatedTable = owned;
    if (Object.keys(data).length > 0) {
      updatedTable = await prisma.tableMap.update({
        where: { id },
        data,
        select: { id: true, label: true, seats: true, state: true, qrToken: true },
      });
    }

    const settings = await readSettings(outletId);
    let patchNeeded = false;
    const patch: Record<string, unknown> = {};

    // Handle section reassignment
    if (body.floorId !== undefined) {
      const map = readTableFloors(settings);
      const floorId = body.floorId ? String(body.floorId) : '';
      if (floorId) {
        map[id] = floorId;
      } else {
        delete map[id];
      }
      patch.tableFloors = map;
      patchNeeded = true;
    }

    // Handle active / disabled toggle
    if (body.active !== undefined) {
      const disabled = readDisabledTables(settings);
      const isCurrentlyDisabled = disabled.includes(id);
      if (body.active === false && !isCurrentlyDisabled) {
        patch.disabledTables = [...disabled, id];
        patchNeeded = true;
      } else if (body.active === true && isCurrentlyDisabled) {
        patch.disabledTables = disabled.filter((x) => x !== id);
        patchNeeded = true;
      }
    }

    if (patchNeeded) {
      await writeSettings(outletId, settings, patch);
    }

    await audit('table.updated', id, { ...data, floorId: body.floorId, active: body.active });
    const currentTableFloors = patch.tableFloors ? (patch.tableFloors as Record<string, string>) : readTableFloors(settings);
    const currentDisabled = patch.disabledTables ? (patch.disabledTables as string[]) : readDisabledTables(settings);

    return NextResponse.json({
      ok: true,
      table: {
        ...updatedTable,
        floorId: currentTableFloors[id] ?? null,
        active: !currentDisabled.includes(id),
      },
    });
  }

  // ------------------------------------------------------- regenerate QR
  if (body.action === 'regenerate') {
    const table = await prisma.tableMap.update({
      where: { id },
      data: { qrToken: newToken() },
      select: { id: true, label: true, seats: true, state: true, qrToken: true },
    });
    await audit('table.qr_rotated', id);
    return NextResponse.json({ ok: true, table });
  }

  // ----------------------------------------------------------- delete
  if (body.action === 'delete') {
    // Check for active orders in progress
    const activeOrderCount = await prisma.order.count({
      where: {
        tableId: id,
        type: 'dine_in',
        status: { in: ['open', 'in_kitchen', 'ready', 'served'] },
        settledAt: null,
      },
    });

    if (activeOrderCount > 0) {
      return NextResponse.json({
        error: 'table_has_active_orders',
        message: `Table “${owned.label}” has ${activeOrderCount} active order(s) in progress. Settle or cancel them before deleting.`,
      }, { status: 409 });
    }

    // Check if historical orders exist
    const historicalOrderCount = await prisma.order.count({ where: { tableId: id } });
    const settings = await readSettings(outletId);

    if (historicalOrderCount > 0) {
      // Soft-delete: deactivate table so order foreign keys and revenue audit remain 100% intact!
      const disabled = readDisabledTables(settings);
      const patch: Record<string, unknown> = {};
      if (!disabled.includes(id)) {
        patch.disabledTables = [...disabled, id];
      }
      if (Object.keys(patch).length > 0) {
        await writeSettings(outletId, settings, patch);
      }
      await audit('table.deactivated', id, { reason: 'soft_delete_preserves_orders', count: historicalOrderCount });
      return NextResponse.json({
        ok: true,
        softDeleted: true,
        message: `Table “${owned.label}” has ${historicalOrderCount} past order(s). It was deactivated to preserve order history.`,
      });
    }

    // Safe hard delete: no active or historical orders
    await prisma.tableMap.delete({ where: { id } });
    const map = readTableFloors(settings);
    const disabled = readDisabledTables(settings).filter((x) => x !== id);
    if (map[id]) delete map[id];
    await writeSettings(outletId, settings, { tableFloors: map, disabledTables: disabled });
    await audit('table.deleted', id);
    return NextResponse.json({ ok: true, deleted: true });
  }

  return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
}
