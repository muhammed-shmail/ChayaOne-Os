'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Store, 
  CreditCard, 
  BarChart3, 
  Settings, 
  Layers, 
  ShieldCheck,
  ChevronDown,
  Menu,
  X
} from 'lucide-react';
import { useState } from 'react';

const MENU = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    href: '/admin/dashboard',
    exact: true,
  },
  {
    label: 'Cafe Management',
    icon: Store,
    href: '/admin/cafes',
    subItems: [
      { label: 'All Cafes', href: '/admin/cafes' },
      { label: 'Create Cafe', href: '/admin/cafes/create' },
      { label: 'Suspended Cafes', href: '/admin/cafes/suspended' },
      { label: 'Trial Cafes', href: '/admin/cafes/trial' },
    ]
  },
  {
    label: 'Subscriptions',
    icon: CreditCard,
    href: '/admin/subscriptions',
    subItems: [
      { label: 'Plans', href: '/admin/subscriptions/plans' },
      { label: 'Renewals', href: '/admin/subscriptions/renewals' },
      { label: 'Invoices', href: '/admin/subscriptions/invoices' },
      { label: 'Payments', href: '/admin/subscriptions/payments' },
    ]
  },
  {
    label: 'Analytics',
    icon: BarChart3,
    href: '/admin/analytics',
    subItems: [
      { label: 'Revenue', href: '/admin/analytics/revenue' },
      { label: 'Orders', href: '/admin/analytics/orders' },
      { label: 'Growth', href: '/admin/analytics/growth' },
      { label: 'Customers', href: '/admin/analytics/customers' },
    ]
  },
  {
    label: 'Operations',
    icon: Layers,
    href: '/admin/operations',
    subItems: [
      { label: 'Announcements', href: '/admin/operations/announcements' },
      { label: 'Support Tickets', href: '/admin/operations/tickets' },
      { label: 'Audit Logs', href: '/admin/operations/audit-logs' },
      { label: 'System Logs', href: '/admin/operations/system-logs' },
      { label: 'Error Logs', href: '/admin/operations/error-logs' },
    ]
  },
  {
    label: 'Platform',
    icon: ShieldCheck,
    href: '/admin/platform',
    subItems: [
      { label: 'White Label', href: '/admin/platform/white-label' },
      { label: 'Integrations', href: '/admin/platform/integrations' },
      { label: 'Security', href: '/admin/platform/security' },
      { label: 'Services', href: '/admin/platform/services' },
      { label: 'Health Monitor', href: '/admin/platform/health' },
    ]
  },
  {
    label: 'Settings',
    icon: Settings,
    href: '/admin/settings',
    exact: false,
  }
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-[var(--paper-2)] border-r border-[var(--line)]">
      <div className="flex items-center gap-3 p-6 border-b border-[var(--line)]">
        <div className="leading-none">
          <p className="font-display text-[11px] tracking-[0.3em] uppercase text-[var(--gold)]">Nuro7</p>
          <p className="font-display text-sm text-[var(--ink-2)]">Control Plane</p>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {MENU.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const hasSubItems = item.subItems && item.subItems.length > 0;
          const isOpen = openGroups[item.label] || isActive;

          return (
            <div key={item.label} className="mb-1">
              {hasSubItems ? (
                <button
                  onClick={() => toggleGroup(item.label)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors ${
                    isActive ? 'bg-[var(--paper-3)] text-[var(--gold)]' : 'text-[var(--ink-2)] hover:bg-[var(--paper-3)] hover:text-[var(--ink)]'
                  }`}
                >
                  <div className="flex items-center gap-3 font-semibold text-sm">
                    <item.icon size={18} className={isActive ? 'text-[var(--gold)]' : 'text-[var(--ink-3)]'} />
                    {item.label}
                  </div>
                  <ChevronDown size={16} className={`transition-transform text-[var(--ink-3)] ${isOpen ? 'rotate-180' : ''}`} />
                </button>
              ) : (
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors font-semibold text-sm ${
                    isActive ? 'bg-[var(--paper-3)] text-[var(--gold)] border border-[var(--line)]' : 'text-[var(--ink-2)] hover:bg-[var(--paper-3)] hover:text-[var(--ink)] border border-transparent'
                  }`}
                >
                  <item.icon size={18} className={isActive ? 'text-[var(--gold)]' : 'text-[var(--ink-3)]'} />
                  {item.label}
                </Link>
              )}
              
              {hasSubItems && isOpen && (
                <div className="mt-1 ml-4 pl-4 border-l border-[var(--line)] flex flex-col gap-1">
                  {item.subItems!.map((subItem) => {
                    const isSubActive = pathname === subItem.href;
                    return (
                      <Link
                        key={subItem.href}
                        href={subItem.href}
                        className={`block px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                          isSubActive ? 'text-[var(--gold)] bg-[var(--paper-3)]' : 'text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--paper-3)]'
                        }`}
                      >
                        {subItem.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Toggle */}
      <div className="lg:hidden fixed top-0 left-0 z-50 p-4">
        <button 
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 bg-[var(--paper-2)] border border-[var(--line)] rounded-xl text-[var(--ink)] shadow-md"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="fixed top-0 left-0 bottom-0 w-72 max-w-[80vw] bg-[var(--paper)] z-50 shadow-2xl animate-in slide-in-from-left">
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <div className="hidden lg:block w-64 h-screen sticky top-0 flex-shrink-0">
        <SidebarContent />
      </div>
    </>
  );
}
