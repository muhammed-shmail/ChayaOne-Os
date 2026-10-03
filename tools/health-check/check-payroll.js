require('dotenv').config();
const { PrismaClient } = require('@cafeos/db');
const prisma = new PrismaClient();

async function main() {
  const payments = await prisma.salaryPayment.findMany({
    include: { staff: { select: { name: true, payType: true, payRatePaise: true } } }
  });
  console.log('=== SALARY PAYMENTS (' + payments.length + ') ===');
  console.log(JSON.stringify(payments, null, 2));

  const shifts = await prisma.shift.findMany({
    include: { staff: { select: { name: true } } }
  });
  console.log('=== SHIFTS (' + shifts.length + ') ===');
  console.log(JSON.stringify(shifts, null, 2));
}

main().finally(() => prisma.$disconnect());
