/**
 * Deterministic, strongly-typed cache key builders for the Owner Dashboard.
 * All keys are strictly scoped by tenantId and outletId to guarantee
 * complete isolation across organizations and branches.
 */

export interface CacheKeyScope {
  tenantId: string;
  outletId?: string | null;
}

export const CacheKeys = {
  context: (tenantId: string) => ({
    tenantId,
    outletId: null,
    dataType: 'context',
  }),

  dashboard: (scope: CacheKeyScope) => ({
    tenantId: scope.tenantId,
    outletId: scope.outletId ?? null,
    dataType: 'dashboard',
  }),

  sales: (scope: CacheKeyScope, queryParams?: string) => ({
    tenantId: scope.tenantId,
    outletId: scope.outletId ?? null,
    dataType: 'sales',
    suffix: queryParams,
  }),

  orders: (scope: CacheKeyScope, queryParams?: string) => ({
    tenantId: scope.tenantId,
    outletId: scope.outletId ?? null,
    dataType: 'orders',
    suffix: queryParams,
  }),

  products: (scope: CacheKeyScope) => ({
    tenantId: scope.tenantId,
    outletId: scope.outletId ?? null,
    dataType: 'products',
  }),

  inventory: (scope: CacheKeyScope) => ({
    tenantId: scope.tenantId,
    outletId: scope.outletId ?? null,
    dataType: 'inventory',
  }),

  expenses: (scope: CacheKeyScope, queryParams?: string) => ({
    tenantId: scope.tenantId,
    outletId: scope.outletId ?? null,
    dataType: 'expenses',
    suffix: queryParams,
  }),

  staff: (scope: CacheKeyScope) => ({
    tenantId: scope.tenantId,
    outletId: scope.outletId ?? null,
    dataType: 'staff',
  }),

  reports: (scope: CacheKeyScope, dateRangeKey?: string) => ({
    tenantId: scope.tenantId,
    outletId: scope.outletId ?? null,
    dataType: 'reports',
    suffix: dateRangeKey,
  }),

  stores: (tenantId: string) => ({
    tenantId,
    outletId: null,
    dataType: 'stores',
  }),

  shopStatus: (tenantId: string) => ({
    tenantId,
    outletId: null,
    dataType: 'shop-status',
  }),
};
