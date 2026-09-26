import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';

// Load env files
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../Owner-chayaone/.env.local') });

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface ParsedMenu {
  categories: string[];
  items: Array<{
    category: string;
    name: string;
    price: number;
    pricePaise: number;
    station: string;
    isAvailable: boolean;
    tags: string[];
  }>;
}

async function run() {
  console.log('🚀 Starting Kaawa Menu import & Category reset...');

  const jsonPath = path.resolve(__dirname, '../../../../public/kaawa_menu_parsed.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Parsed menu JSON not found at ${jsonPath}`);
  }

  const menuData: ParsedMenu = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  console.log(`📋 Found ${menuData.categories.length} categories and ${menuData.items.length} items in Kaawa Menu.`);

  const outlets = await prisma.outlet.findMany();
  console.log(`🏪 Found ${outlets.length} outlet(s) in database.`);

  for (const outlet of outlets) {
    console.log(`\n========================================`);
    console.log(`Processing Outlet: ${outlet.name} (id: ${outlet.id})`);
    console.log(`========================================`);

    // 1. Decouple past order_items so historical orders & receipts remain intact without FK constraint failures
    console.log('1️⃣  Decoupling order items from existing menu items (preserving snapshot)...');
    const orderItemsUnlinked = await prisma.orderItem.updateMany({
      where: { item: { outletId: outlet.id } },
      data: { itemId: null },
    });
    console.log(`   Unlinked ${orderItemsUnlinked.count} order item reference(s).`);

    // 2. Remove junction tables and dependencies
    console.log('2️⃣  Removing modifier group mappings, combos, recipes, rollups...');
    await prisma.itemModifierGroup.deleteMany({ where: { item: { outletId: outlet.id } } });
    await prisma.comboItem.deleteMany({ where: { item: { outletId: outlet.id } } });
    await prisma.recipe.deleteMany({ where: { item: { outletId: outlet.id } } });
    await prisma.itemSalesRollup.deleteMany({ where: { item: { outletId: outlet.id } } });
    await prisma.modifier.deleteMany({ where: { group: { outletId: outlet.id } } });
    await prisma.modifierGroup.deleteMany({ where: { outletId: outlet.id } });

    // 3. Delete all old menu items
    console.log('3️⃣  Deleting old menu items...');
    const deletedItems = await prisma.menuItem.deleteMany({ where: { outletId: outlet.id } });
    console.log(`   Deleted ${deletedItems.count} old menu item(s).`);

    // 4. Delete all old categories
    console.log('4️⃣  Deleting old categories...');
    const deletedCategories = await prisma.category.deleteMany({ where: { outletId: outlet.id } });
    console.log(`   Deleted ${deletedCategories.count} old category/categories.`);

    // 5. Ensure station settings exist in outlet.settings
    const currentSettings = (outlet.settings as Record<string, any>) || {};
    const updatedKitchens = [
      { id: 'p1', name: 'P1 · Tea & Beverages', sort: 0, color: '#d9a93a' },
      { id: 'p2', name: 'P2 · Food & Snacks', sort: 1, color: '#c3492f' },
    ];
    await prisma.outlet.update({
      where: { id: outlet.id },
      data: {
        settings: {
          ...currentSettings,
          kitchens: updatedKitchens,
        },
      },
    });
    console.log('5️⃣  Updated outlet kitchens in settings with P1 and P2.');

    // 6. Insert new categories
    console.log('6️⃣  Inserting 22 new categories...');
    const catMap = new Map<string, string>();
    for (let i = 0; i < menuData.categories.length; i++) {
      const catName = menuData.categories[i]!;
      const createdCat = await prisma.category.create({
        data: {
          outletId: outlet.id,
          name: catName,
          sort: i,
        },
      });
      catMap.set(catName, createdCat.id);
    }
    console.log(`   Created ${catMap.size} categories.`);

    // 7. Insert all 183 items
    console.log('7️⃣  Inserting 183 new menu items...');
    let insertedCount = 0;
    for (const it of menuData.items) {
      const categoryId = catMap.get(it.category);
      if (!categoryId) {
        console.warn(`   ⚠️ Warning: Category not found for item: "${it.name}" (category: "${it.category}")`);
        continue;
      }

      await prisma.menuItem.create({
        data: {
          outletId: outlet.id,
          categoryId,
          name: it.name,
          pricePaise: it.pricePaise,
          gstRate: new Prisma.Decimal(5.0), // Standard 5% cafe GST
          hsnCode: '2106',
          station: it.station, // 'P1' or 'P2'
          isAvailable: it.isAvailable,
          tags: it.tags,
        },
      });
      insertedCount++;
    }
    console.log(`   Successfully inserted ${insertedCount} menu items!`);
  }

  // 8. Verification query
  console.log('\n========================================');
  console.log('🔍 VERIFICATION SUMMARY');
  console.log('========================================');
  for (const outlet of outlets) {
    const cats = await prisma.category.findMany({
      where: { outletId: outlet.id },
      orderBy: { sort: 'asc' },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    const totalItems = await prisma.menuItem.count({ where: { outletId: outlet.id } });
    console.log(`Outlet: ${outlet.name}`);
    console.log(`Total Categories: ${cats.length}`);
    console.log(`Total Menu Items: ${totalItems}`);
    console.log('Category breakdown:');
    for (const c of cats) {
      console.log(`  - [${c.sort}] ${c.name}: ${c._count.items} items`);
    }
  }

  console.log('\n🎉 Kaawa Menu import completed successfully!');
}

run()
  .catch((e) => {
    console.error('❌ Import failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
