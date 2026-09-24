import type { StaffRole } from '@cafeos/db';

/**
 * Cafe OS — Role-Based Access Control & Permission Engine.
 *
 * Single source of truth for all roles, permissions, presets, capability checks,
 * and operational surface gating across the platform.
 */
export type Surface = 'dashboard' | 'pos' | 'kds' | 'approvals';

export const ROLE_LABELS: Record<StaffRole, string> = {
  owner: 'Admin (Owner)',
  manager: 'Administrator (Manager)',
  cashier: 'Cashier',
  waiter: 'Waiter',
  kitchen: 'Kitchen',
  accountant: 'Accountant',
};

export const ROLE_DESCRIPTIONS: Record<StaffRole, string> = {
  owner: 'Full access — dashboard, reports, settings, and staff management.',
  manager: 'Dashboard, inventory, suppliers, tables & reports. Manages floor staff.',
  cashier: 'Cashier dashboard, point of sale and kitchen display.',
  waiter: 'Point of sale and QR order approvals.',
  kitchen: 'Kitchen display only.',
  accountant: 'Financial reports, invoices, taxes, ledger and supplier payments.',
};

export function getRoleLabel(role: string): string {
  return (ROLE_LABELS as Record<string, string>)[role] || role;
}

export function getRoleDescription(role: string): string {
  return (ROLE_DESCRIPTIONS as Record<string, string>)[role] || 'Custom role with tailored permissions.';
}

/** Surface access mapping by base role */
export const ACCESS: Record<Surface, StaffRole[]> = {
  dashboard: ['owner', 'manager', 'cashier', 'accountant'],
  pos: ['owner', 'manager', 'cashier', 'waiter', 'accountant'],
  kds: ['owner', 'manager', 'cashier', 'kitchen'],
  approvals: ['owner', 'manager', 'cashier', 'waiter', 'kitchen', 'accountant'],
};

export const ALL_ROLES: StaffRole[] = ['owner', 'manager', 'cashier', 'waiter', 'kitchen', 'accountant'];

export interface PermissionItem {
  key: string;
  label: string;
  actions: ('view' | 'create' | 'edit' | 'delete' | 'approve' | 'export' | 'print')[];
}

