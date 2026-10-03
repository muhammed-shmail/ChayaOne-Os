const { PrismaClient } = require('@cafeos/db');
const { scryptSync, timingSafeEqual } = require('crypto');
const prisma = new PrismaClient();

function verifyPassword(pw, stored) {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'hex');
  const want = Buffer.from(parts[2], 'hex');
  const got = scryptSync(pw, salt, want.length || 64);
  return want.length === got.length && timingSafeEqual(want, got);
}

async function run() {
  const staff = await prisma.staffUser.findFirst({ where: { username: 'owner' } });
  console.log('Testing cafe1234:', verifyPassword('cafe1234', staff.passwordHash));
  console.log('Testing owner123:', verifyPassword('owner123', staff.passwordHash));
  console.log('Testing owner:', verifyPassword('owner', staff.passwordHash));
  console.log('Testing 1234:', verifyPassword('1234', staff.passwordHash));
  console.log('Testing admin:', verifyPassword('admin', staff.passwordHash));
  console.log('Testing cafeos:', verifyPassword('cafeos', staff.passwordHash));
  console.log('Testing password:', verifyPassword('password', staff.passwordHash));
}

run().finally(() => prisma.$disconnect());
