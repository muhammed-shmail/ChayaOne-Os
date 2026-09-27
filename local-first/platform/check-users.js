require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.staffUser.findMany({
    select: { id: true, name: true, role: true, username: true, outletId: true, tenantId: true }
  });
  console.log('Users in DB (port 5433):', JSON.stringify(users, null, 2));

  const outlets = await prisma.outlet.findMany({
    select: { id: true, name: true, tenantId: true, tenant: { select: { name: true } } }
  });
  console.log('Outlets in DB:', JSON.stringify(outlets, null, 2));

  const sessions = await prisma.staffSession.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: { id: true, staffId: true, outletId: true, tenantId: true, token: true, createdAt: true, expiresAt: true }
  });
  console.log('Sessions in DB:', JSON.stringify(sessions, null, 2));

  await prisma.$disconnect();
}

main().catch(console.error);