export const PERMISSION_MODULES: { category: string; permissions: PermissionItem[] }[] = [
  {
    category: '1. Dashboard',
    permissions: [
      { key: 'dashboard:view', label: 'View Dashboard', actions: ['view'] },
      { key: 'dashboard:kpis', label: 'View KPIs', actions: ['view'] },
      { key: 'dashboard:sales_summary', label: 'View Sales Summary', actions: ['view'] },
      { key: 'dashboard:financial_summary', label: 'View Financial Summary', actions: ['view'] },
    ],
  },
  {
    category: '2. POS',
    permissions: [
      { key: 'pos:open', label: 'Open POS', actions: ['view'] },
      { key: 'pos:t_billing', label: 'T-Billing', actions: ['view'] },
      { key: 'pos:create_bill', label: 'Create Bill', actions: ['create'] },
      { key: 'pos:edit_bill', label: 'Edit Bill', actions: ['edit'] },
      { key: 'pos:hold_bill', label: 'Hold Bill', actions: ['create'] },
      { key: 'pos:recall_bill', label: 'Recall Bill', actions: ['view'] },
      { key: 'pos:split_bill', label: 'Split Bill', actions: ['edit'] },
      { key: 'pos:merge_tables', label: 'Merge Tables', actions: ['edit'] },
      { key: 'pos:transfer_table', label: 'Transfer Table', actions: ['edit'] },
      { key: 'pos:apply_discount', label: 'Apply Discount', actions: ['create'] },
      { key: 'pos:apply_manual_discount', label: 'Apply Manual Discount', actions: ['create'] },
      { key: 'pos:cancel_item', label: 'Cancel Item', actions: ['delete'] },
      { key: 'pos:void_bill', label: 'Void Bill', actions: ['delete'] },
      { key: 'pos:refund_bill', label: 'Refund Bill', actions: ['delete'] },
      { key: 'pos:reprint_bill', label: 'Reprint Bill', actions: ['print'] },
      { key: 'pos:print_kot', label: 'Print KOT', actions: ['print'] },
      { key: 'pos:open_cash_drawer', label: 'Open Cash Drawer', actions: ['approve'] },
      { key: 'pos:close_shift', label: 'Close Shift', actions: ['edit'] },
      { key: 'pos:view_shift_history', label: 'View Shift History', actions: ['view'] },
    ],
  },
  {
    category: '3. Orders',
    permissions: [
      { key: 'orders:view', label: 'View Orders', actions: ['view'] },
      { key: 'orders:edit', label: 'Edit Orders', actions: ['edit'] },
      { key: 'orders:cancel', label: 'Cancel Orders', actions: ['delete'] },
      { key: 'orders:create', label: 'Create Orders', actions: ['create'] },
      { key: 'orders:delivery', label: 'Delivery Orders', actions: ['view', 'edit'] },
      { key: 'orders:online', label: 'Online Orders', actions: ['view', 'edit'] },
      { key: 'orders:takeaway', label: 'Takeaway Orders', actions: ['view', 'edit'] },
    ],
  },
  {
    category: '4. Kitchen',
    permissions: [
      { key: 'kds:view', label: 'View KDS', actions: ['view'] },
      { key: 'kds:accept', label: 'Accept Order', actions: ['edit'] },
      { key: 'kds:complete', label: 'Complete Order', actions: ['edit'] },
      { key: 'kds:recall', label: 'Recall Order', actions: ['edit'] },
      { key: 'kds:print_ticket', label: 'Print Kitchen Ticket', actions: ['print'] },
      { key: 'kds:manage_queue', label: 'Manage Queue', actions: ['edit'] },
    ],
  },
  {
    category: '5. Tables',
    permissions: [
      { key: 'tables:view', label: 'View Tables', actions: ['view'] },
      { key: 'tables:merge', label: 'Merge Tables', actions: ['edit'] },
      { key: 'tables:transfer', label: 'Transfer Tables', actions: ['edit'] },
      { key: 'tables:reserve', label: 'Reserve Table', actions: ['create'] },
      { key: 'tables:edit_reservations', label: 'Edit Reservations', actions: ['edit'] },
    ],
  },
  {
    category: '6. Customers',
    permissions: [
      { key: 'customers:view', label: 'View Customers', actions: ['view'] },
      { key: 'customers:create', label: 'Create Customers', actions: ['create'] },
      { key: 'customers:edit', label: 'Edit Customers', actions: ['edit'] },
      { key: 'customers:delete', label: 'Delete Customers', actions: ['delete'] },
      { key: 'customers:loyalty', label: 'Loyalty Management', actions: ['edit'] },
      { key: 'customers:wallet', label: 'Wallet Management', actions: ['edit'] },
      { key: 'customers:membership', label: 'Membership Management', actions: ['edit'] },
    ],
  },
  {
    category: '7. Inventory',
    permissions: [
      { key: 'inventory:view', label: 'View Stock', actions: ['view'] },
      { key: 'inventory:create', label: 'Create Item', actions: ['create'] },
      { key: 'inventory:edit', label: 'Edit Item', actions: ['edit'] },
      { key: 'inventory:delete', label: 'Delete Item', actions: ['delete'] },
      { key: 'inventory:adjust', label: 'Stock Adjustment', actions: ['edit'] },
      { key: 'inventory:waste', label: 'Waste Entry', actions: ['create'] },
      { key: 'inventory:recipes', label: 'Recipe Management', actions: ['edit'] },
      { key: 'inventory:reports', label: 'Inventory Reports', actions: ['view'] },
    ],
  },
  {
    category: '8. Purchases',
    permissions: [
      { key: 'purchases:orders', label: 'Purchase Orders', actions: ['view', 'create', 'edit'] },
      { key: 'purchases:suppliers', label: 'Suppliers', actions: ['view', 'create', 'edit'] },
      { key: 'purchases:received', label: 'Goods Received', actions: ['create'] },
      { key: 'purchases:invoices', label: 'Invoices', actions: ['view', 'create'] },
      { key: 'purchases:returns', label: 'Returns', actions: ['create'] },
      { key: 'purchases:approve', label: 'Approve Purchase', actions: ['approve'] },
    ],
  },
  {
    category: '9. Expenses',
    permissions: [
      { key: 'expenses:view', label: 'View Expenses', actions: ['view'] },
      { key: 'expenses:create', label: 'Add Expense', actions: ['create'] },
      { key: 'expenses:edit', label: 'Edit Expense', actions: ['edit'] },
      { key: 'expenses:delete', label: 'Delete Expense', actions: ['delete'] },
      { key: 'expenses:approve', label: 'Approve Expense', actions: ['approve'] },
    ],
  },
  {
    category: '10. Finance',
    permissions: [
      { key: 'finance:cash_flow', label: 'Cash Flow', actions: ['view'] },
      { key: 'finance:income', label: 'Income', actions: ['view'] },
      { key: 'finance:profit', label: 'Profit', actions: ['view'] },
      { key: 'finance:loss', label: 'Loss', actions: ['view'] },
      { key: 'finance:daily_summary', label: 'Daily Summary', actions: ['view'] },
      { key: 'finance:day_closing', label: 'Day Closing', actions: ['view', 'create', 'edit', 'approve'] },
      { key: 'finance:cash_reconcile', label: 'Cash Reconciliation & Verification', actions: ['view', 'edit', 'approve'] },
      { key: 'finance:tax_summary', label: 'Tax Summary', actions: ['view'] },
      { key: 'finance:gst_reports', label: 'GST Reports', actions: ['view', 'export'] },
      { key: 'finance:pl', label: 'Profit & Loss', actions: ['view'] },
      { key: 'finance:balance_sheet', label: 'Balance Sheet', actions: ['view'] },
    ],
  },
  {
    category: '11. Reports',
    permissions: [
      { key: 'reports:sales', label: 'Sales Reports', actions: ['view'] },
      { key: 'reports:products', label: 'Product Reports', actions: ['view'] },
      { key: 'reports:customers', label: 'Customer Reports', actions: ['view'] },
      { key: 'reports:employee', label: 'Employee Reports', actions: ['view'] },
      { key: 'reports:inventory', label: 'Inventory Reports', actions: ['view'] },
      { key: 'reports:financial', label: 'Financial Reports', actions: ['view'] },
      { key: 'reports:export_csv', label: 'Export CSV', actions: ['export'] },
      { key: 'reports:export_excel', label: 'Export Excel', actions: ['export'] },
      { key: 'reports:print', label: 'Print Reports', actions: ['print'] },
    ],
  },
  {
    category: '12. Menu Management',
    permissions: [
      { key: 'menu:view', label: 'View Menu', actions: ['view'] },
      { key: 'menu:create', label: 'Add Menu Item', actions: ['create'] },
      { key: 'menu:edit', label: 'Edit Menu', actions: ['edit'] },
      { key: 'menu:delete', label: 'Delete Menu', actions: ['delete'] },
      { key: 'menu:categories', label: 'Category Management', actions: ['edit'] },
      { key: 'menu:modifiers', label: 'Modifier Management', actions: ['edit'] },
      { key: 'menu:combos', label: 'Combo Management', actions: ['edit'] },
      { key: 'menu:pricing', label: 'Pricing Management', actions: ['edit'] },
    ],
  },
  {
    category: '13. Promotions',
    permissions: [
      { key: 'promotions:coupons', label: 'Coupons', actions: ['view', 'create', 'edit'] },
      { key: 'promotions:offers', label: 'Offers', actions: ['view', 'create'] },
      { key: 'promotions:rules', label: 'Discount Rules', actions: ['create', 'edit'] },
      { key: 'promotions:loyalty_campaigns', label: 'Loyalty Campaigns', actions: ['create'] },
      { key: 'promotions:happy_hour', label: 'Happy Hour', actions: ['create', 'edit'] },
    ],
  },
  {
    category: '14. Staff',
    permissions: [
      { key: 'staff:view', label: 'View Staff', actions: ['view'] },
      { key: 'staff:create', label: 'Create Staff', actions: ['create'] },
      { key: 'staff:edit', label: 'Edit Staff', actions: ['edit'] },
      { key: 'staff:delete', label: 'Delete Staff', actions: ['delete'] },
      { key: 'staff:attendance', label: 'Attendance', actions: ['view', 'edit'] },
      { key: 'staff:payroll', label: 'Payroll', actions: ['view', 'edit', 'approve'] },
      { key: 'staff:scheduling', label: 'Shift Scheduling', actions: ['view', 'edit'] },
    ],
  },
  {
    category: '15. Branch Management',
    permissions: [
      { key: 'branches:view', label: 'View Branches', actions: ['view'] },
      { key: 'branches:create', label: 'Create Branch', actions: ['create'] },
      { key: 'branches:edit', label: 'Edit Branch', actions: ['edit'] },
      { key: 'branches:delete', label: 'Delete Branch', actions: ['delete'] },
      { key: 'branches:transfer', label: 'Transfer Stock', actions: ['create', 'approve'] },
      { key: 'branches:cross_reports', label: 'Cross Branch Reports', actions: ['view', 'export'] },
    ],
  },
  {
    category: '16. Integrations',
    permissions: [
      { key: 'integrations:printers', label: 'Printer Settings', actions: ['view', 'edit'] },
      { key: 'integrations:payment_gateway', label: 'Payment Gateway', actions: ['edit'] },
      { key: 'integrations:whatsapp', label: 'WhatsApp', actions: ['edit'] },
      { key: 'integrations:sms', label: 'SMS', actions: ['edit'] },
      { key: 'integrations:email', label: 'Email', actions: ['edit'] },
      { key: 'integrations:api_keys', label: 'API Keys', actions: ['create', 'delete'] },
      { key: 'integrations:apps', label: 'Third-party Apps', actions: ['view', 'edit'] },
    ],
  },
  {
    category: '17. Settings',
    permissions: [
      { key: 'settings:general', label: 'General Settings', actions: ['view', 'edit'] },
      { key: 'settings:tax', label: 'Tax Settings', actions: ['view', 'edit'] },
      { key: 'settings:billing', label: 'Billing Settings', actions: ['view', 'edit'] },
      { key: 'settings:kitchen', label: 'Kitchen Settings', actions: ['view', 'edit'] },
      { key: 'settings:printers', label: 'Printer Settings', actions: ['view', 'edit'] },
      { key: 'settings:pos', label: 'POS Settings', actions: ['view', 'edit'] },
      { key: 'settings:security', label: 'Security Settings', actions: ['view', 'edit'] },
      { key: 'settings:permissions', label: 'Permission Settings', actions: ['view', 'edit'] },
      { key: 'settings:backup', label: 'Backup', actions: ['create'] },
      { key: 'settings:restore', label: 'Restore', actions: ['approve'] },
    ],
  },
  {
    category: '18. Owner Only',
    permissions: [
      { key: 'owner:subscription', label: 'Subscription', actions: ['view', 'edit'] },
      { key: 'owner:billing', label: 'Billing', actions: ['view'] },
      { key: 'owner:upgrade', label: 'Plan Upgrade', actions: ['edit'] },
      { key: 'owner:license', label: 'License', actions: ['view', 'edit'] },
      { key: 'owner:delete_restaurant', label: 'Delete Restaurant', actions: ['delete'] },
      { key: 'owner:danger_zone', label: 'Danger Zone', actions: ['delete', 'approve'] },
    ],
  },
];

