import { prisma } from '@cafeos/db';
import { findOrCreateCustomerByPhone } from '../customer';

export class CustomerService {
  /**
   * Looks up customer by phone number.
   */
  static async findByPhone(tenantId: string, phone: string) {
    const cleanPhone = phone.trim();
    return await prisma.customer.findFirst({
      where: {
        tenantId,
        phone: { in: [cleanPhone, `+91${cleanPhone.replace(/^\+91/, '')}`] },
      },
      include: {
        orders: {
          orderBy: { placedAt: 'desc' },
          take: 5,
          select: { id: true, number: true, totalPaise: true, placedAt: true, status: true },
        },
      },
    });
  }

  /**
   * Finds or creates a customer account.
   */
  static async findOrCreate(tenantId: string, phone: string, name?: string | null) {
    return await findOrCreateCustomerByPhone(tenantId, { name, phone });
  }

  /**
   * Returns list of customers for an outlet/tenant.
   */
  static async listCustomers(tenantId: string, search?: string) {
    return await prisma.customer.findMany({
      where: {
        tenantId,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: { visitCount: 'desc' },
      take: 50,
    });
  }
}
