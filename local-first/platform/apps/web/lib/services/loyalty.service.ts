import { prisma } from '@cafeos/db';
import { accrueLoyaltyOnSettle } from '../customer';
import { getOutletPwa } from '../pwa';

export class LoyaltyService {
  /**
   * Accrues points on bill settlement.
   */
  static async accrueOnSettle(
    tx: any,
    customerId: string,
    outletId: string,
    totalPaise: number,
    orderId: string
  ) {
    const pwa = await getOutletPwa(outletId);
    return await accrueLoyaltyOnSettle(tx, {
      customerId,
      outletId,
      totalPaise,
      pwa,
      refId: orderId,
    });
  }

  /**
   * Returns loyalty points balance and ledger transactions for a customer.
   */
  static async getBalanceAndHistory(customerId: string) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        name: true,
        phone: true,
        points: true,
        tier: true,
        lifetimeSpendPaise: true,
        visitCount: true,
      },
    });

    if (!customer) return null;

    const ledger = await prisma.loyaltyLedger.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      customer,
      ledger,
    };
  }
}