export const PRESETS: Record<string, string[]> = {
  owner: PERMISSION_MODULES.flatMap((cat) => cat.permissions.flatMap((p) => p.actions.map((act) => `${p.key}:${act}`))),
  admin: PERMISSION_MODULES.flatMap((cat) =>
    cat.permissions.flatMap((p) => {
      if (cat.category.includes('18. Owner Only')) return [];
      return p.actions.map((act) => `${p.key}:${act}`);
    }),
  ),
  manager: [
    ...PERMISSION_MODULES.flatMap((cat) => {
      if (['10. Finance', '15. Branch Management', '16. Integrations', '17. Settings', '18. Owner Only'].some((term) => cat.category.includes(term))) return [];
      return cat.permissions.flatMap((p) => p.actions.map((act) => `${p.key}:${act}`));
    }),
    'staff:view:view',
    'staff:attendance:view',
    'staff:attendance:edit',
    'staff:scheduling:view',
    'staff:scheduling:edit',
    'finance:day_closing:view',
    'finance:day_closing:create',
    'finance:day_closing:edit',
    'finance:day_closing:approve',
    'finance:cash_reconcile:view',
    'finance:cash_reconcile:edit',
    'finance:cash_reconcile:approve',
    'finance:daily_summary:view',
    'finance:cash_flow:view',
  ],
  cashier: [
    'pos:open:view',
    'pos:t_billing:view',
    'pos:create_bill:create',
    'pos:edit_bill:edit',
    'pos:hold_bill:create',
    'pos:recall_bill:view',
    'pos:reprint_bill:print',
    'pos:print_kot:print',
    'pos:close_shift:edit',
    'pos:view_shift_history:view',
    'orders:view:view',
    'orders:create:create',
    'orders:takeaway:view',
    'orders:takeaway:edit',
    'kds:view:view',
    'tables:view:view',
    'customers:view:view',
    'customers:create:create',
  ],
  accountant: [
    ...PERMISSION_MODULES.flatMap((cat) => {
      if (cat.category.includes('10. Finance') || cat.category.includes('9. Expenses') || cat.category.includes('11. Reports')) {
        return cat.permissions.flatMap((p) => p.actions.map((act) => `${p.key}:${act}`));
      }
      return [];
    }),
    'dashboard:view:view',
    'dashboard:kpis:view',
    'dashboard:financial_summary:view',
    'staff:payroll:view',
    'staff:payroll:edit',
  ],
  waiter: [
    'pos:open:view',
    'pos:t_billing:view',
    'pos:create_bill:create',
    'pos:hold_bill:create',
    'pos:recall_bill:view',
    'pos:print_kot:print',
    'orders:view:view',
    'orders:create:create',
    'tables:view:view',
    'tables:reserve:create',
    'customers:view:view',
    'customers:create:create',
  ],
  kitchen: ['kds:view:view', 'kds:accept:edit', 'kds:complete:edit', 'kds:recall:edit', 'kds:print_ticket:print', 'kds:manage_queue:edit'],
  delivery: ['orders:view:view', 'orders:delivery:view', 'orders:delivery:edit'],
  inventory: [
    ...PERMISSION_MODULES.flatMap((cat) => {
      if (cat.category.includes('7. Inventory') || cat.category.includes('8. Purchases')) {
        return cat.permissions.flatMap((p) => p.actions.map((act) => `${p.key}:${act}`));
      }
      return [];
    }),
  ],
};

