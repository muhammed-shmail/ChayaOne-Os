/**
 * @cafeos/types — Pure TypeScript contracts for ChayaOne OS.
 * Zero runtime dependencies, instant compilation.
 */

export type StaffRole = 'owner' | 'manager' | 'cashier' | 'kitchen' | 'waiter' | 'accountant';

export type OrderType = 'dine_in' | 'takeaway' | 'delivery';
export type OrderStatus =
  | 'open'
  | 'pending_approval'
  | 'approved'
  | 'in_kitchen'
  | 'ready'
  | 'served'
  | 'settled'
  | 'cancelled';

export type OrderChannel = 'pos' | 'qr' | 'online';
export type KotStatus = 'queued' | 'preparing' | 'ready' | 'served' | 'void';
export type TableState = 'free' | 'seated' | 'billed';
export type PayMethod = 'cash' | 'card' | 'upi' | 'wallet' | 'points';
export type PayStatus = 'pending' | 'success' | 'failed' | 'refunded';

export interface ModifierOptionDto {
  id: string;
  name: string;
  pricePaise: number;
}

export interface ModifierGroupDto {
  id: string;
  name: string;
  min: number;
  max: number;
  options: ModifierOptionDto[];
}

export interface MenuItemDto {
  id: string;
  name: string;
  pricePaise: number;
  gstRate: number;
  station: string | null;
  tags: string[];
  modifierGroups?: ModifierGroupDto[];
}

export interface MenuCategoryDto {
  id: string;
  name: string;
  items: MenuItemDto[];
}

export interface TableItemDto {
  id: string;
  label: string;
  seats: number;
  state: TableState;
  floorId?: string | null;
}

export interface OccupancyInfoDto {
  number: number;
  sinceMs: number;
  billPaise: number;
  orders: number;
  status: string;
}

export interface TicketItem {
  name: string;
  qty: number;
  station: string | null;
  modifiers: { name: string }[];
  notes: string | null;
}

export interface Ticket {
  id: string;
  number: number;
  table: string;
  tableId: string | null;
  type: string;
  status: string;
  placedAt: number;
  customerName: string | null;
  items: TicketItem[];
}

export interface TableTransferPayload {
  orderId: string;
  orderNumber: number;
  fromTableId: string;
  toTableId: string;
  fromTableLabel: string;
  toTableLabel: string;
  newTableStatus: string;
  transferredBy: string | null;
  timestamp: number;
  reason?: string | null;
}

export interface TableMergePayload {
  sourceTableId: string;
  sourceTableLabel: string;
  destTableId: string;
  destTableLabel: string;
  destOrderId: string;
  destOrderNumber: number;
  mergedBy: string | null;
  timestamp: number;
}

export interface TableSplitPayload {
  originalTableId: string;
  originalTableLabel: string;
  originalOrderId: string;
  originalOrderNumber: number;
  newOrderId: string;
  newOrderNumber: number;
  newTableId?: string | null;
  newTableLabel?: string | null;
  splitBy: string | null;
  timestamp: number;
}

export interface WaiterCallPayload {
  tableId: string;
  tableLabel: string;
  requestType: 'call_waiter' | 'assistance' | 'water' | 'bill';
  notes?: string | null;
  at: number;
}

export interface NotifyPayload {
  id: string;
  type: string;
  severity: string;
  title: string;
  body: string | null;
  at: number;
  audience: string;
  targetRole?: string | null;
  targetStaffId?: string | null;
}

export type RealtimeEvent =
  | { type: 'order.new'; ticket: Ticket }
  | { type: 'order.updated'; ticket: Ticket }
  | { type: 'order.pending'; ticket: Ticket }
  | { type: 'table.transferred'; transfer: TableTransferPayload; ticket?: Ticket }
  | { type: 'table.merged'; merge: TableMergePayload; ticket?: Ticket }
  | { type: 'table.split'; split: TableSplitPayload; ticket?: Ticket }
  | { type: 'table.updated'; tableId: string; state: string }
  | { type: 'waiter.called'; request: WaiterCallPayload }
  | { type: 'bill.requested'; request: WaiterCallPayload }
  | { type: 'notify'; notification: NotifyPayload };

export interface BillFinancialsDto {
  subtotalPaise: number;
  discountPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  roundOffPaise: number;
  totalPaise: number;
  subtotalRupees: string;
  discountRupees: string;
  taxRupees: string;
  totalRupees: string;
}

export interface StaffSessionDto {
  staffId: string;
  name: string;
  role: StaffRole;
  outletId: string;
  tenantId: string;
}

export * from './modules';

export interface Store {
  id: string;
  name: string;
  code?: string;
  address?: any;
  phone?: string | null;
  email?: string | null;
  gstin?: string | null;
  isHub?: boolean;
  isActive?: boolean;
  timezone?: string;
  settings?: any;
  tenantId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Organization {
  id: string;
  name: string;
  slug?: string;
  plan?: string;
  status?: string;
  gstin?: string | null;
  createdAt?: string;
}

export interface OwnerContext {
  organization: Organization;
  stores: Store[];
  accessibleOutletIds?: string[];
  user?: any;
  hasAllStores?: boolean;
}

export interface ShopStatus {
  storeId: string;
  storeName: string;
  isOnline: boolean;
  lastHeartbeat: string | null;
  activeOrders: number;
  todaySalesPaise: number;
}

export interface TrendPoint {
  date: string;
  label: string;
  orders: number;
  grossPaise: number;
}

export interface TopItem {
  id?: string;
  name: string;
  qty: number;
  revenuePaise: number;
}

export interface StoreKpi {
  storeId?: string;
  storeName?: string;
  todaySalesPaise: number;
  todayOrders: number;
  aovPaise: number;
  footfall?: number;
  salesDeltaPct: number | null;
  ordersDeltaPct: number | null;
}

export interface OrganizationKpi {
  totalSalesPaise: number;
  totalOrders: number;
  aovPaise?: number;
  activeStoresCount?: number;
  totalStoresCount?: number;
  storesOnline?: number;
  storesTotal?: number;
  salesDeltaPct?: number | null;
  topStore?: { id: string; name: string; salesPaise: number } | null;
}

export interface DashboardData {
  mode?: 'store' | 'organization';
  kpi: StoreKpi | OrganizationKpi | any;
  trend: TrendPoint[];
  topItems: TopItem[] | any[];
  hourly?: number[];
  menuQuadrant?: any[];
  lowStock?: any[];
  loyalty?: any;
  briefing?: any[];
}

export interface DailySummary {
  date: string;
  orders: number;
  grossPaise: number;
  discountPaise: number;
  taxPaise: number;
}

export interface PaymentBreakdown {
  method: string;
  amountPaise: number;
  count: number;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface Sale {
  id: string;
  orderNumber: string;
  storeName: string;
  totalPaise: number;
  itemsCount: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
}

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  phone: string | null;
  employeeCode: string | null;
  isActive: boolean;
}

