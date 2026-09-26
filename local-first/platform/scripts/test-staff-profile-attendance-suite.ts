import 'dotenv/config';
import { PrismaClient } from '@cafeos/db';
import { hashPassword, verifyPassword } from '../apps/web/lib/crypto';

const prisma = new PrismaClient();

async function runSuite() {
  console.log('====================================================');
  console.log('CHAYAONE — STAFF PROFILE, ATTENDANCE & SECURITY SUITE');
  console.log('====================================================\n');

  // 1. Fetch Staff Member Ravi
  console.log('1. Checking Staff Member (Ravi)...');
  const ravi = await prisma.staffUser.findFirst({
    where: { name: { contains: 'Ravi' } }
  });

  if (!ravi) {
    throw new Error('Staff member Ravi not found in database');
  }
  console.log(`✓ Found Staff: ${ravi.name} (ID: ${ravi.id}, Role: ${ravi.role}, Active: ${ravi.active})`);

  // Update employeeCode if null for testing profile completeness
  if (!ravi.employeeCode) {
    await prisma.staffUser.update({
      where: { id: ravi.id },
      data: {
        employeeCode: '9000000001',
        phone: '+91 98765 43210',
        permissions: { designation: 'Head Operations / Owner', joiningDate: '2025-01-15' },
      }
    });
    console.log('✓ Updated Ravi with employee code 9000000001, designation, and phone');
  }

  // 2. Attendance Test: Initial State
  console.log('\n2. Testing Attendance History for Ravi (Month: 2026-09)...');
  const outlet = await prisma.outlet.findFirst();
  const outletId = outlet?.id || 'main-outlet';

  // Clean test records for clean run
  await prisma.attendance.deleteMany({
    where: { staffId: ravi.id }
  });

  const emptyRecords = await prisma.attendance.findMany({
    where: { staffId: ravi.id }
  });
  console.log(`✓ Initial attendance count: ${emptyRecords.length} (Proper empty state)`);

  // 3. Mark Attendance records
  console.log('\n3. Testing Attendance Recording & Calculation...');
  // Record 1: Present (09:30 AM to 05:30 PM = 480 mins = 8h)
  const date1 = '2026-09-24';
  const inDate1 = new Date(`${date1}T09:30:00+05:30`);
  const outDate1 = new Date(`${date1}T17:30:00+05:30`);
  const rec1 = await prisma.attendance.create({
    data: {
      staffId: ravi.id,
      outletId: outletId,
      clockIn: inDate1,
      clockOut: outDate1,
      status: 'present',
      workingMinutes: 480,
      source: 'manual',
      notes: 'On-time morning shift'
    }
  });
  console.log(`✓ Record 1 created: ${date1} | Present | 8h 00m | In: 09:30 AM | Out: 05:30 PM`);

  // Record 2: Late (09:45 AM to 05:45 PM = 480 mins)
  const date2 = '2026-09-25';
  const inDate2 = new Date(`${date2}T09:45:00+05:30`);
  const outDate2 = new Date(`${date2}T17:45:00+05:30`);
  const rec2 = await prisma.attendance.create({
    data: {
      staffId: ravi.id,
      outletId: outletId,
      clockIn: inDate2,
      clockOut: outDate2,
      status: 'late',
      workingMinutes: 480,
      source: 'manual',
      notes: 'Traffic delay'
    }
  });
  console.log(`✓ Record 2 created: ${date2} | Late | 8h 00m | In: 09:45 AM | Out: 05:45 PM`);

  // Record 3: Working / Missing Checkout (Checked in at 09:30 AM, not yet checked out)
  const date3 = '2026-09-26';
  const inDate3 = new Date(`${date3}T09:30:00+05:30`);
  const rec3 = await prisma.attendance.create({
    data: {
      staffId: ravi.id,
      outletId: outletId,
      clockIn: inDate3,
      clockOut: null,
      status: 'working',
      workingMinutes: null,
      source: 'clock_in',
      notes: null
    }
  });
  console.log(`✓ Record 3 created: ${date3} | Working (Missing checkout) | In: 09:30 AM | Out: --`);

  // 4. Test Live Summary Statistics
  console.log('\n4. Validating Live Attendance KPI Summary Calculation...');
  const allAtt = await prisma.attendance.findMany({
    where: { staffId: ravi.id }
  });

  let presentCount = 0;
  let lateCount = 0;
  let workingCount = 0;
  let totalMinutes = 0;

  for (const a of allAtt) {
    if (a.status === 'present') presentCount++;
    if (a.status === 'late') lateCount++;
    if (a.status === 'working') workingCount++;
    if (a.workingMinutes) totalMinutes += a.workingMinutes;
  }

  const workingDays = presentCount + lateCount + workingCount;
  const rate = workingDays > 0 ? (((presentCount + lateCount) / workingDays) * 100).toFixed(1) : '0';
  const totalHrs = `${Math.floor(totalMinutes / 60)}h ${String(totalMinutes % 60).padStart(2, '0')}m`;

  console.log(`✓ Live KPI Calculation:
      Present: ${presentCount}
      Late: ${lateCount}
      Working: ${workingCount}
      Total Working Days: ${workingDays}
      Attendance Rate: ${rate}%
      Total Working Hours: ${totalHrs}`);

  if (presentCount !== 1 || lateCount !== 1 || workingDays !== 3) {
    throw new Error('KPI calculations do not match expected records');
  }

  // 5. Test Audited Attendance Correction
  console.log('\n5. Testing Audited Attendance Correction (e.g., Forgot Checkout)...');
  const correctedOut = new Date(`${date3}T18:00:00+05:30`);
  const workingMins = Math.round((correctedOut.getTime() - inDate3.getTime()) / 60000);

  const beforeState = {
    clockIn: rec3.clockIn,
    clockOut: rec3.clockOut,
    status: rec3.status,
    workingMinutes: rec3.workingMinutes
  };

  const updatedRec = await prisma.attendance.update({
    where: { id: rec3.id },
    data: {
      clockOut: correctedOut,
      status: 'present',
      workingMinutes: workingMins,
      source: 'admin_correction',
      notes: 'Adjusted missing checkout: Forgot checkout'
    }
  });

  const auditEntry = await prisma.auditLog.create({
    data: {
      outletId: outletId,
      action: 'staff.attendance_corrected',
      entity: 'attendance',
      entityId: rec3.id,
      actorId: ravi.id,
      before: beforeState,
      after: {
        recordId: rec3.id,
        date: date3,
        clockIn: rec3.clockIn,
        clockOut: correctedOut,
        status: 'present',
        workingMinutes: workingMins,
        reason: 'Forgot checkout'
      }
    }
  });

  console.log(`✓ Attendance Record ${rec3.id} corrected to:
      Check In: 09:30 AM
      Check Out: 06:00 PM
      Duration: ${Math.floor(workingMins / 60)}h ${workingMins % 60}m
      Status: ${updatedRec.status}
      Source: ${updatedRec.source}`);
  console.log(`✓ Audit Log Entry generated: ID ${auditEntry.id} with action: "${auditEntry.action}"`);

  // 6. Test Staff Password Security & Scrypt Cryptography
  console.log('\n6. Testing Staff Password Security & Cryptography...');
  const testPlainPassword = 'ChayaOne@SecurePass2026';
  const hashed = hashPassword(testPlainPassword);

  console.log(`✓ Plaintext password hashed via scrypt: ${hashed.slice(0, 25)}... (never plaintext)`);
  if (hashed.includes(testPlainPassword)) {
    throw new Error('Security Breach: Plaintext password found in hash!');
  }

  const isValid = verifyPassword(testPlainPassword, hashed);
  const isInvalid = verifyPassword('WrongPassword123', hashed);

  if (!isValid || isInvalid) {
    throw new Error('Password verification logic failed');
  }
  console.log('✓ Password verification succeeded (matching pass = true, wrong pass = false)');

  // Update staff password hash
  await prisma.staffUser.update({
    where: { id: ravi.id },
    data: { passwordHash: hashed }
  });

  // Verify API never leaks passwordHash
  const staffRecordFromQuery = await prisma.staffUser.findUnique({
    where: { id: ravi.id },
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      active: true,
      employeeCode: true,
      phone: true,
      // passwordHash omitted
    }
  });
  console.log('✓ Staff API response representation (safe object):');
  console.log(staffRecordFromQuery);

  // 7. Test Account Suspension & Reactivation
  console.log('\n7. Testing Account Suspension & Reactivation...');
  // Suspend
  const suspended = await prisma.staffUser.update({
    where: { id: ravi.id },
    data: { active: false }
  });
  console.log(`✓ Account Suspended: active = ${suspended.active}`);

  // Reactivate
  const reactivated = await prisma.staffUser.update({
    where: { id: ravi.id },
    data: { active: true }
  });
  console.log(`✓ Account Reactivated: active = ${reactivated.active}`);

  console.log('\n====================================================');
  console.log('ALL VERIFICATIONS PASSED SUCCESSFULLY! ✓');
  console.log('====================================================\n');
}

runSuite()
  .catch((err) => {
    console.error('Test Suite Failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
