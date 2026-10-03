import { PrismaClient } from '@prisma/client';

/**
 * Singleton Prisma client for the Owner Dashboard.
 * Connects to the cloud PostgreSQL database (same schema as the Shop OS).
 * The DATABASE_URL must point to a cloud-accessible database, NOT localhost.
 */

// Ensure environment variables exist even if dev server started prior to .env creation
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://cafeos:cafeos@localhost:5433/cafeos';
}
if (!process.env.DIRECT_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'chayaone-local-jwt-secret-key-32-chars-long';
}

delete (globalThis as any).__ownerPrisma;

declare global {
  // Prevent multiple instances in Next.js hot-reload
  // eslint-disable-next-line no-var
  var __ownerPrisma: PrismaClient | undefined;
}

function createPrismaClient() {
  const dbUrl = process.env.DATABASE_URL || 'postgresql://cafeos:cafeos@localhost:5433/cafeos';
  return new PrismaClient({
    datasources: {
      db: {
        url: dbUrl,
      },
    },
    log: process.env.NODE_ENV === 'development'
      ? ['error', 'warn']
      : ['error'],
  });
}

export const prisma: PrismaClient =
  globalThis.__ownerPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__ownerPrisma = prisma;
}

export type { StaffRole } from '@prisma/client';
export { Prisma } from '@prisma/client';
