const fs = require('fs');
const path = require('path');

const envPath = path.resolve('c:/nuro 7/CHAYAONE/CHAYAONE OS/.env');
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, 'utf8');
  envText.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      const k = trimmed.slice(0, idx).trim();
      let v = trimmed.slice(idx + 1).trim();
      v = v.replace(/^"|"$/g, '');
      if (!process.env[k]) process.env[k] = v;
    }
  });
}

const { PrismaClient } = require('c:/nuro 7/CHAYAONE/CHAYAONE OS/node_modules/@prisma/client');
const prisma = new PrismaClient();

const jsonPath = 'c:/nuro 7/CHAYAONE/CHAYAONE OS/public/kaawa_menu_parsed.json';
const menuData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

async function cleanMenu() {
  const outlets = await prisma.outlet.findMany();
  console.log('Found outlets in DB:', outlets.length);

  for (const outlet of outlets) {
    console.log(`\n--- Resetting menu for outlet: ${outlet.name} (${outlet.id}) ---`);

    // 1. Unlink historical orders
    await prisma.orderItem.updateMany({
      where: { item: { outletId: outlet.id } },
      data: { itemId: null },
    });

    // 2. Delete junction tables & old items
    await prisma.itemModifierGroup.deleteMany({ where: { item: { outletId: outlet.id } } });
    await prisma.comboItem.deleteMany({ where: { item: { outletId: outlet.id } } });
    await prisma.recipe.deleteMany({ where: { item: { outletId: outlet.id } } });
    await prisma.itemSalesRollup.deleteMany({ where: { item: { outletId: outlet.id } } });
    await prisma.modifier.deleteMany({ where: { group: { outletId: outlet.id } } });
    await prisma.modifierGroup.deleteMany({ where: { outletId: outlet.id } });

    // 3. Delete all old menu items & categories (wiping default/unwanted test items)
    const delItems = await prisma.menuItem.deleteMany({ where: { outletId: outlet.id } });
    const delCats = await prisma.category.deleteMany({ where: { outletId: outlet.id } });
    console.log(`Wiped ${delItems.count} old test items and ${delCats.count} categories.`);

    // 4. Update kitchen stations
    const currentSettings = outlet.settings || {};
    const updatedKitchens = [
      { id: 'p1', name: 'P1 · Tea & Beverages', sort: 0, color: '#d9a93a' },
      { id: 'p2', name: 'P2 · Food & Snacks', sort: 1, color: '#c3492f' },
    ];
    await prisma.outlet.update({
      where: { id: outlet.id },
      data: { settings: { ...currentSettings, kitchens: updatedKitchens } }
    });

    // 5. Insert clean Kaawa categories
    const catMap = new Map();
    for (let i = 0; i < menuData.categories.length; i++) {
      const c = await prisma.category.create({
        data: {
          outletId: outlet.id,
          name: menuData.categories[i],
          sort: i,
        }
      });
      catMap.set(menuData.categories[i], c.id);
    }
    console.log(`Created ${catMap.size} clean categories.`);

    // 6. Insert all 183 items
    let count = 0;
    for (const it of menuData.items) {
      const catId = catMap.get(it.category);
      if (!catId) continue;
      await prisma.menuItem.create({
        data: {
          outletId: outlet.id,
          categoryId: catId,
          name: it.name,
          pricePaise: it.pricePaise,
          station: it.station || 'P1',
          isAvailable: true,
          tags: it.tags || [],
          gstRate: 5,
        }
      });
      count++;
    }
    console.log(`Created ${count} clean items.`);
  }
}

cleanMenu()
  .then(() => console.log('\n✅ Kaawa Menu successfully synchronized and test items wiped!'))
  .catch(console.error)
  .finally(() => prisma.$disconnect());