/** Unified Staff Subject for permission and role queries */
export type StaffSubject =
  | {
      role?: string;
      roles?: string[];
      permissions?: any;
      effectivePermissions?: string[];
    }
  | string
  | null
  | undefined;

/**
 * Resolves all effective roles held by a staff subject.
 * Incorporates primary role, explicit roles array, and `permissions.assignedRoles`.
 */
export function getEffectiveRoles(subject: StaffSubject): StaffRole[] {
  if (!subject) return [];
  if (typeof subject === 'string') {
    return (ALL_ROLES as string[]).includes(subject) ? [subject as StaffRole] : [];
  }

  const set = new Set<StaffRole>();
  if (subject.role && (ALL_ROLES as string[]).includes(subject.role)) {
    set.add(subject.role as StaffRole);
  }
  if (Array.isArray(subject.roles)) {
    for (const r of subject.roles) {
      if (r && (ALL_ROLES as string[]).includes(r)) {
        set.add(r as StaffRole);
      }
    }
  }

  const perms = subject.permissions;
  if (perms) {
    if (typeof perms === 'object' && Array.isArray(perms.assignedRoles)) {
      for (const r of perms.assignedRoles) {
        if (r && (ALL_ROLES as string[]).includes(r)) {
          set.add(r as StaffRole);
        }
      }
    } else if (typeof perms === 'string') {
      try {
        const parsed = JSON.parse(perms);
        if (Array.isArray(parsed?.assignedRoles)) {
          for (const r of parsed.assignedRoles) {
            if (r && (ALL_ROLES as string[]).includes(r)) {
              set.add(r as StaffRole);
            }
          }
        }
      } catch {}
    }
  }

  return Array.from(set);
}

