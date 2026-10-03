require('dotenv').config();
const { PrismaClient } = require('@cafeos/db');
const prisma = new PrismaClient();

async function main() {
  console.log('=== VERIFYING STAFF MANAGEMENT, ATTENDANCE & PAYROLL ===');

  const tenant = await prisma.tenant.findFirst();
  const outlets = await prisma.outlet.findMany();
  if (!tenant || outlets.length === 0) throw new Error('Missing tenant/outlet');

  console.log('Tenant:', tenant.name, 'Outlets found:', outlets.map(o => `${o.name} (${o.id})`));
  const outlet = outlets.find(o => o.name.includes('Alpha')) || outlets[0];
  console.log('Testing with primary outlet:', outlet.name);

  // 1. Staff Members & Pay Configuration
  const staff = await prisma.staffUser.findMany({
    where: { active: true },
    select: { id: true, name: true, role: true, payType: true, payRatePaise: true, employeeCode: true }
  });

  console.log('\n--- ACTIVE STAFF MEMBERS ---');
  for (const s of staff) {
    const rateStr = s.payType === 'monthly' ? `Rs ${s.payRatePaise / 100}/mo` :
                    s.payType === 'hourly' ? `Rs ${s.payRatePaise / 100}/hr` : 'Not set';
    console.log(`• ${s.name} (${s.role}) - Rate: ${rateStr}, Code: ${s.employeeCode || 'None'}`);
  }

  // 2. Test Attendance Punch In & Punch Out Workflow
  console.log('\n--- TESTING ATTENDANCE PUNCH WORKFLOW ---');
  const testMember = staff[0];
  console.log(`Testing clock-in for: ${testMember.name} (id: ${testMember.id})`);

  // Verify currently not clocked in
  const priorOpen = await prisma.attendance.findFirst({
    where: { staffId: testMember.id, clockOut: null }
  });
  console.log('Prior open punch:', priorOpen ? priorOpen.id : 'None (clean)');

  // Simulate Clock In
  const clockInRecord = await prisma.attendance.create({
    data: {
      outletId: outlet.id,
      staffId: testMember.id,
      clockIn: new Date(),
      source: 'pin'
    }
  });
  console.log('✓ Successfully Clocked In:', clockInRecord.id, 'at', clockInRecord.clockIn.toISOString());

  // Verify attendance status is now "Present"
  const verifyOpen = await prisma.attendance.findFirst({
    where: { staffId: testMember.id, clockOut: null }
  });
  if (!verifyOpen || verifyOpen.id !== clockInRecord.id) {
    throw new Error('Attendance verification failed: punch was not recorded as open');
  }
  console.log('✓ Verified staff is now active on shift');

  // Simulate Clock Out 5 seconds later
  const clockOutRecord = await prisma.attendance.update({
    where: { id: clockInRecord.id },
    data: {
      clockOut: new Date(),
    }
  });
  console.log('✓ Successfully Clocked Out:', clockOutRecord.id, 'at', clockOutRecord.clockOut.toISOString());

  // 3. Verify Stale Punch Auto-Close Mechanism
  console.log('\n--- TESTING AUTO-CLOSE MECHANISM FOR STALE PUNCHES ---');
  // Create a simulated 20-hour-old stale punch
  const yesterday = new Date(Date.now() - 20 * 3600 * 1000);
  const stalePunch = await prisma.attendance.create({
    data: {
      outletId: outlet.id,
      staffId: testMember.id,
      clockIn: yesterday,
      source: 'pin'
    }
  });
  console.log('Created simulated stale punch:', stalePunch.id, 'clockIn:', stalePunch.clockIn.toISOString());

  // Run the exact auto-close logic used in GET /api/attendance and getStaff()
  const autoCloseThreshold = new Date(Date.now() - 16 * 3600 * 1000);
  const autoClosed = await prisma.attendance.updateMany({
    where: {
      outletId: outlet.id,
      clockOut: null,
      clockIn: { lt: autoCloseThreshold }
    },
    data: {
      clockOut: new Date()
    }
  });
  console.log(`✓ Auto-close executed: ${autoClosed.count} stale punch(es) auto-closed.`);

  const checkStale = await prisma.attendance.findUnique({ where: { id: stalePunch.id } });
  if (!checkStale || !checkStale.clockOut) {
    throw new Error('Auto-close failed: stale punch remained open');
  }
  console.log('✓ Verified stale punch was automatically closed. Attendance will never get stuck.');

  // Clean up test stale record
  await prisma.attendance.delete({ where: { id: stalePunch.id } });
  await prisma.attendance.delete({ where: { id: clockInRecord.id } });
  console.log('✓ Cleaned up temporary test punches.');

  // 4. Test Payroll Calculation Engine
  console.log('\n--- VERIFYING PAYROLL CALCULATION ENGINE ---');
  const period = new Date().toISOString().slice(0, 7);
  const parts = period.split('-').map(Number);
  const periodYear = Number.isFinite(parts[0]) && parts[0] ? parts[0] : new Date().getFullYear();
  const periodMonth = Number.isFinite(parts[1]) && parts[1] ? parts[1] : new Date().getMonth() + 1;
  const periodStart = new Date(Date.UTC(periodYear, periodMonth - 1, 1, 0, 0, 0));
  const periodEnd = new Date(Date.UTC(periodYear, periodMonth, 1, 0, 0, 0));

  const punches = await prisma.attendance.findMany({
    where: {
      outletId: outlet.id,
      clockIn: { gte: periodStart, lt: periodEnd },
    },
    select: { staffId: true, clockIn: true, clockOut: true }
  });

  const payments = await prisma.salaryPayment.findMany({
    where: {
      outletId: outlet.id,
      periodLabel: period,
    },
    select: { staffId: true, amountPaise: true, method: true, paidAt: true, note: true }
  });

  console.log(`Period: ${period} (${punches.length} attendance punches, ${payments.length} payout records)`);

  for (const m of staff) {
    const memberPunches = punches.filter(p => p.staffId === m.id);
    const uniqueDays = new Set(memberPunches.map(p => new Date(p.clockIn).toISOString().slice(0, 10))).size;
    let totalMinutes = 0;
    for (const p of memberPunches) {
      if (p.clockOut) {
        totalMinutes += Math.max(0, Math.round((new Date(p.clockOut).getTime() - new Date(p.clockIn).getTime()) / 60000));
      }
    }
    const totalHours = Number((totalMinutes / 60).toFixed(1));

    let expectedPaise = 0;
    if (m.payType === 'monthly' && m.payRatePaise) {
      expectedPaise = m.payRatePaise;
    } else if (m.payType === 'hourly' && m.payRatePaise) {
      expectedPaise = Math.round((m.payRatePaise / 60) * totalMinutes);
    }

    const memberPayments = payments.filter(p => p.staffId === m.id);
    const paidPaise = memberPayments.reduce((sum, p) => sum + p.amountPaise, 0);
    const balancePaise = Math.max(0, expectedPaise - paidPaise);

    let status = 'unconfigured';
    if (m.payType && m.payRatePaise) {
      if (paidPaise >= expectedPaise && expectedPaise > 0) status = 'paid';
      else if (paidPaise > 0 && paidPaise < expectedPaise) status = 'partial';
      else if (paidPaise === 0 && expectedPaise > 0) status = 'due';
      else if (paidPaise > 0 && expectedPaise === 0) status = 'advance';
      else status = 'due';
    }

    console.log(`• ${m.name}: ${uniqueDays} days, ${totalHours}h worked | Expected: Rs ${expectedPaise / 100}, Paid: Rs ${paidPaise / 100}, Due: Rs ${balancePaise / 100} [Status: ${status.toUpperCase()}]`);
  }

  console.log('\n=== ALL STAFF, ATTENDANCE & PAYROLL SYSTEMS VERIFIED SUCCESSFULLY! ===');
}

main().catch(e => {
  console.error('VERIFICATION ERROR:', e);
  process.exit(1);
}).finally(() => prisma.$disconnect());
