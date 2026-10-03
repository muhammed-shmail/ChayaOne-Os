require('dotenv').config();
const { PrismaClient } = require('@cafeos/db');
const prisma = new PrismaClient();

async function run() {
  const stale = await prisma.attendance.findMany({
    where: {
      clockOut: null,
      clockIn: { lt: new Date(Date.now() - 16 * 3600 * 1000) }
    },
    include: { staff: { select: { name: true } } }
  });
  console.log('Stale open punches found:', stale.length);
  for (const p of stale) {
    const autoOut = new Date(p.clockIn.getTime() + 8 * 3600 * 1000);
    console.log('Auto closing punch for', p.staff.name, 'clockIn:', p.clockIn.toISOString(), 'autoOut:', autoOut.toISOString());
    await prisma.attendance.update({
      where: { id: p.id },
      data: { clockOut: autoOut }
    });
  }
  console.log('Done auto-closing stale punches.');
}

run().finally(() => prisma.$disconnect());