/**
 * Resolves the primary role among assigned roles using hierarchical priority:
 * owner > manager > cashier > accountant > waiter > kitchen.
 */
export function resolvePrimaryRole(assignedRoles: string[], fallbackRole?: string): StaffRole {
  const PRIORITY: StaffRole[] = ['owner', 'manager', 'cashier', 'accountant', 'waiter', 'kitchen'];
  for (const p of PRIORITY) {
    if (assignedRoles.includes(p)) return p;
  }
  if (fallbackRole && (ALL_ROLES as string[]).includes(fallbackRole)) {
    return fallbackRole as StaffRole;
  }
  return (assignedRoles[0] as StaffRole) || 'waiter';
}

/**
 * Compiles the complete list of effective permission strings for a staff subject.
 * Merges presets for all assigned roles and applies positive/negative overrides.
 */
export function getEffectivePermissions(subject: StaffSubject): string[] {
  if (!subject) return [];
  if (typeof subject === 'object' && Array.isArray(subject.effectivePermissions) && subject.effectivePermissions.length > 0) {
    return subject.effectivePermissions;
  }

  const roles = getEffectiveRoles(subject);
  const perms = new Set<string>();

  // If owner, grant all permissions
  if (roles.includes('owner')) {
    for (const p of PRESETS.owner || []) perms.add(p);
    return Array.from(perms);
  }

  // Add presets for each assigned role
  for (const r of roles) {
    const list = PRESETS[r] || [];
    for (const p of list) perms.add(p);
  }

  // Parse overrides if present
  let overrides: Record<string, boolean> | null = null;
  if (typeof subject === 'object' && subject.permissions) {
    if (typeof subject.permissions === 'object' && subject.permissions.overrides) {
      overrides = subject.permissions.overrides;
    } else if (typeof subject.permissions === 'string') {
      try {
        const parsed = JSON.parse(subject.permissions);
        if (parsed?.overrides) overrides = parsed.overrides;
      } catch {}
    }
  }

  if (overrides) {
    for (const [k, v] of Object.entries(overrides)) {
      if (v === true) perms.add(k);
      else if (v === false) perms.delete(k);
    }
  }

  return Array.from(perms);
}

