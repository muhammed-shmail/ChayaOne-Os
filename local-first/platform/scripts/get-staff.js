const { PrismaClient } = require('@cafeos/db');
const prisma = new PrismaClient();

async function run() {
  const staff = await prisma.staffUser.findMany({
    select: { id: true, name: true, username: true, role: true }
  });
  console.log('Staff list:', staff);
}

run().finally(() => prisma.$disconnect());
