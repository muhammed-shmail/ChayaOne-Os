process.env.DATABASE_URL = 'postgresql://cafeos:cafeos@127.0.0.1:5433/cafeos';
const { getDashboardData } = require('../apps/web/lib/analytics');
const { prisma } = require('@cafeos/db');

async function check() {
  const outlet = await prisma.outlet.findFirst();
  console.log('Outlet:', outlet.id, outlet.name);

  const data = await getDashboardData(outlet.id);
  console.log('Dashboard Data keys:', Object.keys(data));
  console.log('kpi:', data.kpi);
  console.log('briefing:', data.briefing);
  console.log('topItems:', data.topItems);
  console.log('lowStock:', data.lowStock);
  console.log('trend:', data.trend);
  console.log('menuQuadrant:', data.menuQuadrant?.length);
}

check().catch(console.error).finally(() => prisma.$disconnect());