/**
 * Checks if a staff subject possesses any of the required roles.
 * Owners automatically pass role checks.
 */
export function hasRole(subject: StaffSubject, requiredRoles: StaffRole | StaffRole[] | string | string[]): boolean {
  const roles = getEffectiveRoles(subject);
  if (roles.includes('owner')) return true;

  const targetList = (Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles]) as string[];
  return targetList.some((r) => roles.includes(r as StaffRole));
}

/**
 * Checks if a staff subject has a specific permission key.
 * Supports exact match or prefix match (e.g. 'pos:void_bill' matches 'pos:void_bill:delete').
 */
export function hasPermission(subject: StaffSubject, permissionKey: string): boolean {
  const roles = getEffectiveRoles(subject);
  if (roles.includes('owner')) return true;

  const eff = getEffectivePermissions(subject);
  return eff.includes(permissionKey) || eff.some((p) => p === permissionKey || p.startsWith(`${permissionKey}:`));
}

/**
 * Gate check for operational surfaces ('dashboard' | 'pos' | 'kds' | 'approvals').
 * Checks role-level access and permission-level overrides.
 */
export function canAccess(subject: StaffSubject, surface: Surface): boolean {
  if (!subject) return false;
  if (typeof subject === 'string') {
    return (ACCESS[surface] as string[]).includes(subject);
  }

  const roles = getEffectiveRoles(subject);
  if (roles.includes('owner')) return true;
  if (roles.some((r) => (ACCESS[surface] as string[]).includes(r))) return true;

  // Granular capability overrides per surface
  if (surface === 'pos' && hasPermission(subject, 'pos:open')) return true;
  if (surface === 'kds' && hasPermission(subject, 'kds:view')) return true;
  if (surface === 'dashboard' && hasPermission(subject, 'dashboard:view')) return true;
  if (surface === 'approvals' && (hasPermission(subject, 'orders:view') || hasPermission(subject, 'pos:open'))) return true;

  return false;
}

/** Where to send a staff subject after login or when attempting an unauthorized route. */
export function landingFor(subject: StaffSubject): string {
  if (canAccess(subject, 'dashboard')) return '/dashboard';
  if (canAccess(subject, 'pos')) return '/pos';
  if (canAccess(subject, 'kds')) return '/kds';
  return '/login';
}

// ---------------- Detailed Operational Capability Helpers ----------------

