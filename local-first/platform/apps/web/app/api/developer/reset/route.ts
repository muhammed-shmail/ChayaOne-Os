import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@cafeos/db';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEV_PASSWORDS = [
  '8281594767@shamil',
  '8281594767@Shamil',
  'Admin@Nuro',
  'admin@nuro',
  '82815947678281594767',
];
const FACTORY_RESET_PASSWORDS = ['82815947678281594767', '8281594767@Shamil', 'Admin@Nuro'];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password, type = 'transactions' } = body;

    // Validate passwords
    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    if (type === 'factory_reset') {
      if (!FACTORY_RESET_PASSWORDS.includes(password)) {
        return NextResponse.json(
          { error: 'Invalid factory reset password.' },
          { status: 403 }
        );
      }
    } else {
      if (!DEV_PASSWORDS.includes(password)) {
        return NextResponse.json(
          { error: 'Invalid developer password' },
          { status: 403 }
        );
      }
    }

    // Perform database operations in safe transaction
    const results = await prisma.$transaction(async (tx) => {
      // 1. Detach game sessions from orders
      await tx.gameSession.updateMany({
        where: { orderId: { not: null } },
        data: { orderId: null },
      });

      // 2. Delete refunds and payments
      const deletedRefunds = await tx.refund.deleteMany({});
      const deletedPayments = await tx.payment.deleteMany({});

      // 3. Delete KOTs and order items
      const deletedKots = await tx.kot.deleteMany({});
      const deletedOrderItems = await tx.orderItem.deleteMany({});

      // 4. Delete table transfers
      const deletedTransfers = await tx.tableTransfer.deleteMany({});

      // 5. Delete orders
      const deletedOrders = await tx.order.deleteMany({});

      // 6. Delete print jobs
      const deletedPrintJobs = await tx.printJob.deleteMany({});

      // 7. Delete sales rollups
      await tx.dailySalesRollup.deleteMany({});
      await tx.itemSalesRollup.deleteMany({});

      // 8. Delete cashier shifts
      const deletedShifts = await tx.shift.deleteMany({});

      // 9. Reset all tables to free state
      await tx.tableMap.updateMany({
        data: {
          state: 'free',
        },
      });

      // 10. Clean order & shift related audit logs
      await tx.auditLog.deleteMany({
        where: {
          action: {
            in: [
              'order_created',
              'order_settled',
              'order_cancelled',
              'kot_created',
              'payment_received',
              'refund_processed',
              'shift_opened',
              'shift_closed',
            ],
          },
        },
      });

      // Handle Factory Reset specific cleanup
      let factoryResetApplied = false;
      if (type === 'factory_reset') {
        factoryResetApplied = true;

        // Clear existing License records in database so setup wizard can activate fresh
        await tx.license.deleteMany({});

        // Reset Outlets module settings
        await tx.outlet.updateMany({
          data: {
            settings: {
              modules: {
                businessType: 'cafe',
                enabledModules: ['core', 'cafe', 'inventory', 'customer_qr', 'waiter', 'kds'],
              },
            },
          },
        });

        // Reset installation.json on disk if present
        try {
          const isWindows = process.platform === 'win32';
          const programData = isWindows
            ? process.env.ProgramData || 'C:\\ProgramData'
            : path.join(process.env.HOME || '', '.config');
          const installDir = path.join(programData, 'ChayaOne', 'config');
          const installPath = path.join(installDir, 'installation.json');
          if (fs.existsSync(installPath)) {
            const data = JSON.parse(fs.readFileSync(installPath, 'utf-8'));
            data.status = 'UNCONFIGURED';
            data.licenseKey = null;
            data.isSetupRequired = true;
            fs.writeFileSync(installPath, JSON.stringify(data, null, 2), 'utf-8');
          }
        } catch (diskErr) {
          console.warn('Could not reset installation.json on disk:', diskErr);
        }
      }

      return {
        deletedOrders: deletedOrders.count,
        deletedPayments: deletedPayments.count,
        deletedRefunds: deletedRefunds.count,
        deletedKots: deletedKots.count,
        deletedOrderItems: deletedOrderItems.count,
        deletedTransfers: deletedTransfers.count,
        deletedPrintJobs: deletedPrintJobs.count,
        deletedShifts: deletedShifts.count,
        factoryResetApplied,
      };
    });

    return NextResponse.json({
      ok: true,
      message:
        type === 'factory_reset'
          ? 'Factory reset completed successfully. Transactional data removed and modules relocated.'
          : 'Transactional and billing data wiped successfully. Menu items, staff, and customer accounts preserved.',
      results,
      redirectTo: type === 'factory_reset' ? '/setup' : null,
    });
  } catch (error: any) {
    console.error('Developer reset error:', error);
    return NextResponse.json(
      { error: 'Failed to reset data', message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
