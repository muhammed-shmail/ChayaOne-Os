'use client';

import { useState, useEffect } from 'react';
import { formatINR } from '@cafeos/core';
import type { StaffRole } from '@cafeos/db';
import { ROLE_LABELS, ALL_ROLES } from '@/lib/rbac';

interface CustomSelectOption {
  value: string;
  label: string;
}

function CustomSelect({
  value,
  onChange,
  options,
  label
}: {
  value: string;
  onChange: (val: string) => void;
  options: CustomSelectOption[];
  label?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = () => setIsOpen(false);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [isOpen]);

  const selectedOption = options.find(opt => opt.value === value) || options[0];

  return (
    <div className="relative w-full" onClick={(e) => e.stopPropagation()}>
      {label && <label className="block text-xs font-semibold mb-1 text-ink-2">{label}</label>}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 rounded-lg bg-paper-3 border border-line text-ink text-left text-xs capitalize flex justify-between items-center transition-all hover:bg-paper-3/80 focus:outline-none focus:border-turmeric min-h-[36px]"
      >
        <span>{selectedOption?.label}</span>
        <span className="text-[10px] text-ink-3 transition-transform duration-200" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0)' }}>
          ▼
        </span>
      </button>

      {isOpen && (
        <ul
          className="absolute left-0 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border border-line z-50 shadow-lg select-scrollbar py-1"
          style={{ background: 'var(--paper-2)' }}
        >
          {options.map((opt) => (
            <li
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`px-3 py-2 text-xs cursor-pointer capitalize transition-all flex items-center justify-between ${
                opt.value === value
                  ? 'bg-turmeric text-[#2A1607] font-semibold'
                  : 'text-ink-2 hover:bg-line/20 hover:text-ink'
              }`}
            >
              <span>{opt.label}</span>
              {opt.value === value && <span className="text-[10px]">✓</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


// Let's define the 18 permission modules and their respective actions
interface PermissionItem {
  key: string;
  label: string;
  actions: ('view' | 'create' | 'edit' | 'delete' | 'approve' | 'export' | 'print')[];
}

const PERMISSION_MODULES: { category: string; permissions: PermissionItem[] }[] = [
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

// Reusable permission presets
const PRESETS: Record<string, string[]> = {
  owner: PERMISSION_MODULES.flatMap(cat => cat.permissions.flatMap(p => p.actions.map(act => `${p.key}:${act}`))),
  admin: PERMISSION_MODULES.flatMap(cat => cat.permissions.flatMap(p => {
    if (cat.category.includes('18. Owner Only')) return [];
    return p.actions.map(act => `${p.key}:${act}`);
  })),
  manager: [
    ...PERMISSION_MODULES.flatMap(cat => {
      if (['10. Finance', '15. Branch Management', '16. Integrations', '17. Settings', '18. Owner Only'].some(term => cat.category.includes(term))) return [];
      return cat.permissions.flatMap(p => p.actions.map(act => `${p.key}:${act}`));
    }),
    'staff:view:view', 'staff:attendance:view', 'staff:attendance:edit', 'staff:scheduling:view', 'staff:scheduling:edit'
  ],
  cashier: [
    'pos:open:view', 'pos:create_bill:create', 'pos:edit_bill:edit', 'pos:hold_bill:create', 'pos:recall_bill:view',
    'pos:reprint_bill:print', 'pos:print_kot:print', 'pos:close_shift:edit', 'pos:view_shift_history:view',
    'orders:view:view', 'orders:create:create', 'orders:takeaway:view', 'orders:takeaway:edit',
    'kds:view:view', 'tables:view:view', 'customers:view:view', 'customers:create:create'
  ],
  accountant: [
    ...PERMISSION_MODULES.flatMap(cat => {
      if (cat.category.includes('10. Finance') || cat.category.includes('9. Expenses') || cat.category.includes('11. Reports')) {
        return cat.permissions.flatMap(p => p.actions.map(act => `${p.key}:${act}`));
      }
      return [];
    }),
    'dashboard:view:view', 'dashboard:kpis:view', 'dashboard:financial_summary:view', 'staff:payroll:view', 'staff:payroll:edit'
  ],
  waiter: [
    'pos:open:view', 'pos:create_bill:create', 'pos:hold_bill:create', 'pos:recall_bill:view', 'pos:print_kot:print',
    'orders:view:view', 'orders:create:create', 'tables:view:view', 'tables:reserve:create',
    'customers:view:view', 'customers:create:create'
  ],
  kitchen: [
    'kds:view:view', 'kds:accept:edit', 'kds:complete:edit', 'kds:recall:edit', 'kds:print_ticket:print', 'kds:manage_queue:edit'
  ],
  delivery: [
    'orders:view:view', 'orders:delivery:view', 'orders:delivery:edit'
  ],
  inventory: [
    ...PERMISSION_MODULES.flatMap(cat => {
      if (cat.category.includes('7. Inventory') || cat.category.includes('8. Purchases')) {
        return cat.permissions.flatMap(p => p.actions.map(act => `${p.key}:${act}`));
      }
      return [];
    })
  ]
};

const DATA_RESTRICTION_OPTIONS = [
  { key: 'own_sales', label: 'View only own sales' },
  { key: 'own_shift', label: 'View own shift logs' },
  { key: 'assigned_tables', label: 'View assigned tables only' },
  { key: 'assigned_branch', label: 'View assigned branch only' },
  { key: 'all_branches', label: 'View all branches' },
  { key: 'today_reports', label: 'View only today\'s reports' },
  { key: 'finance_reports_only', label: 'View financial reports only' }
];

const BRANCH_OPTIONS = [
  { id: 'main-branch', name: 'Main Branch' },
  { id: 'beach-branch', name: 'Beach Branch' },
  { id: 'airport-branch', name: 'Airport Branch' }
];

const INITIAL_AUDIT_LOGS = [
  { who: 'Sarah Jenkins', action: 'Modified Permissions', target: 'Rahul Sharma (void bill added)', branch: 'Main Branch', timestamp: '2026-07-25 15:10', device: 'Chrome (Win10) · 103.45.2.1' },
  { who: 'Rahul Sharma', action: 'Session Revoked', target: 'Device Logged Out', branch: 'Beach Branch', timestamp: '2026-07-25 14:02', device: 'POS Terminal · 192.168.1.5' },
  { who: 'System', action: 'Failed Login', target: 'PIN Error (3 attempts)', branch: 'Airport Branch', timestamp: '2026-07-25 11:45', device: 'iPad POS 2 · 192.168.2.12' },
  { who: 'Sarah Jenkins', action: 'Created Staff Member', target: 'Priya Nair', branch: 'Main Branch', timestamp: '2026-07-25 09:30', device: 'Safari (macOS) · 103.45.2.1' }
];

export default function StaffRBACManagement({ d, refresh }: { d: any; refresh: () => void }) {
  const [activeSubTab, setActiveSubTab] = useState<'directory' | 'permissions' | 'audit'>('directory');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  
  // Selected staff user for detail views
  const [selectedStaff, setSelectedStaff] = useState<any | null>(null);
  
  // Permissions & configurations state for editing
  const [assignedRoles, setAssignedRoles] = useState<string[]>([]);
  const [branchAccess, setBranchAccess] = useState<string[]>([]);
  const [customPermissions, setCustomPermissions] = useState<string[]>([]);
  const [dataRestrictions, setDataRestrictions] = useState<string[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(PERMISSION_MODULES.map(c => c.category));
  const [permissionFilter, setPermissionFilter] = useState('');
  const [loginMethod, setLoginMethod] = useState<'pin' | 'password'>('pin');

  // UI state indicators
  const [isModified, setIsModified] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Form states for creating staff
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffCode, setNewStaffCode] = useState('');
  const [newStaffPin, setNewStaffPin] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');

  // Local copy of members with nested metadata parsing
  const [membersList, setMembersList] = useState<any[]>([]);

  useEffect(() => {
    if (d?.members) {
      const formatted = d.members.map((m: any) => {
        let permissionsObj = { assignedRoles: [m.role], branchAccess: ['main-branch'], overrides: {}, dataRestrictions: [] };
        try {
          if (m.permissions && typeof m.permissions === 'string') {
            permissionsObj = JSON.parse(m.permissions);
          } else if (m.permissions && typeof m.permissions === 'object') {
            permissionsObj = { ...permissionsObj, ...m.permissions };
          }
        } catch (e) {
          console.error("Error parsing permissions json", e);
        }
        return {
          ...m,
          assignedRoles: permissionsObj.assignedRoles || [m.role],
          branchAccess: permissionsObj.branchAccess || ['main-branch'],
          overrides: permissionsObj.overrides || {},
          dataRestrictions: permissionsObj.dataRestrictions || []
        };
      });
      setMembersList(formatted);
    }
  }, [d]);

  // Load a selected user profile values into state
  const selectStaffMember = (m: any) => {
    setSelectedStaff(m);
    setAssignedRoles(m.assignedRoles || [m.role]);
    setBranchAccess(m.branchAccess || ['main-branch']);
    
    // Resolve resolved check state
    const resolvedChecklist: string[] = [];
    const baseRoles = m.assignedRoles || [m.role];
    baseRoles.forEach((roleKey: string) => {
      const presetList = PRESETS[roleKey] || [];
      presetList.forEach(p => {
        if (!resolvedChecklist.includes(p)) resolvedChecklist.push(p);
      });
    });

    // Add overrides
    const overrides = m.overrides || {};
    const finalPermissions = [...resolvedChecklist];
    Object.keys(overrides).forEach(pkey => {
      if (overrides[pkey] === true) {
        if (!finalPermissions.includes(pkey)) finalPermissions.push(pkey);
      } else if (overrides[pkey] === false) {
        const index = finalPermissions.indexOf(pkey);
        if (index > -1) finalPermissions.splice(index, 1);
      }
    });

    setCustomPermissions(finalPermissions);
    setDataRestrictions(m.dataRestrictions || []);
    setIsModified(false);
    setSaveMessage(null);
    setErrorMessage(null);
    setActiveSubTab('permissions');
  };

  // Toggle permission checks
  const handleTogglePermission = (permKey: string, action: string) => {
    const fullKey = `${permKey}:${action}`;
    setCustomPermissions(prev => {
      const next = prev.includes(fullKey) ? prev.filter(x => x !== fullKey) : [...prev, fullKey];
      setIsModified(true);
      return next;
    });
  };

  // Toggle roles check and merge permissions dynamically
  const handleToggleRole = (roleKey: string) => {
    setAssignedRoles(prev => {
      let next = [...prev];
      if (next.includes(roleKey)) {
        if (next.length > 1) {
          next = next.filter(r => r !== roleKey);
        }
      } else {
        next.push(roleKey);
      }
      setIsModified(true);

      // Re-apply cumulative merging: merge PRESETS for current roles
      const mergedList: string[] = [];
      next.forEach(r => {
        (PRESETS[r] || []).forEach(p => {
          if (!mergedList.includes(p)) mergedList.push(p);
        });
      });
      setCustomPermissions(mergedList);

      return next;
    });
  };

  const handleToggleBranch = (branchId: string) => {
    setBranchAccess(prev => {
      const next = prev.includes(branchId) ? prev.filter(b => b !== branchId) : [...prev, branchId];
      setIsModified(true);
      return next;
    });
  };

  const handleToggleDataRestriction = (restrictionKey: string) => {
    setDataRestrictions(prev => {
      const next = prev.includes(restrictionKey) ? prev.filter(r => r !== restrictionKey) : [...prev, restrictionKey];
      setIsModified(true);
      return next;
    });
  };

  // Bulk permission triggers
  const handleBulkPermissions = (actionType: 'select-all' | 'clear-all') => {
    if (actionType === 'select-all') {
      const all: string[] = [];
      PERMISSION_MODULES.forEach(cat => {
        cat.permissions.forEach(p => {
          p.actions.forEach(act => {
            all.push(`${p.key}:${act}`);
          });
        });
      });
      setCustomPermissions(all);
    } else {
      setCustomPermissions([]);
    }
    setIsModified(true);
  };

  const toggleAccordion = (cat: string) => {
    setExpandedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  // Calculate overridden permissions to display in the UI
  const isOverridden = (permKey: string, action: string) => {
    const fullKey = `${permKey}:${action}`;
    const valueInActiveState = customPermissions.includes(fullKey);

    // What value is expected strictly from the assigned base roles?
    let expectedFromRoles = false;
    assignedRoles.forEach(r => {
      if ((PRESETS[r] || []).includes(fullKey)) expectedFromRoles = true;
    });

    return valueInActiveState !== expectedFromRoles;
  };

  // Save changes via POST staff update endpoint
  const handleSavePermissions = async () => {
    if (!selectedStaff) return;
    setIsSaving(true);
    setSaveMessage(null);
    setErrorMessage(null);

    // Compute overrides: what differs between customPermissions and assigned base roles presets
    const basePresetPermissions: string[] = [];
    assignedRoles.forEach(r => {
      (PRESETS[r] || []).forEach(p => {
        if (!basePresetPermissions.includes(p)) basePresetPermissions.push(p);
      });
    });

    const overrides: Record<string, boolean> = {};
    
    // Explicitly enabled overrides
    customPermissions.forEach(p => {
      if (!basePresetPermissions.includes(p)) {
        overrides[p] = true;
      }
    });

    // Explicitly disabled overrides
    basePresetPermissions.forEach(p => {
      if (!customPermissions.includes(p)) {
        overrides[p] = false;
      }
    });

    const permissionsPayload = {
      assignedRoles,
      branchAccess,
      overrides,
      dataRestrictions
    };

    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          id: selectedStaff.id,
          role: assignedRoles[0] || selectedStaff.role, // primary fallback role
          permissions: permissionsPayload
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Server error');
      
      setSaveMessage('RBAC permissions successfully compiled and pushed to active sessions.');
      setIsModified(false);
      
      // Update local state row
      setMembersList(prev => prev.map(m => m.id === selectedStaff.id ? {
        ...m,
        role: assignedRoles[0] || m.role,
        assignedRoles,
        branchAccess,
        overrides,
        dataRestrictions
      } : m));

      // Refresh layout data
      setTimeout(() => refresh(), 1000);
    } catch (e: any) {
      setErrorMessage(e.message || 'Error occurred while saving modifications.');
    } finally {
      setIsSaving(false);
    }
  };

  // Create Staff Action
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!newStaffName.trim()) return setErrorMessage('Full Name is required');
    if (!/^\d{4,6}$/.test(newStaffPin)) return setErrorMessage('PIN must be 4 to 6 numeric digits');

    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name: newStaffName,
          role: 'waiter', // default role, customizable immediately after
          phone: newStaffPhone || null,
          pin: newStaffPin,
          employeeCode: newStaffCode || null,
          username: newStaffEmail || null,
          password: newStaffPassword || null
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Conflict saving employee');

      setShowAddModal(false);
      // Reset form states
      setNewStaffName('');
      setNewStaffPhone('');
      setNewStaffEmail('');
      setNewStaffCode('');
      setNewStaffPin('');
      setNewStaffPassword('');
      
      refresh();
    } catch (e: any) {
      setErrorMessage(e.message || 'Verification failed while saving.');
    }
  };

  // Quick Action: Deactivate/Suspend toggle
  const handleToggleStatus = async (m: any) => {
    const nextActive = !m.active;
    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          id: m.id,
          active: nextActive
        })
      });
      if (res.ok) {
        refresh();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Filter members list based on state triggers
  const filteredMembers = membersList.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (m.phone && m.phone.includes(searchQuery)) ||
                          (m.employeeCode && m.employeeCode.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesRole = roleFilter === 'all' || m.assignedRoles.includes(roleFilter) || m.role === roleFilter;
    
    const matchesBranch = branchFilter === 'all' || m.branchAccess.includes(branchFilter);
    
    const matchesStatus = statusFilter === 'all' || 
                          (statusFilter === 'active' && m.active) || 
                          (statusFilter === 'inactive' && !m.active);

    return matchesSearch && matchesRole && matchesBranch && matchesStatus;
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-1">
      {/* Header Stat Widgets */}
      <section className="card p-4">
        <span className="block text-xs mb-2" style={{ color: 'var(--ink-3)' }}>Global Roster Size</span>
        <span className="block text-2xl md:text-3xl font-bold tnum font-mono">{membersList.length}</span>
      </section>
      <section className="card p-4">
        <span className="block text-xs mb-2" style={{ color: 'var(--ink-3)' }}>Active Personnel</span>
        <span className="block text-2xl md:text-3xl font-bold tnum font-mono" style={{ color: 'var(--cardamom-d)' }}>
          {membersList.filter(m => m.active).length}
        </span>
      </section>
      <section className="card p-4">
        <span className="block text-xs mb-2" style={{ color: 'var(--ink-3)' }}>Assigned Branches</span>
        <span className="block text-2xl md:text-3xl font-bold tnum font-mono">3 Outlets</span>
      </section>
      <section className="card p-4">
        <span className="block text-xs mb-2" style={{ color: 'var(--ink-3)' }}>Enforced Security Profile</span>
        <span className="block text-sm md:text-base font-bold text-turmeric mt-2 font-mono">PIN + SHA-256</span>
      </section>

      {/* Navigation Sub-Tabs */}
      <div className="col-span-1 md:col-span-2 lg:col-span-4 flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-line pb-2 gap-4 mt-2">
        <div className="flex gap-2 overflow-x-auto w-full sm:w-auto">
          <button
            onClick={() => { setActiveSubTab('directory'); setSelectedStaff(null); }}
            className={`px-4 py-2 border-b-2 font-medium text-sm transition-all whitespace-nowrap capitalize ${
              activeSubTab === 'directory'
                ? 'border-turmeric text-turmeric font-semibold'
                : 'border-transparent text-ink-3 hover:text-ink'
            }`}
          >
            Staff Directory
          </button>
          {selectedStaff && (
            <button
              onClick={() => setActiveSubTab('permissions')}
              className={`px-4 py-2 border-b-2 font-medium text-sm transition-all whitespace-nowrap capitalize ${
                activeSubTab === 'permissions'
                  ? 'border-turmeric text-turmeric font-semibold'
                  : 'border-transparent text-ink-3 hover:text-ink'
              }`}
            >
              Configure permissions ({selectedStaff.name})
            </button>
          )}
          <button
            onClick={() => setActiveSubTab('audit')}
            className={`px-4 py-2 border-b-2 font-medium text-sm transition-all whitespace-nowrap capitalize ${
              activeSubTab === 'audit'
                ? 'border-turmeric text-turmeric font-semibold'
                : 'border-transparent text-ink-3 hover:text-ink'
            }`}
          >
            Audit Logs
          </button>
        </div>

        <div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-lg bg-turmeric text-[#2A1607] font-semibold text-sm hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Add Staff Member
          </button>
        </div>
      </div>

      {/* Main Tab Rendering */}
      <div className="col-span-1 md:col-span-2 lg:col-span-4 mt-2">
        {/* DIRECTORY VIEW */}
        {activeSubTab === 'directory' && (
          <div className="space-y-4">
            {/* Filtering Pane */}
            <div className="card p-4 grid grid-cols-1 md:grid-cols-4 gap-3" style={{ background: 'var(--paper-2)' }}>
              <div>
                <label className="block text-xs font-semibold mb-1 text-ink-2">Search Directory</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, phone, code..."
                  className="w-full px-3 py-2 rounded bg-paper-3 border border-line text-ink focus:outline-none focus:border-turmeric text-xs font-mono"
                />
              </div>
              <CustomSelect
                value={roleFilter}
                onChange={setRoleFilter}
                options={[
                  { value: 'all', label: 'All Roles' },
                  ...ALL_ROLES.map(r => ({ value: r, label: ROLE_LABELS[r as StaffRole] || r })),
                  { value: 'delivery', label: 'Delivery Staff' },
                  { value: 'inventory', label: 'Inventory Manager' }
                ]}
                label="Filter Role"
              />
              <CustomSelect
                value={branchFilter}
                onChange={setBranchFilter}
                options={[
                  { value: 'all', label: 'All Branches' },
                  ...BRANCH_OPTIONS.map(b => ({ value: b.id, label: b.name }))
                ]}
                label="Filter Branch"
              />
              <CustomSelect
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: 'all', label: 'All Statuses' },
                  { value: 'active', label: 'Active Only' },
                  { value: 'inactive', label: 'Inactive / Suspended' }
                ]}
                label="Filter Status"
              />
            </div>

            {/* Directory List Table */}
            {filteredMembers.length === 0 ? (
              <div className="card p-8 text-center text-ink-3">
                <span className="block text-lg mb-2">No matching staff accounts found.</span>
                <span className="text-xs">Adjust your filters or add a new staff member to populate this view.</span>
              </div>
            ) : (
              <div className="card overflow-hidden" style={{ background: 'var(--paper-1)' }}>
                <div className="overflow-x-auto">
                  <table className="rtable w-full text-sm border-collapse">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--line)', background: 'var(--paper-2)' }}>
                        <th className="p-4 text-left text-xs font-semibold uppercase tracking-wider text-ink-3">Employee</th>
                        <th className="p-4 text-left text-xs font-semibold uppercase tracking-wider text-ink-3">Role Badges</th>
                        <th className="p-4 text-left text-xs font-semibold uppercase tracking-wider text-ink-3">Branches</th>
                        <th className="p-4 text-left text-xs font-semibold uppercase tracking-wider text-ink-3">Status</th>
                        <th className="p-4 text-left text-xs font-semibold uppercase tracking-wider text-ink-3">Last Login</th>
                        <th className="p-4 text-left text-xs font-semibold uppercase tracking-wider text-ink-3">Current Shift</th>
                        <th className="p-4 text-right text-xs font-semibold uppercase tracking-wider text-ink-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/30">
                      {filteredMembers.map((m, idx) => {
                        const mockLogins = ['Just now', '12 mins ago', '2 hours ago', 'Yesterday', '3 days ago', '4 days ago'];
                        const mockShifts = ['Morning (9A - 5P)', 'Evening (4P - 12A)', 'Off Shift', 'Off Shift'];
                        const loginText = mockLogins[idx % mockLogins.length] || 'Just now';
                        const shiftText = mockShifts[idx % mockShifts.length] || 'Off Shift';

                        return (
                          <tr key={m.id} className="hover:bg-line/10 transition-colors">
                            {/* Employee profile column */}
                            <td className="p-4" data-label="Employee">
                              <div className="flex items-center gap-3">
                                <span className="grid place-items-center w-8 h-8 rounded-full text-xs font-bold font-mono shrink-0" style={{ background: 'var(--turmeric-l)', color: '#2A1607' }}>
                                  {m.name.slice(0, 2).toUpperCase()}
                                </span>
                                <div className="text-left">
                                  <span className="font-semibold text-ink block leading-snug">{m.name}</span>
                                  <span className="text-[10px] text-ink-3 font-mono block">Code: {m.employeeCode || '—'} · {m.phone || 'No Phone'}</span>
                                </div>
                              </div>
                            </td>

                            {/* Roles badges column */}
                            <td className="p-4" data-label="Roles">
                              <div className="flex gap-1 flex-wrap">
                                {m.assignedRoles.map((roleKey: string) => (
                                  <span key={roleKey} className="text-[10px] px-2 py-0.5 rounded-md bg-paper-3 border border-line font-medium capitalize text-ink-2">
                                    {ROLE_LABELS[roleKey as StaffRole] || roleKey}
                                  </span>
                                ))}
                              </div>
                            </td>

                            {/* Branches assignment column */}
                            <td className="p-4" data-label="Branches">
                              <span className="text-xs text-ink-2 capitalize">
                                {m.branchAccess.map((b: string) => b.replace('-branch', ' ')).join(', ') || '—'}
                              </span>
                            </td>

                            {/* Status column */}
                            <td className="p-4" data-label="Status">
                              <div className="flex items-center gap-1.5 justify-end md:justify-start">
                                <span className={`w-2 h-2 rounded-full ${m.active ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                                <span className="text-xs text-ink-2 capitalize">{m.active ? 'Active' : 'Suspended'}</span>
                              </div>
                            </td>

                            {/* Last Login column */}
                            <td className="p-4" data-label="Last Login">
                              <span className="text-xs font-mono text-ink-3">{loginText}</span>
                            </td>

                            {/* Shift Status column */}
                            <td className="p-4" data-label="Shift">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                shiftText.includes('Off') ? 'bg-paper-3 text-ink-3' : 'bg-green-500/10 text-green-500 border border-green-500/20'
                              }`}>
                                {shiftText}
                              </span>
                            </td>

                            {/* Actions column */}
                            <td className="p-4 text-right" data-label="Actions">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => selectStaffMember(m)}
                                  className="px-2 py-1 rounded bg-paper-3 hover:bg-line text-xs font-semibold text-ink transition-all flex items-center gap-1"
                                  title="Configure RBAC Permissions"
                                >
                                  🔑 <span className="hidden sm:inline">Permissions</span>
                                </button>
                                <button
                                  onClick={() => handleToggleStatus(m)}
                                  className={`px-2 py-1 rounded text-xs font-semibold transition-all ${
                                    m.active ? 'bg-red-950/20 hover:bg-red-950/40 text-red-500' : 'bg-green-950/20 hover:bg-green-950/40 text-green-500'
                                  }`}
                                >
                                  {m.active ? 'Suspend' : 'Activate'}
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm(`Are you sure you want to delete staff account ${m.name}?`)) {
                                      fetch('/api/staff', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ action: 'remove', id: m.id })
                                      }).then(() => refresh());
                                    }
                                  }}
                                  className="px-2 py-1 rounded hover:bg-red-500/10 text-ink-3 hover:text-red-500 transition-all text-xs"
                                  title="Delete Staff Account"
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SECURITY & AUDIT VIEW */}
        {activeSubTab === 'audit' && (
          <div className="card p-5 space-y-4" style={{ background: 'var(--paper-1)' }}>
            <div className="flex justify-between items-center">
              <h4 className="text-base font-bold">Audit Ledger History (Security logs)</h4>
              <button 
                onClick={() => alert("Audit logs exported to CSV.")}
                className="px-3 py-1.5 rounded bg-paper-3 hover:bg-line text-xs font-semibold font-mono"
              >
                📥 Export Ledger
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="rtable w-full text-xs border-collapse">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)' }}>
                    <th className="pb-2 text-left font-semibold" style={{ color: 'var(--ink-3)' }}>Operator</th>
                    <th className="pb-2 text-left font-semibold" style={{ color: 'var(--ink-3)' }}>Action / Modification</th>
                    <th className="pb-2 text-left font-semibold" style={{ color: 'var(--ink-3)' }}>Target Scope</th>
                    <th className="pb-2 text-left font-semibold" style={{ color: 'var(--ink-3)' }}>Branch</th>
                    <th className="pb-2 text-left font-semibold" style={{ color: 'var(--ink-3)' }}>Device / IP</th>
                    <th className="pb-2 text-right font-semibold" style={{ color: 'var(--ink-3)' }}>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {INITIAL_AUDIT_LOGS.map((log, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid var(--line)' }} className="hover:bg-line/20">
                      <td className="py-2.5 font-bold text-ink">{log.who}</td>
                      <td className="py-2.5 font-mono text-turmeric">{log.action}</td>
                      <td className="py-2.5 text-ink-2">{log.target}</td>
                      <td className="py-2.5 text-ink-2">{log.branch}</td>
                      <td className="py-2.5 font-mono text-[10px] text-ink-3">{log.device}</td>
                      <td className="py-2.5 text-right font-mono text-ink-2">{log.timestamp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* RBAC MATRIX & PERMISSION EDITOR */}
        {activeSubTab === 'permissions' && selectedStaff && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Role mapping & details */}
            <div className="space-y-4 lg:col-span-1">
              {/* Profile Card */}
              <div className="card p-5 space-y-4" style={{ background: 'var(--paper-1)' }}>
                <div className="flex gap-4 items-center">
                  <span className="grid place-items-center w-14 h-14 rounded-full text-xl font-bold shrink-0 font-mono" style={{ background: 'var(--turmeric-l)', color: '#2A1607' }}>
                    {selectedStaff.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <h3 className="font-bold text-lg">{selectedStaff.name}</h3>
                    <span className="text-xs text-ink-3 block">ID: {selectedStaff.employeeCode || '—'}</span>
                    <span className="text-xs text-ink-3 font-mono">{selectedStaff.phone || 'No phone'}</span>
                  </div>
                </div>

                <div className="border-t border-line/50 pt-4 space-y-3">
                  <span className="block text-xs font-bold text-ink-2 uppercase tracking-wide">Multi-Role Selection</span>
                  <div className="grid grid-cols-2 gap-2">
                    {ALL_ROLES.map((roleKey) => (
                      <label 
                        key={roleKey} 
                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer select-none transition-all ${
                          assignedRoles.includes(roleKey)
                            ? 'bg-turmeric-l/10 border-turmeric text-turmeric font-bold'
                            : 'bg-paper-3 border-line text-ink-3 hover:border-ink-3'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={assignedRoles.includes(roleKey)}
                          onChange={() => handleToggleRole(roleKey)}
                          className="accent-turmeric"
                        />
                        <span className="capitalize">{ROLE_LABELS[roleKey as StaffRole] || roleKey}</span>
                      </label>
                    ))}
                    <label 
                      className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer select-none transition-all ${
                        assignedRoles.includes('delivery')
                          ? 'bg-turmeric-l/10 border-turmeric text-turmeric font-bold'
                          : 'bg-paper-3 border-line text-ink-3 hover:border-ink-3'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={assignedRoles.includes('delivery')}
                        onChange={() => handleToggleRole('delivery')}
                        className="accent-turmeric"
                      />
                      <span>Delivery Staff</span>
                    </label>
                    <label 
                      className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer select-none transition-all ${
                        assignedRoles.includes('inventory')
                          ? 'bg-turmeric-l/10 border-turmeric text-turmeric font-bold'
                          : 'bg-paper-3 border-line text-ink-3 hover:border-ink-3'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={assignedRoles.includes('inventory')}
                        onChange={() => handleToggleRole('inventory')}
                        className="accent-turmeric"
                      />
                      <span>Inventory Manager</span>
                    </label>
                  </div>
                  <span className="block text-[10px] text-ink-3 italic mt-1">
                    Cumulative Perms: Checked boxes from active roles will automatically merge.
                  </span>
                </div>

                <div className="border-t border-line/50 pt-4 space-y-3">
                  <span className="block text-xs font-bold text-ink-2 uppercase tracking-wide">Branch-Level Access Mapping</span>
                  <div className="space-y-1.5">
                    {BRANCH_OPTIONS.map((b) => (
                      <label 
                        key={b.id} 
                        className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer select-none transition-all ${
                          branchAccess.includes(b.id)
                            ? 'bg-turmeric-l/10 border-turmeric text-turmeric font-bold'
                            : 'bg-paper-3 border-line text-ink-3 hover:border-ink-3'
                        }`}
                      >
                        <span className="font-semibold">{b.name}</span>
                        <input
                          type="checkbox"
                          checked={branchAccess.includes(b.id)}
                          onChange={() => handleToggleBranch(b.id)}
                          className="accent-turmeric"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Data Access Restrictions */}
              <div className="card p-5 space-y-3" style={{ background: 'var(--paper-1)' }}>
                <span className="block text-xs font-bold text-ink-2 uppercase tracking-wide">Data Access Restrictions</span>
                <div className="space-y-1.5">
                  {DATA_RESTRICTION_OPTIONS.map((opt) => (
                    <label 
                      key={opt.key}
                      className="flex items-center gap-2 text-xs p-1 cursor-pointer select-none text-ink-2 hover:text-ink"
                    >
                      <input 
                        type="checkbox" 
                        checked={dataRestrictions.includes(opt.key)}
                        onChange={() => handleToggleDataRestriction(opt.key)}
                        className="accent-turmeric rounded"
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Accordion Permission Matrix Grid */}
            <div className="lg:col-span-2 space-y-4">
              <div className="card p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3" style={{ background: 'var(--paper-1)' }}>
                <div className="w-full md:w-auto">
                  <input
                    type="text"
                    value={permissionFilter}
                    onChange={(e) => setPermissionFilter(e.target.value)}
                    placeholder="🔍 Search specific permission rule..."
                    className="px-3 py-1.5 rounded bg-paper-3 border border-line text-xs w-full md:w-64 font-mono focus:outline-none focus:border-turmeric"
                  />
                </div>
                <div className="flex gap-2 flex-wrap text-xs">
                  <button 
                    onClick={() => handleBulkPermissions('select-all')}
                    className="px-2.5 py-1.5 rounded bg-paper-3 border border-line hover:bg-line transition-all"
                  >
                    Select All
                  </button>
                  <button 
                    onClick={() => handleBulkPermissions('clear-all')}
                    className="px-2.5 py-1.5 rounded bg-paper-3 border border-line hover:bg-line transition-all text-red-500"
                  >
                    Clear All
                  </button>
                  <button 
                    onClick={() => setExpandedCategories(PERMISSION_MODULES.map(c => c.category))}
                    className="px-2.5 py-1.5 rounded bg-paper-3 border border-line hover:bg-line transition-all"
                  >
                    Expand All
                  </button>
                  <button 
                    onClick={() => setExpandedCategories([])}
                    className="px-2.5 py-1.5 rounded bg-paper-3 border border-line hover:bg-line transition-all"
                  >
                    Collapse All
                  </button>
                </div>
              </div>

              {/* Collapsible module groups */}
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {PERMISSION_MODULES.map((cat) => {
                  // Filter permissions
                  const matches = cat.permissions.filter(p => 
                    p.label.toLowerCase().includes(permissionFilter.toLowerCase()) ||
                    p.key.toLowerCase().includes(permissionFilter.toLowerCase())
                  );

                  if (matches.length === 0) return null;

                  const isExpanded = expandedCategories.includes(cat.category);
                  const activeCount = matches.filter(p => 
                    p.actions.some(act => customPermissions.includes(`${p.key}:${act}`))
                  ).length;

                  return (
                    <div key={cat.category} className="card overflow-hidden border-line" style={{ background: 'var(--paper-1)' }}>
                      <div 
                        onClick={() => toggleAccordion(cat.category)}
                        className="p-3.5 flex justify-between items-center cursor-pointer select-none bg-paper-3/40 border-b border-line hover:bg-paper-3/80 transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-ink">{cat.category}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-paper-3 font-mono text-ink-3">
                            {activeCount} / {matches.length} active
                          </span>
                        </div>
                        <span className={`text-xs text-ink-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                          ▼
                        </span>
                      </div>

                      {isExpanded && (
                        <div className="p-3 space-y-2">
                          {matches.map((p) => (
                            <div key={p.key} className="flex flex-col md:flex-row md:items-center justify-between p-2 rounded hover:bg-paper-3/20 transition-all border border-transparent hover:border-line/20 gap-2">
                              <div>
                                <span className="text-xs font-semibold block text-ink">{p.label}</span>
                                <span className="text-[10px] font-mono text-ink-3">{p.key}</span>
                              </div>
                              <div className="flex gap-2 flex-wrap">
                                {p.actions.map(act => {
                                  const fullKey = `${p.key}:${act}`;
                                  const checked = customPermissions.includes(fullKey);
                                  const isOverriddenVal = isOverridden(p.key, act);

                                  return (
                                    <label 
                                      key={act}
                                      className={`flex items-center gap-1 text-[10px] border px-2 py-0.5 rounded cursor-pointer select-none font-mono transition-all ${
                                        checked 
                                          ? 'bg-turmeric/10 border-turmeric text-turmeric font-bold'
                                          : 'bg-paper-3/30 border-line text-ink-3'
                                      } ${isOverriddenVal ? 'ring-1 ring-gold ring-offset-1' : ''}`}
                                    >
                                      <input 
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => handleTogglePermission(p.key, act)}
                                        className="accent-turmeric h-3 w-3"
                                      />
                                      <span className="capitalize">{act}</span>
                                      {isOverriddenVal && <span className="text-[7px] bg-gold text-[#2A1607] px-0.5 rounded font-sans font-bold">Custom</span>}
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Bottom Sticky Action Bar */}
              <div className={`card p-4 flex justify-between items-center border transition-all ${
                isModified ? 'border-turmeric bg-turmeric-l/5' : 'border-line bg-paper-1'
              }`}>
                <div className="flex items-center gap-2">
                  {isModified ? (
                    <>
                      <span className="w-2.5 h-2.5 rounded-full bg-gold animate-pulse shrink-0" />
                      <span className="text-xs font-bold text-gold">Unsaved Permission Overrides Detected</span>
                    </>
                  ) : (
                    <span className="text-xs text-ink-3">Permissions in Sync with active employee database.</span>
                  )}
                </div>
                <div className="flex gap-2">
                  {isModified && (
                    <button 
                      onClick={() => selectStaffMember(selectedStaff)}
                      className="px-3 py-1.5 rounded hover:bg-line text-xs font-semibold transition-all"
                    >
                      Reset Changes
                    </button>
                  )}
                  <button
                    disabled={isSaving}
                    onClick={handleSavePermissions}
                    className={`px-4 py-2 rounded font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer ${
                      isModified 
                        ? 'bg-turmeric text-[#2A1607] hover:brightness-110 active:scale-95' 
                        : 'bg-paper-3 text-ink-3 cursor-not-allowed border border-line'
                    }`}
                  >
                    {isSaving ? 'Pushing Sessions...' : 'Commit & Sync'}
                  </button>
                </div>
              </div>

              {/* Save Alert Messages */}
              {saveMessage && (
                <div className="p-3.5 rounded-lg border border-green-500/20 bg-green-500/10 text-green-500 text-xs font-mono">
                  ✅ {saveMessage}
                </div>
              )}
              {errorMessage && (
                <div className="p-3.5 rounded-lg border border-red-500/20 bg-red-500/10 text-red-500 text-xs font-mono">
                  ⚠️ {errorMessage}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* CREATE STAFF MODAL */}
      {showAddModal && (
        <div 
          onClick={() => setShowAddModal(false)}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-paper-3 border border-line rounded-xl shadow-2xl w-full max-w-lg p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          >
            {/* Header */}
            <div className="flex justify-between items-center border-b border-line pb-3 mb-4">
              <h3 className="font-bold text-lg">Add New Staff Member</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-ink-3 hover:text-ink transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Error alerts */}
            {errorMessage && (
              <div className="mb-4 p-3 rounded bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold font-mono">
                ⚠️ Error: {errorMessage}
              </div>
            )}

            {/* Form body */}
            <form onSubmit={handleCreateStaff} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-ink-2">Full Name *</label>
                  <input 
                    type="text" 
                    required
                    value={newStaffName} 
                    onChange={(e) => setNewStaffName(e.target.value)}
                    placeholder="Rahul Sharma"
                    className="w-full px-3 py-2 rounded bg-paper-2 border border-line text-ink text-sm focus:outline-none focus:border-turmeric"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-ink-2">Employee ID Code</label>
                  <input 
                    type="text" 
                    value={newStaffCode} 
                    onChange={(e) => setNewStaffCode(e.target.value)}
                    placeholder="CH-102"
                    className="w-full px-3 py-2 rounded bg-paper-2 border border-line text-ink text-sm focus:outline-none focus:border-turmeric"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-ink-2">Phone Number</label>
                  <input 
                    type="tel" 
                    value={newStaffPhone} 
                    onChange={(e) => setNewStaffPhone(e.target.value)}
                    placeholder="9876543210"
                    className="w-full px-3 py-2 rounded bg-paper-2 border border-line text-ink text-sm focus:outline-none focus:border-turmeric"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-ink-2">Login PIN * (4-6 digits)</label>
                  <input 
                    type="password" 
                    required
                    value={newStaffPin} 
                    onChange={(e) => setNewStaffPin(e.target.value)}
                    placeholder="••••"
                    className="w-full px-3 py-2 rounded bg-paper-2 border border-line text-ink font-mono text-sm focus:outline-none focus:border-turmeric"
                  />
                </div>
              </div>

              <div className="border-t border-line/50 pt-4">
                <span className="block text-xs font-bold text-ink-2 uppercase tracking-wide mb-3">Login Credentials (Optional Dashboard Access)</span>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-ink-2">Email / Username</label>
                    <input 
                      type="text" 
                      value={newStaffEmail} 
                      onChange={(e) => setNewStaffEmail(e.target.value)}
                      placeholder="rahul.s"
                      className="w-full px-3 py-2 rounded bg-paper-2 border border-line text-ink text-sm focus:outline-none focus:border-turmeric"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-ink-2">Dashboard Password</label>
                    <input 
                      type="password" 
                      value={newStaffPassword} 
                      onChange={(e) => setNewStaffPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 rounded bg-paper-2 border border-line text-ink text-sm focus:outline-none focus:border-turmeric"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-line mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded bg-paper-2 hover:bg-line text-xs font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-turmeric text-[#2A1607] font-bold text-xs hover:brightness-110 active:scale-95 transition-all"
                >
                  Create & Setup RBAC
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
