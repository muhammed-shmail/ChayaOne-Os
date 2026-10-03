const { PrismaClient } = require('@cafeos/db');
const prisma = new PrismaClient();

async function check() {
  const staff = await prisma.staffUser.findFirst({
    where: { username: 'owner' }
  });
  console.log('Owner user details:', {
    id: staff.id,
    name: staff.name,
    username: staff.username,
    role: staff.role,
    active: staff.active,
    outletId: staff.outletId,
    tenantId: staff.tenantId,
    pin: staff.pin,
    hasPasswordHash: !!staff.passwordHash,
    passwordHash: staff.passwordHash ? staff.passwordHash.substring(0, 20) + '...' : null
  });
}

check().finally(() => prisma.$disconnect());
