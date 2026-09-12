import { prisma } from '@/lib/db';
import type { OwnerContext, Organization, Store } from '@/types';
import type { OwnerSession } from '@/lib/auth';

/**
 * Resolve the full owner context for a session.
 * Returns the tenant (organization) and all outlets (stores) the user is
 * authorized to access, without trusting any client-supplied values.
 */
export async function resolveOwnerContext(session: OwnerSession): Promise<OwnerContext | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: {
      id: true,
      name: true,
      plan: true,
      gstin: true,
      status: true,
    },
  });

  if (!tenant) return null;

  const organization: Organization = {
    id:     tenant.id,
    name:   tenant.name,
    plan:   tenant.plan,
    gstin:  tenant.gstin,
    status: tenant.status,
  };

  // Determine store access
  const outletWhere = session.outletId === null
    ? { tenantId: session.tenantId }
    : { tenantId: session.tenantId, id: session.outletId };

  const outlets = await prisma.outlet.findMany({
    where: outletWhere,
    select: {
      id: true, tenantId: true, name: true, address: true,
      gstin: true, timezone: true, settings: true,
    },
    orderBy: { name: 'asc' },
  });

  const stores: Store[] = outlets.map((o) => ({
    id:       o.id,
    tenantId: o.tenantId,
    name:     o.name,
    address:  o.address,
    gstin:    o.gstin,
    timezone: o.timezone,
    settings: (o.settings as Record<string, unknown>) ?? {},
  }));

  return {
    user: {
      staffId:  session.staffId,
      id:       session.staffId,
      name:     session.name,
      role:     session.role,
      tenantId: session.tenantId,
      outletId: session.outletId,
    },
    organization,
    stores,
    hasAllStores: session.outletId === null,
  };
}
