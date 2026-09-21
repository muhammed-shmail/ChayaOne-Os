require('dotenv').config();
const { PrismaClient } = require('@cafeos/db');
const prisma = new PrismaClient();

async function check() {
  const staff = await prisma.staffUser.findMany();
  console.log('=== STAFF MEMBERS (' + staff.length + ') ===');
  for (const s of staff) {
    console.log({
      id: s.id,
      name: s.name,
      username: s.username,
      role: s.role,
      active: s.active,
      hasPin: !!s.pin,
      payType: s.payType,
      payRatePaise: s.payRatePaise,
      employeeCode: s.employeeCode
    });
  }

  const att = await prisma.attendance.findMany({
    take: 10,
    orderBy: { clockIn: 'desc' }
  });
  console.log('=== RECENT ATTENDANCE (' + att.length + ') ===');
  for (const a of att) {
    console.log({
      id: a.id,
      staffId: a.staffId,
      clockIn: a.clockIn,
      clockOut: a.clockOut,
      source: a.source
    });
  }

  const outlet = await prisma.outlet.findFirst();
  console.log('=== OUTLET SETTINGS ===');
  console.log('location:', JSON.stringify(outlet?.settings?.location, null, 2));
  console.log('businessDay:', JSON.stringify(outlet?.settings?.businessDay, null, 2));
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
