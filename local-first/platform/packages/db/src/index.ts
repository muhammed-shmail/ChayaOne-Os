import {
  PrismaClient,
  Prisma,
  SyncStatus,
  SyncOperation,
  PrintJobStatus,
  PrintJobType,
  DeviceStatus,
  DeviceRole,
  Plan,
  StaffRole,
  OrderType,
  OrderStatus,
  OrderChannel,
  KotStatus,
  TableState,
  PayMethod,
  PayStatus,
  Tier,
  CustomerStatus,
  CustomerSource,
  LedgerType,
  CouponStatus,
  PoStatus,
  RoomStatus,
  Channel,
} from '@prisma/client';

/**
 * Prisma client singleton — avoids exhausting connections during dev HMR.
 * In production (serverless) prefer the pooled DATABASE_URL (pgbouncer).
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export * from '@prisma/client';
// Explicit re-exports: Turbopack drops runtime values (enums, namespaces)
// when they come only through `export *` above. Named re-exports survive bundling.
export {
  Prisma,
  SyncStatus,
  SyncOperation,
  PrintJobStatus,
  PrintJobType,
  DeviceStatus,
  DeviceRole,
  Plan,
  StaffRole,
  OrderType,
  OrderStatus,
  OrderChannel,
  KotStatus,
  TableState,
  PayMethod,
  PayStatus,
  Tier,
  CustomerStatus,
  CustomerSource,
  LedgerType,
  CouponStatus,
  PoStatus,
  RoomStatus,
  Channel,
};
