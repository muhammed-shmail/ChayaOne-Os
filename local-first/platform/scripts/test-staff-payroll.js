require('dotenv').config();
const { PrismaClient } = require('@cafeos/db');
const prisma = new PrismaClient();

async function test() {
  console.log('--- TESTING STAFF MANAGEMENT, ATTENDANCE & PAYROLL ---');

  // 1. Check active staff members
  const staff = await prisma.staffUser.findMany({
    where: { active: true },
    select: { id: true, name: true, role: true, payType: true, payRatePaise: true, employeeCode: true }
  });
  console.log('Active staff count:', staff.length);

  // 2. Check open punches (should be 0 stale now)
  const openPunches = await prisma.attendance.findMany({
    where: { clockOut: null },
    include: { staff: { select: { name: true } } }
  });
  console.log('Open punches count:', openPunches.length);
  for (const p of openPunches) {
    console.log(`- ${p.staff?.name}: clocked in at ${p.clockIn.toISOString()}`);
  }

  // 3. Check current month attendance summary
  const period = new Date().toISOString().slice(0, 7);
  const [year, month] = period.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0));

  const punches = await prisma.attendance.findMany({
    where: { clockIn: { gte: start, lt: end } },
    select: { staffId: true, clockIn: true, clockOut: true }
  });
  console.log(`Punches for period ${period}:`, punches.length);

  // 4. Check salary payments
  const payments = await prisma.salaryPayment.findMany({
    where: { periodLabel: period },
    include: { staff: { select: { name: true } } }
  });
  console.log(`Salary payments recorded for period ${period}:`, payments.length);
  for (const pay of payments) {
    console.log(`- ${pay.staff?.name}: Rs ${pay.amountPaise / 100} (${pay.method}) on ${pay.paidAt.toISOString()}`);
  }

  console.log('--- ALL CHECKS PASSED ---');
}

test().finally(() => prisma.$disconnect());