export function canSettle(subject: StaffSubject): boolean {
  return (
    hasRole(subject, ['owner', 'manager', 'cashier']) ||
    hasPermission(subject, 'pos:create_bill') ||
    hasPermission(subject, 'pos:edit_bill') ||
    hasPermission(subject, 'pos:reprint_bill')
  );
}

export function canVoid(subject: StaffSubject): boolean {
  return (
    hasRole(subject, ['owner', 'manager', 'cashier']) ||
    hasPermission(subject, 'pos:cancel_item') ||
    hasPermission(subject, 'pos:void_bill')
  );
}

export function canDiscount(subject: StaffSubject): boolean {
  return (
    hasRole(subject, ['owner', 'manager']) ||
    hasPermission(subject, 'pos:apply_discount') ||
    hasPermission(subject, 'pos:apply_manual_discount')
  );
}

export function canTransfer(subject: StaffSubject): boolean {
  return (
    hasRole(subject, ['owner', 'manager', 'cashier', 'waiter']) ||
    hasPermission(subject, 'tables:transfer') ||
    hasPermission(subject, 'pos:transfer_table')
  );
}

export function canSplit(subject: StaffSubject): boolean {
  return hasRole(subject, ['owner', 'manager', 'cashier']) || hasPermission(subject, 'pos:split_bill');
}

export function canMerge(subject: StaffSubject): boolean {
  return (
    hasRole(subject, ['owner', 'manager', 'cashier']) ||
    hasPermission(subject, 'tables:merge') ||
    hasPermission(subject, 'pos:merge_tables')
  );
}

export function canApprove(subject: StaffSubject): boolean {
  return (
    hasRole(subject, ['owner', 'manager', 'cashier', 'waiter']) ||
    hasPermission(subject, 'orders:edit') ||
    hasPermission(subject, 'orders:view')
  );
}

export function canManageStaff(subject: StaffSubject): boolean {
  return (
    hasRole(subject, ['owner', 'manager']) ||
    hasPermission(subject, 'staff:edit') ||
    hasPermission(subject, 'staff:create')
  );
}

/** Roles an actor is allowed to assign/create. Managers can't mint owners/managers. */
export function assignableRoles(actorSubject: StaffSubject): StaffRole[] {
  if (hasRole(actorSubject, 'owner')) return ['owner', 'manager', 'cashier', 'waiter', 'kitchen', 'accountant'];
  if (hasRole(actorSubject, 'manager')) return ['cashier', 'waiter', 'kitchen', 'accountant'];
  return [];
}

/** Whether `actor` may edit/deactivate a user who currently holds `targetRole`. */
export function canManageTarget(actorSubject: StaffSubject, targetRole: string): boolean {
  if (hasRole(actorSubject, 'owner')) return true;
  if (hasRole(actorSubject, 'manager')) return ['cashier', 'waiter', 'kitchen', 'accountant'].includes(targetRole);
  return false;
}

/**
 * Reminder visibility:
 * Strictly restricted to Owner and Manager by default.
 * Cashier only if explicitly permitted (e.g. notifications:view or dashboard:view).
 * Waiters and Kitchen staff do NOT receive reminders.
 */
export function canViewReminders(subject: StaffSubject): boolean {
  if (hasRole(subject, ['owner', 'manager'])) return true;
  if (hasRole(subject, ['waiter', 'kitchen']) && !hasRole(subject, ['owner', 'manager', 'cashier'])) {
    return false;
  }
  return hasPermission(subject, 'notifications:view') || hasPermission(subject, 'dashboard:view');
}

/** Check if subject has authority to view/start/reconcile day closing */
export function canManageDayClosing(subject: StaffSubject): boolean {
  if (hasRole(subject, ['owner', 'manager'])) return true;
  return (
    hasPermission(subject, 'finance:day_closing:approve') ||
    hasPermission(subject, 'finance:day_closing:edit') ||
    hasPermission(subject, 'finance.day_close')
  );
}

/** Check if subject has authority to confirm final day closing or reopen */
export function canCloseDay(subject: StaffSubject): boolean {
  if (hasRole(subject, ['owner', 'manager'])) return true;
  return (
    hasPermission(subject, 'finance:day_closing:approve') ||
    hasPermission(subject, 'finance.day_close')
  );
}

