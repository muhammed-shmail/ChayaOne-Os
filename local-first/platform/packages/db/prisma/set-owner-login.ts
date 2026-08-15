/**
 * Set (or reset) an owner's username + password login — NON-DESTRUCTIVE.
 *
 * Unlike `seed.ts` (which wipes all tenant data), this only updates the existing
 * owner row so an owner seeded before the username/passwordHash columns existed
 * can sign in to the dashboard. Nothing else is touched.
 *
 * Prereq: the `username`/`passwordHash` columns must already exist in the DB
 * (run `deploy:push` / `prisma db push` first).
 *
 * Run:
 *   local:  npm run -w @cafeos/db set-owner
 *   prod:   DATABASE_URL="<neon url>" npm run -w @cafeos/db set-owner:prod
 *
 * Env overrides:
 *   OWNER_USERNAME  (default 'owner')
 *   OWNER_PASSWORD  (default 'cafe1234')
 *   OWNER_TENANT    (optional Tenant.subdomain, to disambiguate multi-tenant DBs)
 */
import { PrismaClient, StaffRole } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';

const prisma = new PrismaClient();

// scrypt$<saltHex>$<keyHex> — must match apps/web/lib/platform-crypto.ts verifyPassword().
const hashPassword = (pw: string) => {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('hex')}$${scryptSync(pw, salt, 64).toString('hex')}`;
};

async function main() {
  const username = (process.env.OWNER_USERNAME ?? 'owner').toLowerCase();
  const password = process.env.OWNER_PASSWORD ?? 'cafe1234';
  const tenantSub = process.env.OWNER_TENANT;

  let tenantId: string | undefined;
  if (tenantSub) {
    const t = await prisma.tenant.findUnique({ where: { subdomain: tenantSub }, select: { id: true } });
    if (!t) throw new Error(`No tenant with subdomain "${tenantSub}".`);
    tenantId = t.id;
  }

  const owners = await prisma.staffUser.findMany({
    where: { role: StaffRole.owner, ...(tenantId ? { tenantId } : {}) },
    select: { id: true, name: true, tenantId: true, outletId: true, active: true, username: true },
  });

  if (owners.length === 0) {
    throw new Error('No owner staff user found. Run the seed first, or pass OWNER_TENANT.');
  }
  if (owners.length > 1 && !tenantId) {
    throw new Error(`Found ${owners.length} owners across tenants. Set OWNER_TENANT=<subdomain> to pick one.`);
  }

  // The password login requires an active owner with an outlet — prefer that one.
  const owner = owners.find((o) => o.active && o.outletId) ?? owners.find((o) => o.outletId) ?? owners[0]!;
  if (!owner.outletId) {
    throw new Error(`Owner "${owner.name}" has no outlet assigned; password login needs one.`);
  }

  await prisma.staffUser.update({
    where: { id: owner.id },
    data: { username, passwordHash: hashPassword(password), active: true },
  });

  console.log(`✅ Owner login set: username="${username}" on "${owner.name}" (tenant ${owner.tenantId}).`);
  console.log(`   Sign in at /login → "Sign in with username & password".`);
}

main()
  .catch((e) => {
    console.error('❌', e?.message ?? e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
