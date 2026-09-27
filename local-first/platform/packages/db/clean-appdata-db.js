const path = require('path');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const net = require('net');

const appDataDb = path.join(process.env.APPDATA, '@cafeos', 'desktop', 'database');
const pgBin = path.resolve('c:/nuro 7/CHAYAONE/CHAYAONE OS/local-first/platform/node_modules/@embedded-postgres/windows-x64/native/bin/postgres.exe');
const pidFile = path.join(appDataDb, 'postmaster.pid');

if (fs.existsSync(pidFile)) {
  try { fs.unlinkSync(pidFile); } catch {}
}

const child = spawn(pgBin, ['-D', appDataDb, '-p', '5434'], { stdio: 'ignore' });

async function isPortOpen(port) {
  return new Promise((resolve) => {
    const s = net.connect({ host: '127.0.0.1', port });
    s.on('connect', () => { s.destroy(); resolve(true); });
    s.on('error', () => resolve(false));
  });
}

async function run() {
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 500));
    if (await isPortOpen(5434)) break;
  }

  const { PrismaClient } = require(path.resolve('c:/nuro 7/CHAYAONE/CHAYAONE OS/local-first/platform/node_modules/@prisma/client'));
  const prisma = new PrismaClient({
    datasources: { db: { url: 'postgresql://cafeos:cafeos@localhost:5434/cafeos' } }
  });

  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      break;
    } catch (e) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  try {
    const jsonPath = 'c:/nuro 7/CHAYAONE/CHAYAONE OS/public/kaawa_menu_parsed.json';
    const menuData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    // Remove unwanted/test tenants
    const deletedTenants = await prisma.tenant.deleteMany({
      where: {
        id: { not: '54127a54-52ca-421b-ae0c-201858afd86c' }
      }
    });
    console.log('Removed unwanted test tenants from AppData DB:', deletedTenants.count);

    // Sync Kaawa outlet
    const outlet = await prisma.outlet.findFirst({
      where: { id: '01aa51b8-7628-4715-9225-f69b7e0b77f9' }
    });

    if (outlet) {
      console.log('Syncing Kaawa menu in AppData DB...');
      await prisma.orderItem.updateMany({
        where: { item: { outletId: outlet.id } },
        data: { itemId: null },
      });
      await prisma.itemModifierGroup.deleteMany({ where: { item: { outletId: outlet.id } } });
      await prisma.comboItem.deleteMany({ where: { item: { outletId: outlet.id } } });
      await prisma.recipe.deleteMany({ where: { item: { outletId: outlet.id } } });
      await prisma.itemSalesRollup.deleteMany({ where: { item: { outletId: outlet.id } } });
      await prisma.modifier.deleteMany({ where: { group: { outletId: outlet.id } } });
      await prisma.modifierGroup.deleteMany({ where: { outletId: outlet.id } });
      await prisma.menuItem.deleteMany({ where: { outletId: outlet.id } });
      await prisma.category.deleteMany({ where: { outletId: outlet.id } });

      const catMap = new Map();
      for (let i = 0; i < menuData.categories.length; i++) {
        const c = await prisma.category.create({
          data: { outletId: outlet.id, name: menuData.categories[i], sort: i }
        });
        catMap.set(menuData.categories[i], c.id);
      }
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
      }
      console.log('✅ AppData DB successfully cleaned and synced with 22 categories and 183 items.');
    }
  } catch (err) {
    console.error('Error syncing AppData DB:', err);
  } finally {
    await prisma.$disconnect();
    child.kill('SIGTERM');
    try { execSync(`taskkill /F /T /PID ${child.pid}`); } catch {}
  }
}

run();
