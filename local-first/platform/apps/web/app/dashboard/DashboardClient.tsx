'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatINR } from '@cafeos/core';
import { BrandMark } from '@/components/BrandMark';
import { CountUp } from '@/components/ui/motion';
import { TeaLoader } from '@/components/ui/TeaLoader';
import { RevenuePanel } from '@/components/dashboard/RevenuePanel';
import type { DashboardData } from '@/lib/analytics';
import { SECTION_KEY, SectionView } from './Sections';
import CustomerManagement from './CustomerManagement';
import { ROLE_LABELS, ROLE_DESCRIPTIONS, assignableRoles, ALL_ROLES } from '@/lib/rbac';
import { DEVICE_TYPES, DEVICE_CONNECTIONS, type Device } from '@/lib/devices';
import type { ReceiptConfig } from '@/lib/receipt';
import { type KitchenWorkflowConfig, KITCHEN_WORKFLOW_DEFAULTS, AUTO_CLEAR_OPTIONS, DELAY_THRESHOLD_OPTIONS, SORT_OPTIONS, THEME_OPTIONS, FONT_SIZE_OPTIONS } from '@/lib/kitchenWorkflow';
import { tableOrderUrl, tableQrImageUrl } from '@/lib/qr';
import { FEATURED_LABELS, DEFAULT_GAME_KEYS, type PwaConfig } from '@/lib/pwa';
import type { OutletLocation } from '@/lib/geo';
import { subscribeStaff } from '@/lib/realtime-client';
import { getGeoHeaders } from '@/lib/geo-client';
import { prettyAction } from '@/lib/audit-labels';
import {
  ThemeToggle, Bell, Table2, LogOut, LayoutDashboard, Wifi, ChefHat, Menu,
  ClipboardList, UtensilsCrossed, Package, Truck, Users, User, Settings, type LucideIcon,
  Percent, Printer, Smartphone, Store, BarChart3, ImageIcon, Download, X, MapPin, Megaphone, FileSpreadsheet,
  ChevronLeft, ChevronRight,
} from '@/components/ui';
import { ShiftStatus } from '@/components/ShiftStatus';
import StaffDevices from '@/components/StaffDevices';
import { MobileDrawer, BottomNav, type NavItem } from '@/components/dashboard/MobileNav';
import FinanceManagement from './FinanceManagement';
import SettingsCenter from './components/SettingsCenter';


type FloorTable = { id: string; label: string; seats: number; state: string; qrToken: string; floorId: string | null; activeOrders: number };
type Floor = { id: string; name: string; sort: number };
type Kitchen = { id: string; name: string; color?: string; sort: number };

type Msg = { who: 'ai' | 'me'; html: string };

const MENUS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: 'home',      label: 'Home',         icon: LayoutDashboard },
  { key: 'orders',    label: 'Orders',        icon: ClipboardList },
  { key: 'menu',      label: 'Menu',          icon: UtensilsCrossed },
  { key: 'inventory', label: 'Inventory',     icon: Package },
  { key: 'suppliers', label: 'Suppliers',     icon: Truck },
  { key: 'customers', label: 'Customers',     icon: Users },
  { key: 'staff',     label: 'Staff',         icon: User },
  { key: 'finance',   label: 'Finance',       icon: BarChart3 },
  { key: 'reports',   label: 'Reports',       icon: FileSpreadsheet },
  { key: 'settings',  label: 'Settings',      icon: Settings },
];

/** Key actions surfaced in the mobile bottom nav (short labels); a 5th "More"
 *  button opens the full drawer. Everything else stays reachable via the drawer. */
const BOTTOM_NAV: { key: string; label: string; icon: LucideIcon }[] = [
  { key: 'home',      label: 'Home',      icon: LayoutDashboard },
  { key: 'orders',    label: 'Orders',    icon: ClipboardList },
  { key: 'finance',   label: 'Finance',   icon: BarChart3 },
  { key: 'customers', label: 'Customers', icon: Users },
];

/** Field-level diff of an audit entry's before/after JSON — only keys whose value changed. */
function auditDiff(before: Record<string, unknown> | null, after: Record<string, unknown> | null): { key: string; before: string; after: string }[] {
  const b = before ?? {};
  const a = after ?? {};
  const fmt = (v: unknown) => (v === undefined ? '—' : typeof v === 'string' ? v : JSON.stringify(v));
  return Array.from(new Set([...Object.keys(b), ...Object.keys(a)]))
    .filter((k) => JSON.stringify(b[k]) !== JSON.stringify(a[k]))
    .map((k) => ({ key: k, before: fmt(b[k]), after: fmt(a[k]) }));
}

/** Titles + icons for the Settings popup window, keyed by panel. */
const SETTINGS_TITLE: Record<string, string> = {
  general: 'General',
  tax: 'Tax & GST',
  floor: 'Floor & QR',
  kitchen: 'Kitchen Workflow',
  pwa: 'PWA Settings',
  location: 'Location Gate',
  devices: 'Devices & Printers',
  audit: 'Audit Logs',
  multibranch: 'Multi Branch',
};
const SETTINGS_ICON: Record<string, LucideIcon> = {
  general: Settings,
  tax: Percent,
  floor: Table2,
  kitchen: ChefHat,
  pwa: Smartphone,
  location: MapPin,
  devices: Printer,
  audit: ClipboardList,
  multibranch: Store,
};

/** A focused popup window that hosts one settings panel. Closes on ✕, backdrop click or Esc. */
function SettingsModal({ title, icon: Icon, onClose, children }: { title: string; icon?: LucideIcon; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} role="presentation" className="scrim anim-fade z-[8500] flex items-start sm:items-center justify-center overflow-y-auto p-3 sm:p-6">
      <div role="dialog" aria-modal="true" aria-label={title} className="anim-pop my-auto w-full max-w-2xl" style={{ background: 'var(--paper-2)', borderRadius: 22, boxShadow: 'var(--sh-3)', border: '1px solid var(--line)' }}>
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b sticky top-0 z-10" style={{ borderColor: 'var(--line)', background: 'var(--paper-2)', borderTopLeftRadius: 22, borderTopRightRadius: 22 }}>
          <h2 className="font-display text-lg font-bold flex items-center gap-2.5">
            {Icon && <span className="grid place-items-center rounded-xl shrink-0" style={{ width: 34, height: 34, background: 'var(--paper-3)', color: 'var(--turmeric)' }}><Icon size={18} aria-hidden /></span>}
            {title}
          </h2>
          <button onClick={onClose} aria-label="Close" className="btn btn-icon btn-sm btn-ghost"><X size={18} aria-hidden /></button>
        </div>
        <div className="p-4 sm:p-5 flex flex-col gap-4">{children}</div>
      </div>
    </div>
  );
}

export default function DashboardClient({
  outlet,
  staff,
  data,
  features,
}: {
  outlet: { name: string; brand: string; plan: string; gstin: string | null; receipt: ReceiptConfig };
  staff: { name: string; role: string };
  data: DashboardData;
  features: Record<string, boolean>;
}) {
  const router = useRouter();
  // Feature tick model: hide modules this cafe isn't entitled to. The server
  // routes are the hard gate; this just keeps the UI honest.
  const visibleMenus = MENUS.filter((m) => {
    if (m.key === 'customers' && features.crm === false) return false;
    // cashier: home, orders, finance (operations)
    if (staff.role === 'cashier') {
      return ['home', 'orders', 'finance'].includes(m.key);
    }
    // accountant: home, orders, inventory, suppliers, customers, finance, reports
    if (staff.role === 'accountant') {
      return ['home', 'orders', 'inventory', 'suppliers', 'customers', 'finance', 'reports'].includes(m.key);
    }
    // kitchen staff: home, orders, kitchen only
    if (staff.role === 'kitchen') {
      return ['home', 'orders', 'kitchen'].includes(m.key);
    }
    // waiter: home, orders, kitchen
    if (staff.role === 'waiter') {
      return ['home', 'orders', 'kitchen'].includes(m.key);
    }
    return true;
  });
  const visibleBottomNav = BOTTOM_NAV.filter((m) => {
    if (m.key === 'customers' && features.crm === false) return false;
    if (staff.role === 'cashier' || staff.role === 'accountant') {
      return ['home', 'orders', 'finance'].includes(m.key);
    }
    if (staff.role === 'kitchen' || staff.role === 'waiter') {
      return ['home', 'orders'].includes(m.key);
    }
    return true;
  });
  const [isPending, startTransition] = useTransition();
  const { kpi, trend, hourly, topItems, menuQuadrant, lowStock, loyalty, briefing } = data;

  const [showPos, setShowPos] = useState(false);
  const [showKds, setShowKds] = useState(false);
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === 'close-pos') {
        setShowPos(false);
      }
      if (e.data && e.data.type === 'close-kds') {
        setShowKds(false);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    if (!showPos && !showKds) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showPos, showKds]);

  // 1. Beginner vs Advanced Mode (stored in localStorage)
  const [isAdvanced, setIsAdvanced] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem('cafeos_advanced');
    if (stored === 'true') {
      setIsAdvanced(true);
    }
  }, []);

  const handleToggleAdvanced = (val: boolean) => {
    setIsAdvanced(val);
    localStorage.setItem('cafeos_advanced', String(val));
    flashMessage(val ? 'Advanced Mode unlocked!' : 'Beginner Mode active (simple layout).');
  };

  // Sidebar states
  const reduceMotion = useReducedMotion();
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<{ label: string; top: number; right: number } | null>(null);

  // Mobile-only slide-out drawer (the full menu); desktop uses the sidebar above.
  const [drawerOpen, setDrawerOpen] = useState(false);

  // 2. Navigation State
  const [activeMenu, setActiveMenu] = useState('home');
  const [activeSubTab, setActiveSubTab] = useState('overview');
  // read the current tab from the long-lived SSE handler without re-subscribing
  const activeMenuRef = useRef(activeMenu);

  // Sync initial menu tab from query search parameter
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab && MENUS.some((m) => m.key === tab)) {
        setActiveMenu(tab);
      }
    }
  }, []);

  // Sync sub tab when menu changes
  useEffect(() => {
    if (activeMenu === 'home') {
      if (activeSubTab !== 'floor' && activeSubTab !== 'overview') {
        setActiveSubTab('overview');
      }
    }
    else if (activeMenu === 'orders') setActiveSubTab('active');
    else if (activeMenu === 'kitchen') setActiveSubTab('kds');
    else if (activeMenu === 'menu') setActiveSubTab('menu');
    else if (activeMenu === 'inventory') setActiveSubTab('stock');
    else if (activeMenu === 'suppliers') setActiveSubTab('ledger');
    else if (activeMenu === 'customers') setActiveSubTab('list');
    else if (activeMenu === 'staff') setActiveSubTab('activity');
    else if (activeMenu === 'finance') setActiveSubTab('operations');
    else if (activeMenu === 'reports') setActiveSubTab('daily');
    else if (activeMenu === 'settings') setActiveSubTab('general');
  }, [activeMenu]);

  // 3. Realtime Stream
  const [liveOrders, setLiveOrders] = useState(0);
  const [connected, setConnected] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const liveDot = useRef<HTMLSpanElement>(null);

  // Self-healing realtime. The helper re-fetches a fresh token and rejoins the
  // private outlet channel on drop/expiry (the old hand-rolled EventSource
  // reconnect that kept the owner bell from sticking on "Offline" now lives there).
  useEffect(() => {
    return subscribeStaff(
      (msg) => {
        // any order lifecycle change (placed / bumped / settled anywhere) refreshes
        // the live queue, so a bill settled in the POS clears here without a manual
        // Refresh. Only refetch while the Orders tab is open (it reloads on open too).
        if (msg.type === 'order.new' || msg.type === 'order.updated' || msg.type === 'order.pending') {
          if (activeMenuRef.current === 'orders') loadOrders();
        }
        if (msg.type === 'order.new') {
          setLiveOrders((n) => n + 1);
          flashMessage(`New Order Received: #${msg.ticket.number}`);
          if (liveDot.current) {
            liveDot.current.style.animation = 'none';
            void liveDot.current.offsetWidth;
            liveDot.current.style.animation = '';
          }
        } else if (msg.type === 'notify' && (msg.notification.audience ?? 'owner') === 'owner') {
          // live owner alert → bump the bell + prepend to the feed (staff-targeted
          // notifications are ignored here; they go to the staff bar)
          setUnread((u) => u + 1);
          setNotifs((prev) => [{ ...msg.notification, readAt: null, at: new Date(msg.notification.at).toISOString() }, ...prev].slice(0, 40));
          flashMessage(`🔔 ${msg.notification.title}`);
        }
      },
      (s) => setConnected(s === 'connected'),
    );
  }, []);

  function flashMessage(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  // 4. Settle / Advance Orders logic
  const [ordersList, setOrdersList] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [billSearch, setBillSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [editingDiscount, setEditingDiscount] = useState(false);
  const [editDiscountPct, setEditDiscountPct] = useState('0');
  const [editDiscountFlat, setEditDiscountFlat] = useState('0');

  const loadOrders = async () => {
    setOrdersLoading(true);
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const d = await res.json();
        setOrdersList(d.orders || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    if (activeMenu === 'orders') {
      loadOrders();
    }
  }, [activeMenu]);

  const handleBumpOrder = async (id: string, nextStatus?: string) => {
    try {
      const body = nextStatus ? JSON.stringify({ status: nextStatus }) : '{}';
      const res = await fetch(`/api/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body,
      });
      if (res.ok) {
        flashMessage('Order status updated!');
        loadOrders();
        router.refresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSettleOrder = async (id: string, method: 'cash' | 'upi') => {
    try {
      const res = await fetch(`/api/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'settled', method }),
      });
      if (res.ok) {
        flashMessage(`Bill settled via ${method.toUpperCase()}!`);
        loadOrders();
        router.refresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveDiscount = async () => {
    if (!orderDetail) return;
    try {
      const pct = parseFloat(editDiscountPct) || 0;
      const flatVal = parseFloat(editDiscountFlat) || 0;
      const flatPaise = Math.round(flatVal * 100);

      const res = await fetch(`/api/orders/${orderDetail.id}/status`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          discountPct: pct > 0 ? pct : undefined,
          discountFlatPaise: flatPaise > 0 ? flatPaise : undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        flashMessage('Discount updated successfully!');
        if (data.order) {
          setOrderDetail(data.order);
        }
        setEditingDiscount(false);
        loadOrders();
      } else {
        flashMessage('Failed to update discount.');
      }
    } catch (err) {
      console.error(err);
      flashMessage('Error saving discount.');
    }
  };

  // 5. Inventory Operations logic
  const [stockItems, setStockItems] = useState<any[]>([]);
  const [consumption, setConsumption] = useState<any[]>([]);
  const [stockAlerts, setStockAlerts] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [menuItems, setMenuItems] = useState<any[]>([]);

  const loadInventoryData = async () => {
    setInventoryLoading(true);
    try {
      // Lazy load via section API
      const [invRes, menuRes] = await Promise.all([
        fetch('/api/dashboard/section?s=inventory'),
        fetch('/api/dashboard/section?s=menu'),
      ]);
      if (invRes.ok) {
        const d = await invRes.json();
        setStockItems(d.data?.items || []);
        setConsumption(d.data?.consumption || []);
        setStockAlerts(d.data?.alerts || []);
        setRecipes(d.data?.recipes || []);
      }
      if (menuRes.ok) {
        const d = await menuRes.json();
        const flatItems = (d.data?.categories || []).flatMap((c: any) => c.items || []);
        setMenuItems(flatItems);
        setMenuCategories(d.data?.categoryList || []);
        setKitchens(d.data?.kitchens || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setInventoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeMenu === 'inventory' || activeMenu === 'settings' || activeMenu === 'menu' || activeMenu === 'finance') {
      loadInventoryData();
    }
  }, [activeMenu]);

  // 6. Action Handlers for Inventory
  const [purchItemId, setPurchItemId] = useState('');
  const [purchQty, setPurchQty] = useState('');
  const [purchPrice, setPurchPrice] = useState(''); // in rupees

  const handleAddPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchItemId || !purchQty || !purchPrice) return;
    try {
      const res = await fetch('/api/dashboard/inventory', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'purchase',
          stockItemId: purchItemId,
          qty: parseFloat(purchQty),
          unitCostPaise: Math.round(parseFloat(purchPrice) * 100),
        }),
      });
      if (res.ok) {
        flashMessage('Purchase added! Stock and costs updated.');
        setPurchQty('');
        setPurchPrice('');
        loadInventoryData();
        router.refresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const [adjustItemId, setAdjustItemId] = useState('');
  const [adjustQty, setAdjustQty] = useState('');

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustItemId || !adjustQty) return;
    try {
      const res = await fetch('/api/dashboard/inventory', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'adjust',
          stockItemId: adjustItemId,
          qtyOnHand: parseFloat(adjustQty),
        }),
      });
      if (res.ok) {
        flashMessage('Stock level adjusted successfully.');
        setAdjustQty('');
        loadInventoryData();
        router.refresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Recipe Wizard Logic
  const [recipeMenuItemId, setRecipeMenuItemId] = useState('');
  const [recipeStockItemId, setRecipeStockItemId] = useState('');
  const [recipeQty, setRecipeQty] = useState('');
  const [recipeUnit, setRecipeUnit] = useState('');

  const handleLinkRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipeMenuItemId || !recipeStockItemId || !recipeQty) return;
    try {
      const res = await fetch('/api/dashboard/inventory', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'recipe',
          itemId: recipeMenuItemId,
          stockItemId: recipeStockItemId,
          qty: parseFloat(recipeQty),
          unit: recipeUnit.trim() || undefined,
        }),
      });
      if (res.ok) {
        flashMessage('Ingredient linked to recipe!');
        setRecipeStockItemId('');
        setRecipeQty('');
        setRecipeUnit('');
        loadInventoryData(); // refresh the recipe list
      } else {
        const errorData = await res.json();
        flashMessage(`Error: ${errorData.error || 'Failed to link recipe'}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteRecipe = async (recipeId: string) => {
    try {
      const res = await fetch('/api/dashboard/inventory', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'recipe_delete', recipeId }),
      });
      if (res.ok) { flashMessage('Ingredient removed from recipe'); loadInventoryData(); }
    } catch (err) {
      console.error(err);
    }
  };

  // 6b. Suppliers & Credit (Phase B)
  const [suppliers, setSuppliers] = useState<any>(null);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [statement, setStatement] = useState<any>(null);

  const loadSuppliers = async () => {
    setSuppliersLoading(true);
    try {
      const res = await fetch('/api/dashboard/section?s=suppliers');
      if (res.ok) {
        const d = await res.json();
        setSuppliers(d.data || null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSuppliersLoading(false);
    }
  };

  useEffect(() => {
    // load suppliers data when inventory or suppliers menu opens
    if (activeMenu === 'inventory' || activeMenu === 'suppliers') loadSuppliers();
  }, [activeMenu]);

  const postSupplier = async (payload: any, okMsg: string) => {
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        flashMessage(okMsg);
        loadSuppliers();
        return true;
      }
      flashMessage(`Error: ${data.error || 'failed'}`);
      return false;
    } catch (err) {
      console.error(err);
      flashMessage('Network error');
      return false;
    }
  };

  // add-vendor form
  const [vName, setVName] = useState('');
  const [vPhone, setVPhone] = useState('');
  const [vGstin, setVGstin] = useState('');
  const [vOpening, setVOpening] = useState('');
  const handleAddVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vName.trim()) return;
    const ok = await postSupplier(
      { action: 'vendor', name: vName, phone: vPhone || null, gstin: vGstin || null, openingBalancePaise: vOpening ? Math.round(parseFloat(vOpening) * 100) : 0 },
      'Supplier added.',
    );
    if (ok) { setVName(''); setVPhone(''); setVGstin(''); setVOpening(''); }
  };

  // invoice form
  const [invVendorId, setInvVendorId] = useState('');
  const [invNo, setInvNo] = useState('');
  const [invDate, setInvDate] = useState('');
  const [invDue, setInvDue] = useState('');
  const [invTotal, setInvTotal] = useState('');
  const [invPaidNow, setInvPaidNow] = useState('');
  const [invMethod, setInvMethod] = useState('cash');
  const handleAddInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invVendorId || !invTotal) return;
    const ok = await postSupplier(
      {
        action: 'invoice',
        vendorId: invVendorId,
        invoiceNo: invNo || null,
        invoiceDate: invDate || null,
        dueDate: invDue || null,
        totalPaise: Math.round(parseFloat(invTotal) * 100),
        paidNowPaise: invPaidNow ? Math.round(parseFloat(invPaidNow) * 100) : 0,
        paymentMethod: invMethod,
      },
      'Purchase invoice recorded.',
    );
    if (ok) { setInvNo(''); setInvDate(''); setInvDue(''); setInvTotal(''); setInvPaidNow(''); }
  };

  // payment form
  const [payVendorId, setPayVendorId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payRef, setPayRef] = useState('');
  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payVendorId || !payAmount) return;
    const ok = await postSupplier(
      { action: 'payment', vendorId: payVendorId, amountPaise: Math.round(parseFloat(payAmount) * 100), method: payMethod, reference: payRef || null },
      'Payment recorded.',
    );
    if (ok) { setPayAmount(''); setPayRef(''); }
  };

  const openStatement = async (vendorId: string) => {
    try {
      const res = await fetch(`/api/suppliers?vendorId=${vendorId}`);
      if (res.ok) setStatement(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  // 6c. Tables — occupancy & revenue (Phase D)
  const [tablesData, setTablesData] = useState<any>(null);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [cfgMinutes, setCfgMinutes] = useState('');
  const [cfgMinBill, setCfgMinBill] = useState('');

  const loadTables = async () => {
    setTablesLoading(true);
    try {
      const res = await fetch('/api/dashboard/section?s=tables');
      if (res.ok) {
        const d = await res.json();
        setTablesData(d.data || null);
        if (d.data?.config) {
          setCfgMinutes(String(d.data.config.minutes));
          setCfgMinBill(String(Math.round(d.data.config.minBillPaise / 100)));
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTablesLoading(false);
    }
  };

  // refresh live occupancy every 30s globally (updates the header stats & floor map)
  useEffect(() => {
    loadTables();
    const t = setInterval(loadTables, 30000);
    return () => clearInterval(t);
  }, []);

  const handleSaveTableConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/dashboard/tables', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'config', minutes: parseInt(cfgMinutes || '90', 10), minBillPaise: Math.round(parseFloat(cfgMinBill || '500') * 100) }),
      });
      if (res.ok) { flashMessage('Occupancy alert thresholds saved.'); loadTables(); }
    } catch (err) {
      console.error(err);
    }
  };

  // 6d. Owner Monitor + notification bell (Phase E)
  const [monitor, setMonitor] = useState<any>(null);
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [notifs, setNotifs] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastOk, setBroadcastOk] = useState(false);
  // Who the message goes to: everyone on the floor, one role/team, or one person.
  const [broadcastTo, setBroadcastTo] = useState<'floor' | 'role' | 'user'>('floor');
  const [broadcastRole, setBroadcastRole] = useState<'manager' | 'cashier' | 'waiter' | 'kitchen'>('waiter');
  const [broadcastStaffId, setBroadcastStaffId] = useState('');

  const loadMonitor = async () => {
    setMonitorLoading(true);
    try {
      const res = await fetch('/api/dashboard/section?s=monitor');
      if (res.ok) { const d = await res.json(); setMonitor(d.data || null); setUnread(d.data?.alertCount ?? 0); }
    } catch (err) { console.error(err); } finally { setMonitorLoading(false); }
  };

  const loadNotifs = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) { const d = await res.json(); setNotifs(d.items ?? []); setUnread(d.unread ?? 0); }
    } catch (err) { console.error(err); }
  };

  // unread count on mount; live bumps come from the SSE 'notify' handler
  useEffect(() => { loadNotifs(); }, []);

  // Monitor widget is now embedded on Home — refresh while Home is open
  useEffect(() => {
    if (activeMenu !== 'home') return;
    loadMonitor();
    const t = setInterval(loadMonitor, 20000);
    return () => clearInterval(t);
  }, [activeMenu]);

  const markRead = async (id: string) => {
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: 'now' } : n)));
    setUnread((u) => Math.max(0, u - 1));
    await fetch('/api/notifications', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'read', id }) }).catch(() => {});
  };
  const markAllRead = async () => {
    setNotifs((prev) => prev.map((n) => ({ ...n, readAt: 'now' })));
    setUnread(0);
    await fetch('/api/notifications', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'read_all' }) }).catch(() => {});
  };
  // Teams a message can be aimed at (role groups). Owner is excluded — you
  // message people you manage, not yourself.
  const BROADCAST_TEAMS: { role: 'manager' | 'cashier' | 'waiter' | 'kitchen'; label: string }[] = [
    { role: 'manager', label: 'Managers' },
    { role: 'cashier', label: 'Cashiers' },
    { role: 'waiter', label: 'Waiters' },
    { role: 'kitchen', label: 'Kitchen' },
  ];
  // Human label for the current target, used in the "Sent to …" confirmation.
  const broadcastTargetLabel = () => {
    if (broadcastTo === 'role') return BROADCAST_TEAMS.find((t) => t.role === broadcastRole)?.label ?? 'team';
    if (broadcastTo === 'user') return staffMembers.find((m) => m.id === broadcastStaffId)?.name ?? 'them';
    return 'all staff';
  };
  // Push a one-line message to the chosen audience's notification bar.
  const sendBroadcast = async () => {
    const message = broadcastMsg.trim();
    if (!message || broadcasting) return;
    if (broadcastTo === 'user' && !broadcastStaffId) { flashMessage('Pick a person to message'); return; }
    setBroadcasting(true);
    try {
      const payload: Record<string, unknown> = { message, audience: broadcastTo };
      if (broadcastTo === 'role') payload.targetRole = broadcastRole;
      if (broadcastTo === 'user') payload.targetStaffId = broadcastStaffId;
      const res = await fetch('/api/staff/broadcast', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) { setBroadcastMsg(''); setBroadcastOk(true); setTimeout(() => setBroadcastOk(false), 2500); }
    } catch { /* ignore */ } finally { setBroadcasting(false); }
  };

  // 6e. Staff & Access — user management (Phase F)
  const [staffMembers, setStaffMembers] = useState<any[]>([]);
  const [staffAssignable, setStaffAssignable] = useState<string[]>(assignableRoles(staff.role));
  const [staffLoading, setStaffLoading] = useState(false);
  const [nuName, setNuName] = useState('');
  const [nuPhone, setNuPhone] = useState('');
  const [nuRole, setNuRole] = useState<string>(assignableRoles(staff.role)[0] ?? 'waiter');
  const [nuPin, setNuPin] = useState('');

  const loadStaff = async () => {
    setStaffLoading(true);
    try {
      const res = await fetch('/api/staff');
      if (res.ok) { const d = await res.json(); setStaffMembers(d.members ?? []); setStaffAssignable(d.assignable ?? []); }
    } catch (err) { console.error(err); } finally { setStaffLoading(false); }
  };

  useEffect(() => { if (activeMenu === 'settings' || activeMenu === 'staff' || activeMenu === 'finance') loadStaff(); }, [activeMenu]);

  // ---- Staff/HR board (activity · attendance · shifts · payroll) ----
  const [staffBoard, setStaffBoard] = useState<any>(null);
  const [staffBoardLoading, setStaffBoardLoading] = useState(false);
  const loadStaffBoard = async () => {
    setStaffBoardLoading(true);
    try {
      const res = await fetch('/api/dashboard/section?s=staff');
      if (res.ok) setStaffBoard((await res.json()).data || null);
    } catch (err) { console.error(err); } finally { setStaffBoardLoading(false); }
  };
  useEffect(() => {
    if (activeMenu !== 'staff') return;
    loadStaffBoard();
    const t = setInterval(loadStaffBoard, 20000); // live-ish refresh
    return () => clearInterval(t);
  }, [activeMenu]);

  // shift + payroll forms
  const [shiftForm, setShiftForm] = useState({ staffId: '', date: '', start: '09:00', end: '17:00', role: '' });
  const [payDraftId, setPayDraftId] = useState<string | null>(null);
  const [payDraft, setPayDraft] = useState({ payType: 'monthly', rate: '' });
  const [payRecId, setPayRecId] = useState<string | null>(null);
  const [payRec, setPayRec] = useState({ amount: '', method: 'cash', note: '' });

  const staffApi = async (payload: Record<string, unknown>, ok: string) => {
    const res = await fetch('/api/staff', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    const d = await res.json().catch(() => ({}));
    if (res.ok) { flashMessage(ok); loadStaff(); loadStaffBoard(); }
    else flashMessage(`Failed: ${(d.error ?? 'error').replace(/_/g, ' ')}`);
    return res.ok;
  };

  const handleSetPay = async (id: string) => {
    const rupees = payDraft.rate.trim() === '' ? null : parseFloat(payDraft.rate);
    if (rupees !== null && (!Number.isFinite(rupees) || rupees < 0)) { flashMessage('Enter a valid rate'); return; }
    if (await staffApi({ action: 'set_pay', id, payType: payDraft.payType, payRatePaise: rupees === null ? null : Math.round(rupees * 100) }, 'Pay updated')) setPayDraftId(null);
  };
  const handleRecordPay = async (id: string) => {
    const rupees = parseFloat(payRec.amount);
    if (!Number.isFinite(rupees) || rupees <= 0) { flashMessage('Enter a valid amount'); return; }
    if (await staffApi({ action: 'pay_record', id, amountPaise: Math.round(rupees * 100), method: payRec.method, note: payRec.note.trim() || undefined, periodLabel: staffBoard?.period }, 'Payment recorded')) { setPayRecId(null); setPayRec({ amount: '', method: 'cash', note: '' }); }
  };
  const handleAddShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftForm.staffId || !shiftForm.date) { flashMessage('Pick a staff member and date'); return; }
    const startsAt = new Date(`${shiftForm.date}T${shiftForm.start}`).toISOString();
    const endsAt = new Date(`${shiftForm.date}T${shiftForm.end}`).toISOString();
    if (await staffApi({ action: 'shift_add', staffId: shiftForm.staffId, startsAt, endsAt, role: shiftForm.role || undefined }, 'Shift added')) setShiftForm((f) => ({ ...f, role: '' }));
  };
  const handleRemoveShift = async (shiftId: string) => { await staffApi({ action: 'shift_remove', shiftId }, 'Shift removed'); };
  const handlePunch = async (staffId: string, action: 'in' | 'out') => {
    const res = await fetch('/api/attendance', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, staffId }) });
    if (res.ok) { flashMessage(action === 'in' ? 'Clocked in' : 'Clocked out'); loadStaffBoard(); }
    else flashMessage('Punch failed');
  };
  const handleSetPinFor = async (id: string, name: string) => {
    const pin = window.prompt(`Set a new login PIN for ${name} (4–6 digits):`);
    if (pin === null) return;
    if (!/^\d{4,6}$/.test(pin)) { flashMessage('PIN must be 4–6 digits'); return; }
    await staffApi({ action: 'setpin', id, pin }, 'PIN updated');
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuName.trim() || !nuPin) return;
    const res = await fetch('/api/staff', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'create', name: nuName.trim(), phone: nuPhone.trim() || undefined, role: nuRole, pin: nuPin }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) { flashMessage(`Added ${nuName} (${ROLE_LABELS[nuRole as keyof typeof ROLE_LABELS]})`); setNuName(''); setNuPhone(''); setNuPin(''); loadStaff(); }
    else flashMessage(`Could not add user: ${(d.error ?? 'failed').replace(/_/g, ' ')}`);
  };

  const handleStaffUpdate = async (id: string, patch: { role?: string; active?: boolean }) => {
    const res = await fetch('/api/staff', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'update', id, ...patch }) });
    const d = await res.json().catch(() => ({}));
    if (res.ok) { flashMessage('Staff updated'); loadStaff(); }
    else flashMessage(`Update failed: ${(d.error ?? 'failed').replace(/_/g, ' ')}`);
  };

  const handleRemoveUser = async (id: string, name: string) => {
    if (!confirm(`Remove ${name}? They will no longer be able to log in. History is preserved.`)) return;
    const res = await fetch('/api/staff', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'remove', id }) });
    const d = await res.json().catch(() => ({}));
    if (res.ok) { flashMessage(`${name} removed`); loadStaff(); }
    else flashMessage(`Could not remove: ${(d.error ?? 'failed').replace(/_/g, ' ')}`);
  };

  const canManageMember = (memberRole: string) =>
    staff.role === 'owner' || (staff.role === 'manager' && ['cashier', 'waiter', 'kitchen'].includes(memberRole));

  // 7. Menu item Availability toggles
  const handleToggleMenuAvailability = async (itemId: string, isAvailable: boolean) => {
    try {
      const res = await fetch('/api/dashboard/menu', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'availability', itemId, isAvailable }),
      });
      if (res.ok) { flashMessage(`Item marked ${isAvailable ? 'Available' : 'Sold Out'}`); loadInventoryData(); }
      else flashMessage('Could not update item');
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveItemLimit = async (item: any, limit: number | null) => {
    try {
      const otherTags = item.tags?.filter((t: string) => !t.startsWith('limit:')) || [];
      const nextTags = limit === null ? otherTags : [...otherTags, `limit:${limit}`];
      
      const res = await fetch('/api/dashboard/menu', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          itemId: item.id,
          tags: nextTags,
        }),
      });
      if (res.ok) {
        flashMessage(limit === null ? 'Limit cleared' : `Daily limit set to ${limit}`);
        loadInventoryData();
      } else {
        flashMessage('Could not save limit');
      }
    } catch (err) {
      console.error(err);
      flashMessage('Error saving limit');
    }
  };

  // inline price editing
  const [priceEditId, setPriceEditId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState('');
  const [menuSearch, setMenuSearch] = useState('');

  // product management (add + full customize)
  const GST_OPTIONS = [0, 5, 12, 18, 28];
  // kitchens/stations are configured per outlet — populated from the menu/settings section loads
  const [kitchens, setKitchens] = useState<Kitchen[]>([]);
  const [menuCategories, setMenuCategories] = useState<{ id: string; name: string }[]>([]);
  const [menuCatFilter, setMenuCatFilter] = useState('all'); // 'all' | category id | 'none'
  const blankProduct = { name: '', price: '', gstRate: '5', station: 'kitchen', categoryId: '', description: '', isAvailable: true, hsnCode: '', tags: [] as string[] };
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ ...blankProduct });
  const [newCategory, setNewCategory] = useState('');
  const [editProductId, setEditProductId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ ...blankProduct });

  // Station picker options = configured kitchens, plus the item's current value
  // if it's a legacy/removed slug (so editing never silently drops a routing).
  const stationOptions = (current: string) => {
    const list = kitchens.map((k) => ({ id: k.id, name: k.name }));
    if (current && !list.some((k) => k.id === current)) list.unshift({ id: current, name: current });
    return list;
  };
  // Default a new product to a real kitchen once the list loads.
  useEffect(() => {
    const first = kitchens[0];
    if (first && !kitchens.some((k) => k.id === newProduct.station)) {
      setNewProduct((p) => ({ ...p, station: first.id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kitchens]);

  const handleCreateCategory = async () => {
    const name = newCategory.trim();
    if (!name) return;
    try {
      const res = await fetch('/api/dashboard/menu', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'category_create', name }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.category) {
        flashMessage('Category added');
        setNewCategory('');
        setMenuCategories((prev) => [...prev, d.category]);
        setNewProduct((p) => ({ ...p, categoryId: d.category.id }));
      } else flashMessage('Could not add category');
    } catch (err) { console.error(err); }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const rupees = parseFloat(newProduct.price);
    if (!newProduct.name.trim()) { flashMessage('Enter a product name'); return; }
    if (!Number.isFinite(rupees) || rupees < 0) { flashMessage('Enter a valid price'); return; }
    try {
      const res = await fetch('/api/dashboard/menu', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name: newProduct.name.trim(),
          pricePaise: Math.round(rupees * 100),
          gstRate: Number(newProduct.gstRate),
          station: newProduct.station,
          categoryId: newProduct.categoryId || undefined,
          description: newProduct.description.trim() || undefined,
          isAvailable: newProduct.isAvailable,
          hsnCode: newProduct.hsnCode.trim() || undefined,
          tags: newProduct.tags,
        }),
      });
      if (res.ok) {
        flashMessage('Product added');
        setNewProduct({ ...blankProduct });
        setShowAddProduct(false);
        loadInventoryData();
      } else flashMessage('Could not add product');
    } catch (err) { console.error(err); }
  };

  const startEditProduct = (item: any) => {
    setEditProductId(item.id);
    setEditDraft({
      name: item.name ?? '',
      price: ((item.pricePaise ?? 0) / 100).toString(),
      gstRate: String(item.gstRate ?? 5),
      station: item.station ?? 'kitchen',
      categoryId: item.categoryId ?? '',
      description: item.description ?? '',
      isAvailable: !!item.isAvailable,
      hsnCode: item.hsnCode ?? '',
      tags: Array.isArray(item.tags) ? item.tags : [],
    });
  };

  const handleUpdateProduct = async (itemId: string) => {
    const rupees = parseFloat(editDraft.price);
    if (!editDraft.name.trim()) { flashMessage('Enter a product name'); return; }
    if (!Number.isFinite(rupees) || rupees < 0) { flashMessage('Enter a valid price'); return; }
    try {
      const res = await fetch('/api/dashboard/menu', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          itemId,
          name: editDraft.name.trim(),
          pricePaise: Math.round(rupees * 100),
          gstRate: Number(editDraft.gstRate),
          station: editDraft.station,
          categoryId: editDraft.categoryId || null,
          description: editDraft.description.trim(),
          isAvailable: editDraft.isAvailable,
          hsnCode: editDraft.hsnCode.trim() || null,
          tags: editDraft.tags,
        }),
      });
      if (res.ok) { flashMessage('Product updated'); setEditProductId(null); loadInventoryData(); }
      else flashMessage('Could not update product');
    } catch (err) { console.error(err); }
  };

  const handleDeleteProduct = async (itemId: string, name: string) => {
    if (!window.confirm(`Delete “${name}”? This cannot be undone.`)) return;
    try {
      const res = await fetch('/api/dashboard/menu', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'delete', itemId }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) { flashMessage('Product deleted'); setEditProductId(null); loadInventoryData(); }
      else flashMessage(d.message || 'Could not delete product');
    } catch (err) { console.error(err); }
  };

  // order detail + print (Orders view)
  const [orderDetail, setOrderDetail] = useState<any>(null);

  // Quick Custom Invoice / Bill Creator
  const [quickInvoiceOpen, setQuickInvoiceOpen] = useState(false);
  const [quickInvoiceLines, setQuickInvoiceLines] = useState<any[]>([]);
  const [quickInvoiceCustName, setQuickInvoiceCustName] = useState('');
  const [quickInvoiceCustPhone, setQuickInvoiceCustPhone] = useState('');

  // Live-floor: click an occupied table to see its running orders (reuses the POS
  // table-order endpoint — merged bill view of every unsettled order on the table).
  const [tableOrders, setTableOrders] = useState<{ label: string; data: any } | null>(null);
  const [tableOrdersLoading, setTableOrdersLoading] = useState(false);
  const openTableOrders = async (t: { id: string; label: string }) => {
    setTableOrders({ label: t.label, data: null });
    setTableOrdersLoading(true);
    try {
      const res = await fetch(`/api/tables/order?tableId=${encodeURIComponent(t.id)}`);
      if (res.ok) setTableOrders({ label: t.label, data: await res.json() });
      else { setTableOrders(null); flashMessage('Could not load table orders'); }
    } catch (err) {
      console.error(err); setTableOrders(null); flashMessage('Could not load table orders');
    } finally {
      setTableOrdersLoading(false);
    }
  };

  // escape owner-entered receipt text so it can't break the print markup
  const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // build the branded header (logo + name + custom lines + phone) shared by bill/receipt
  function receiptHeaderHtml() {
    const r = outlet.receipt;
    const logo = logoUrl ?? r.logoUrl;
    const parts = [
      r.showLogo && logo ? `<img src="${logo}" alt="" />` : '',
      `<h2>${escHtml(outlet.brand)}</h2>`,
      r.header.trim() ? `<div class="muted">${escHtml(r.header).replace(/\n/g, '<br/>')}</div>` : '',
      r.phone.trim() ? `<div class="muted">☎ ${escHtml(r.phone)}</div>` : '',
      r.showGstin && outlet.gstin ? `<div class="muted">GSTIN ${escHtml(outlet.gstin)}</div>` : '',
    ];
    return parts.filter(Boolean).join('\n');
  }
  const receiptFooterText = () => (outlet.receipt.footer.trim() ? escHtml(outlet.receipt.footer).replace(/\n/g, ' · ') : 'Thank you!');

  function printOrderDoc(title: string, inner: string) {
    const w = window.open('', '_blank', 'width=380,height=660');
    if (!w) { flashMessage('Allow pop-ups to print'); return; }
    const close = '<' + '/script>';
    w.document.write(`<html><head><title>${title}</title><style>
      *{font-family:ui-monospace,Menlo,monospace;color:#000;box-sizing:border-box}
      body{width:300px;margin:0 auto;padding:14px;font-size:12px}
      h2{text-align:center;margin:0 0 2px;font-size:15px}
      img{display:block;max-width:160px;max-height:80px;margin:0 auto 6px;object-fit:contain}
      .muted{color:#555;text-align:center;font-size:11px;margin-bottom:4px}
      table{width:100%;border-collapse:collapse} td{padding:2px 0;vertical-align:top} .r{text-align:right}
      .line{border-top:1px dashed #000;margin:8px 0} .tot{font-weight:700;font-size:14px}
    </style></head><body>${inner}<script>window.onload=function(){window.print();setTimeout(function(){window.close()},300)}${close}</body></html>`);
    w.document.close();
  }

  function printOrderBill(o: any) {
    const rows = o.items.map((i: any) => `<tr><td>${i.qty}× ${i.nameSnapshot}</td><td class="r">${formatINR(i.unitPricePaise * i.qty)}</td></tr>`).join('');
    const row = (label: string, val: number) => `<tr><td>${label}</td><td class="r">${formatINR(val)}</td></tr>`;
    printOrderDoc(`Bill #${o.number}`, `
      ${receiptHeaderHtml()}
      <div class="muted">Bill #${o.number} · ${o.table?.label ? 'Table ' + o.table.label : o.type} · ${new Date(o.placedAt).toLocaleString('en-IN')}</div>
      <div class="line"></div><table>${rows}</table><div class="line"></div>
      <table>
        ${row('Subtotal', o.subtotalPaise)}
        ${o.discountPaise > 0 ? row('Discount', -o.discountPaise) : ''}
        ${o.cgstPaise > 0 ? row('CGST', o.cgstPaise) : ''}
        ${o.sgstPaise > 0 ? row('SGST', o.sgstPaise) : ''}
        ${o.igstPaise > 0 ? row('IGST', o.igstPaise) : ''}
        ${o.serviceChargePaise > 0 ? row('Service charge', o.serviceChargePaise) : ''}
        ${row('Round off', o.roundOffPaise)}
        <tr class="tot"><td>Total</td><td class="r">${formatINR(o.totalPaise)}</td></tr>
      </table>
      <div class="line"></div><div class="muted">Status: ${o.status} · ${receiptFooterText()}</div>`);
  }

  function printOrderKOT(o: any) {
    const rows = o.items.map((i: any) => `<tr><td>${i.qty}×</td><td>${i.nameSnapshot}</td><td class="r">${i.station ?? ''}</td></tr>`).join('');
    printOrderDoc(`KOT #${o.number}`, `
      <h2>KOT · #${o.number}</h2>
      <div class="muted">${o.table?.label ? 'Table ' + o.table.label : o.type}</div>
      <div class="line"></div><table>${rows}</table>`);
  }

  const openQuickInvoice = () => {
    setQuickInvoiceOpen(true);
    setQuickInvoiceLines([{ key: '1', itemId: '', name: '', price: '', qty: 1, gst: 5, source: 'custom' }]);
    setQuickInvoiceCustName('');
    setQuickInvoiceCustPhone('');
    if (menuItems.length === 0) {
      loadInventoryData();
    }
  };

  const computeQuickInvoiceTotals = () => {
    let subtotalPaise = 0;
    let cgstPaise = 0;
    let sgstPaise = 0;

    const computedLines = quickInvoiceLines.map((l) => {
      const priceVal = parseFloat(l.price) || 0;
      const pricePaise = Math.round(priceVal * 100);
      const qtyVal = parseInt(l.qty) || 1;
      const lineTotalPaise = pricePaise * qtyVal;

      const gstRate = parseFloat(l.gst) || 0;
      const gstAmountPaise = Math.round((lineTotalPaise * gstRate) / 100);

      subtotalPaise += lineTotalPaise;
      cgstPaise += Math.round(gstAmountPaise / 2);
      sgstPaise += Math.round(gstAmountPaise / 2);

      return {
        ...l,
        pricePaise,
        qty: qtyVal,
        lineTotalPaise,
      };
    });

    const totalBeforeRoundPaise = subtotalPaise + cgstPaise + sgstPaise;
    const finalTotalPaise = Math.round(totalBeforeRoundPaise / 100) * 100;
    const roundOffPaise = finalTotalPaise - totalBeforeRoundPaise;

    return {
      lines: computedLines,
      subtotalPaise,
      cgstPaise,
      sgstPaise,
      roundOffPaise,
      totalPaise: finalTotalPaise,
    };
  };

  const handlePrintQuickBill = () => {
    const totals = computeQuickInvoiceTotals();
    if (totals.lines.length === 0) { flashMessage('Add at least one item'); return; }

    const rows = totals.lines.map((l: any) => `<tr><td>${l.qty}× ${l.name || 'Untitled Item'}</td><td class="r">${formatINR(l.lineTotalPaise)}</td></tr>`).join('');
    const row = (label: string, val: number) => `<tr><td>${label}</td><td class="r">${formatINR(val)}</td></tr>`;
    
    const randomNum = Math.floor(Math.random() * 9000) + 1000;
    const dateStr = new Date().toLocaleString('en-IN');
    const custLine = quickInvoiceCustName.trim() || quickInvoiceCustPhone.trim()
      ? `<div class="muted">👤 ${quickInvoiceCustName} ${quickInvoiceCustPhone}</div>`
      : '';

    printOrderDoc(`Quick Bill #${randomNum}`, `
      ${receiptHeaderHtml()}
      <div class="muted">Quick Bill #${randomNum} · ${dateStr}</div>
      ${custLine}
      <div class="line"></div><table>${rows}</table><div class="line"></div>
      <table>
        ${row('Subtotal', totals.subtotalPaise)}
        ${totals.cgstPaise > 0 ? row('CGST', totals.cgstPaise) : ''}
        ${totals.sgstPaise > 0 ? row('SGST', totals.sgstPaise) : ''}
        ${totals.roundOffPaise !== 0 ? row('Round off', totals.roundOffPaise) : ''}
        <tr class="tot"><td>Total</td><td class="r">${formatINR(totals.totalPaise)}</td></tr>
      </table>
      <div class="line"></div><div class="muted">Status: PAID · ${receiptFooterText()}</div>`);
  };

  const handlePrintQuickKOT = () => {
    const totals = computeQuickInvoiceTotals();
    if (totals.lines.length === 0) { flashMessage('Add at least one item'); return; }

    const rows = totals.lines.map((l: any) => `<tr><td>${l.qty}×</td><td>${l.name || 'Untitled Item'}</td><td class="r">Quick</td></tr>`).join('');
    const randomNum = Math.floor(Math.random() * 9000) + 1000;
    
    printOrderDoc(`KOT #${randomNum}`, `
      <h2>KOT · #${randomNum}</h2>
      <div class="muted">Quick KOT · ${new Date().toLocaleString('en-IN')}</div>
      <div class="line"></div><table>${rows}</table>`);
  };

  const handleSavePrice = async (itemId: string) => {
    const rupees = parseFloat(priceDraft);
    if (!Number.isFinite(rupees) || rupees < 0) { flashMessage('Enter a valid price'); return; }
    try {
      const res = await fetch('/api/dashboard/menu', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'price', itemId, pricePaise: Math.round(rupees * 100) }),
      });
      if (res.ok) { flashMessage('Price updated'); setPriceEditId(null); setPriceDraft(''); loadInventoryData(); }
      else flashMessage('Could not update price');
    } catch (err) {
      console.error(err);
    }
  };

  // Store profile editing (Settings → General)
  const [profile, setProfile] = useState({ name: '', gstin: '', stateCode: '', line1: '', city: '', pincode: '', gstEnabled: false, gstRate: '', gstType: 'exclusive' as 'exclusive' | 'inclusive' });
  const [gstSaving, setGstSaving] = useState(false);
  const [salesGst, setSalesGst] = useState<any>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Settings panel navigation — each panel now opens in a popup window.
  const [settingsPanel, setSettingsPanel] = useState<'general' | 'tax' | 'floor' | 'kitchen' | 'location' | 'devices' | 'pwa' | 'audit' | 'multibranch'>('general');
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const openSettings = (key: typeof settingsPanel) => { setSettingsPanel(key); setSettingsModalOpen(true); };
  const closeSettings = () => setSettingsModalOpen(false);

  // Location gate (Settings → Location Gate, owner only) — Outlet.settings.location.
  // lat/lng/radius held as strings for the inputs; converted on save.
  const [location, setLocation] = useState({ enabled: false, lat: '', lng: '', radiusM: '100', gateQrOrders: true, gatePosOrders: true, gateAttendance: true });
  const [locationSaving, setLocationSaving] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);

  // Kitchens / prep-station manager (Menu → Kitchens) — persisted to Outlet.settings.kitchens.
  const [newKitchenName, setNewKitchenName] = useState('');
  const [editKitchenId, setEditKitchenId] = useState<string | null>(null);
  const [editKitchenName, setEditKitchenName] = useState('');
  const [kitchenBusy, setKitchenBusy] = useState(false);

  // Store logo (Settings → General) — persisted to Outlet.settings.logoUrl.
  const [logoUrl, setLogoUrl] = useState<string | null>(outlet.receipt.logoUrl);
  const [logoBusy, setLogoBusy] = useState(false);

  // Receipt layout (Settings → Devices & Printers) — printed bill header/footer.
  const [receiptForm, setReceiptForm] = useState({
    header: outlet.receipt.header,
    footer: outlet.receipt.footer,
    phone: outlet.receipt.phone,
    showLogo: outlet.receipt.showLogo,
    showGstin: outlet.receipt.showGstin,
  });
  const [receiptSaving, setReceiptSaving] = useState(false);

  // Kitchen Workflow (Settings → Kitchen) — Outlet.settings.kitchenWorkflow.
  // Digital KDS / Printed KOT / Hybrid + all the KDS display options.
  const [kwForm, setKwForm] = useState<KitchenWorkflowConfig>(KITCHEN_WORKFLOW_DEFAULTS);
  const [kwSaving, setKwSaving] = useState(false);
  const setKw = <K extends keyof KitchenWorkflowConfig>(key: K, value: KitchenWorkflowConfig[K]) => setKwForm((p) => ({ ...p, [key]: value }));

  // Devices & printers (Settings → Devices)
  const [devices, setDevices] = useState<Device[]>([]);
  const blankDevice = { id: '', name: '', type: 'receipt_printer', connection: 'network', target: '', station: 'kitchen', copies: '1', isDefault: false };
  const [deviceForm, setDeviceForm] = useState<typeof blankDevice>({ ...blankDevice });
  const [showDeviceForm, setShowDeviceForm] = useState(false);

  // Floor & QR (Settings → Floor & QR) — table roster + per-table QR for the PWA
  const [floorTables, setFloorTables] = useState<FloorTable[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [newFloorName, setNewFloorName] = useState('');
  const [editFloorId, setEditFloorId] = useState<string | null>(null);
  const [editFloorName, setEditFloorName] = useState('');
  const [tableForm, setTableForm] = useState({ label: '', seats: '4', floorId: '' });
  const [bulkForm, setBulkForm] = useState({ count: '5', prefix: 'T', seats: '4', floorId: '' });
  const [showBulk, setShowBulk] = useState(false);
  const [editTableId, setEditTableId] = useState<string | null>(null);
  const [editTableDraft, setEditTableDraft] = useState({ label: '', seats: '4' });
  const [qrTable, setQrTable] = useState<FloorTable | null>(null); // QR preview/print modal
  const [floorBusy, setFloorBusy] = useState(false);

  // ── PWA Settings (customer app config) ──
  type PwaMenuItem = { id: string; name: string; pricePaise: number; imageUrl: string | null; categoryName: string | null };
  const [pwaCfg, setPwaCfg] = useState<PwaConfig | null>(null);
  const [pwaItems, setPwaItems] = useState<PwaMenuItem[]>([]);
  const [pwaTab, setPwaTab] = useState<'featured' | 'banners' | 'home' | 'gamification' | 'points' | 'wallet' | 'loyalty' | 'table' | 'registration' | 'theme'>('featured');
  const [pwaBusy, setPwaBusy] = useState(false);

  const loadPwa = async () => {
    try {
      const res = await fetch('/api/dashboard/section?s=pwa');
      if (res.ok) { const d = await res.json(); setPwaCfg(d.data?.config ?? null); setPwaItems(d.data?.menuItems ?? []); }
    } catch (err) { console.error(err); }
  };
  const setCfg = (fn: (c: PwaConfig) => PwaConfig) => setPwaCfg((prev) => (prev ? fn(prev) : prev));
  useEffect(() => { if (activeMenu === 'settings' && settingsPanel === 'pwa' && !pwaCfg) loadPwa(); }, [activeMenu, settingsPanel, pwaCfg]);

  // ── Audit Logs (Settings → Audit Logs, owner-only) ──
  type AuditEntry = { id: string; at: string; actorName: string; action: string; entity: string; entityId: string | null; before: Record<string, unknown> | null; after: Record<string, unknown> | null };
  type AuditOptions = { actions: string[]; entities: string[]; staff: { id: string; name: string }[] };
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditOptions, setAuditOptions] = useState<AuditOptions>({ actions: [], entities: [], staff: [] });
  const [auditFilters, setAuditFilters] = useState<{ action: string; entity: string; actorId: string }>({ action: '', entity: '', actorId: '' });
  const [auditPage, setAuditPage] = useState(1);
  const [auditHasMore, setAuditHasMore] = useState(false);
  const [auditBusy, setAuditBusy] = useState(false);
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);

  const loadAudit = async (page = 1, append = false) => {
    setAuditBusy(true);
    try {
      const qs = new URLSearchParams({ page: String(page) });
      if (auditFilters.action) qs.set('action', auditFilters.action);
      if (auditFilters.entity) qs.set('entity', auditFilters.entity);
      if (auditFilters.actorId) qs.set('actorId', auditFilters.actorId);
      const res = await fetch(`/api/dashboard/audit?${qs.toString()}`);
      if (res.ok) {
        const d = await res.json();
        setAuditEntries((prev) => (append ? [...prev, ...(d.entries ?? [])] : (d.entries ?? [])));
        setAuditHasMore(!!d.hasMore);
        setAuditPage(d.page ?? page);
        if (d.filterOptions) setAuditOptions(d.filterOptions);
      }
    } catch (err) { console.error(err); }
    finally { setAuditBusy(false); }
  };
  // first open → load; any filter change → reset to page 1
  useEffect(() => {
    if (activeMenu === 'settings' && settingsPanel === 'audit') { setExpandedAuditId(null); loadAudit(1); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMenu, settingsPanel, auditFilters.action, auditFilters.entity, auditFilters.actorId]);

  // POST one sub-block to /api/dashboard/pwa; server returns the normalized config
  const pwaSave = async (payload: Record<string, unknown>, okMsg = 'Saved') => {
    setPwaBusy(true);
    try {
      const res = await fetch('/api/dashboard/pwa', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const d = await res.json().catch(() => ({}));
      if (res.ok) { setPwaCfg(d.config ?? null); flashMessage(okMsg); return true; }
      flashMessage(`Could not save (${d.error ?? 'error'})`);
      return false;
    } catch (err) { console.error(err); flashMessage('Network error'); return false; }
    finally { setPwaBusy(false); }
  };

  // upload an image file → returns its public URL (or null)
  const uploadImage = async (file: File): Promise<string | null> => {
    const fd = new FormData();
    fd.append('image', file);
    try {
      const res = await fetch('/api/dashboard/upload', { method: 'POST', body: fd });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.url) return d.url as string;
      flashMessage(`Upload failed (${d.error ?? 'error'})`);
      return null;
    } catch { flashMessage('Upload failed'); return null; }
  };

  const handleSavePwa = async (cfg: PwaConfig) => {
    await pwaSave({ action: 'theme_save', theme: cfg.theme }, 'Theme branding saved');
    await pwaSave({ action: 'table_save', table: cfg.table }, 'Table QR routing saved');
    await pwaSave({ action: 'registration_save', registration: cfg.registration }, 'Customer access settings saved');
  };


  const loadProfile = async () => {
    try {
      const res = await fetch('/api/dashboard/section?s=settings');
      if (res.ok) {
        const d = await res.json();
        const o = d.data?.outlet;
        const a = (o?.address ?? {}) as any;
        setProfile({ name: o?.name ?? '', gstin: o?.gstin ?? '', stateCode: o?.stateCode ?? '', line1: a.line1 ?? '', city: a.city ?? '', pincode: a.pincode ?? '', gstEnabled: o?.gstEnabled ?? false, gstRate: o?.gstRate != null ? String(o.gstRate) : '', gstType: o?.gstType === 'inclusive' ? 'inclusive' : 'exclusive' });
        const loc = (o?.location ?? {}) as Partial<OutletLocation>;
        setLocation({
          enabled: !!loc.enabled,
          lat: loc.lat != null ? String(loc.lat) : '',
          lng: loc.lng != null ? String(loc.lng) : '',
          radiusM: loc.radiusM != null ? String(loc.radiusM) : '100',
          gateQrOrders: loc.gateQrOrders !== false,
          gatePosOrders: loc.gatePosOrders !== false,
          gateAttendance: loc.gateAttendance !== false,
        });
        setDevices(d.data?.devices ?? []);
        setFloorTables(d.data?.tables ?? []);
        setFloors(d.data?.floors ?? []);
        setKitchens(d.data?.kitchens ?? []);
        if (d.data?.kitchenWorkflow) setKwForm(d.data.kitchenWorkflow);
        setProfileLoaded(true);
      }
    } catch (err) { console.error(err); }
  };

  // --- Floor & QR actions ---------------------------------------------------
  const ERR_MSG: Record<string, string> = {
    duplicate_label: 'A table with that name already exists.',
    missing_label: 'Enter a table name.',
    table_in_use: 'This table has live or past orders — it can’t be deleted. Edit it instead.',
    forbidden: 'Only owners and managers can change the floor.',
  };

  const floorApi = async (payload: Record<string, unknown>, okMsg: string) => {
    setFloorBusy(true);
    try {
      const res = await fetch('/api/dashboard/floor', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) { flashMessage(okMsg); await loadProfile(); return true; }
      flashMessage(ERR_MSG[d.error as string] ?? `Could not save (${d.error ?? 'error'})`);
      return false;
    } catch (err) { console.error(err); flashMessage('Network error'); return false; }
    finally { setFloorBusy(false); }
  };

  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableForm.label.trim()) { flashMessage('Enter a table name'); return; }
    if (await floorApi({ action: 'create', label: tableForm.label.trim(), seats: Number(tableForm.seats) || 2, floorId: tableForm.floorId || undefined }, `Table ${tableForm.label.trim()} added`)) {
      setTableForm({ label: '', seats: tableForm.seats, floorId: tableForm.floorId });
    }
  };
  const handleBulkAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await floorApi({ action: 'bulk', count: Number(bulkForm.count) || 0, prefix: bulkForm.prefix.trim() || 'T', seats: Number(bulkForm.seats) || 2, floorId: bulkForm.floorId || undefined }, 'Tables added')) {
      setShowBulk(false);
    }
  };
  // --- floors / areas ---
  const handleAddFloor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFloorName.trim()) { flashMessage('Enter a floor name'); return; }
    if (await floorApi({ action: 'floor_add', name: newFloorName.trim() }, `Floor “${newFloorName.trim()}” added`)) setNewFloorName('');
  };
  const handleRenameFloor = async (floorId: string) => {
    if (!editFloorName.trim()) { flashMessage('Enter a floor name'); return; }
    if (await floorApi({ action: 'floor_rename', floorId, name: editFloorName.trim() }, 'Floor renamed')) setEditFloorId(null);
  };
  const handleDeleteFloor = (f: Floor) => {
    const n = floorTables.filter((t) => t.floorId === f.id).length;
    if (!window.confirm(`Delete floor “${f.name}”?${n ? ` Its ${n} table${n === 1 ? '' : 's'} will become Unassigned.` : ''}`)) return;
    floorApi({ action: 'floor_delete', floorId: f.id }, `Floor “${f.name}” deleted`);
  };

  // --- Kitchens / prep stations (Outlet.settings.kitchens) ---
  const KITCHEN_ERR: Record<string, string> = {
    duplicate_name: 'A kitchen with that name already exists.',
    missing_name: 'Enter a kitchen name.',
    last_kitchen: 'Keep at least one kitchen.',
    forbidden: 'Only owners and managers can change kitchens.',
  };
  const kitchenApi = async (payload: Record<string, unknown>, okMsg: string) => {
    setKitchenBusy(true);
    try {
      const res = await fetch('/api/dashboard/settings', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(d.kitchens)) { setKitchens(d.kitchens); flashMessage(okMsg); return true; }
      flashMessage(KITCHEN_ERR[d.error as string] ?? `Could not save (${d.error ?? 'error'})`);
      return false;
    } catch (err) { console.error(err); flashMessage('Network error'); return false; }
    finally { setKitchenBusy(false); }
  };
  const handleAddKitchen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKitchenName.trim()) { flashMessage('Enter a kitchen name'); return; }
    if (await kitchenApi({ action: 'kitchen_add', name: newKitchenName.trim() }, `Kitchen “${newKitchenName.trim()}” added`)) setNewKitchenName('');
  };
  const handleRenameKitchen = async (id: string) => {
    if (!editKitchenName.trim()) { flashMessage('Enter a kitchen name'); return; }
    if (await kitchenApi({ action: 'kitchen_rename', id, name: editKitchenName.trim() }, 'Kitchen renamed')) setEditKitchenId(null);
  };
  const handleDeleteKitchen = (k: Kitchen) => {
    if (!window.confirm(`Delete kitchen “${k.name}”? Items routed here keep their tag until you reassign them.`)) return;
    kitchenApi({ action: 'kitchen_delete', id: k.id }, `Kitchen “${k.name}” deleted`);
  };
  const handleAssignFloor = (tableId: string, floorId: string) => {
    floorApi({ action: 'assign', id: tableId, floorId: floorId || undefined }, 'Table moved');
  };

  const renderTableCard = (t: FloorTable) => {
    const occupied = t.activeOrders > 0;
    return (
      <div key={t.id} className="rounded-2xl border p-3 flex gap-3" style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }}>
        <button onClick={() => setQrTable(t)} className="shrink-0 rounded-xl overflow-hidden bg-white grid place-items-center" style={{ width: 76, height: 76, border: '1px solid var(--line-2)' }} title="View / print QR" aria-label={`View QR for ${t.label}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={tableQrImageUrl(t.qrToken, 150)} alt={`QR for ${t.label}`} width={68} height={68} loading="lazy" />
        </button>
        <div className="min-w-0 flex-1">
          {editTableId === t.id ? (
            <div className="flex flex-col gap-2">
              <input value={editTableDraft.label} onChange={(e) => setEditTableDraft((p) => ({ ...p, label: e.target.value }))} className="w-full p-2 rounded-lg border text-sm outline-none" style={{ background: 'var(--paper-2)', borderColor: 'var(--line-2)' }} />
              <div className="flex items-center gap-2">
                <input type="number" min={1} max={50} value={editTableDraft.seats} onChange={(e) => setEditTableDraft((p) => ({ ...p, seats: e.target.value }))} className="w-16 p-2 rounded-lg border text-sm outline-none" style={{ background: 'var(--paper-2)', borderColor: 'var(--line-2)' }} />
                <span className="text-xs text-ink-3">seats</span>
                <button onClick={() => handleSaveTable(t.id)} disabled={floorBusy} className="btn btn-primary py-1 px-2.5 text-xs ml-auto disabled:opacity-50">Save</button>
                <button onClick={() => setEditTableId(null)} className="btn py-1 px-2.5 text-xs" style={{ background: 'var(--paper-2)', border: '1px solid var(--line)' }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <b className="text-base truncate">{t.label}</b>
                <span className="pill text-[10px]" style={{ color: occupied ? 'var(--clay)' : 'var(--cardamom-d)', background: occupied ? 'rgba(192,57,43,.10)' : 'rgba(90,138,90,.12)' }}>
                  {occupied ? `● ${t.activeOrders} order${t.activeOrders === 1 ? '' : 's'}` : '○ free'}
                </span>
              </div>
              <span className="block text-xs text-ink-3 mt-0.5">{t.seats} seat{t.seats === 1 ? '' : 's'}</span>
              {floors.length > 0 && (
                <select value={t.floorId ?? ''} onChange={(e) => handleAssignFloor(t.id, e.target.value)} className="mt-1.5 w-full p-1.5 rounded-lg border text-xs outline-none" style={{ background: 'var(--paper-2)', borderColor: 'var(--line-2)' }} aria-label={`Floor for ${t.label}`}>
                  <option value="">Unassigned</option>
                  {floors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              )}
              <div className="flex flex-wrap gap-1.5 mt-2">
                <button onClick={() => setQrTable(t)} className="btn py-1 px-2.5 text-xs" style={{ background: 'var(--paper-2)', border: '1px solid var(--line)' }}>QR</button>
                <button onClick={() => copyTableLink(t)} className="btn py-1 px-2.5 text-xs" style={{ background: 'var(--paper-2)', border: '1px solid var(--line)' }}>Copy link</button>
                <button onClick={() => startEditTable(t)} className="btn py-1 px-2.5 text-xs" style={{ background: 'var(--paper-2)', border: '1px solid var(--line)' }}>Edit</button>
                <button onClick={() => handleDeleteTable(t)} disabled={occupied} title={occupied ? 'Free the table before deleting' : 'Delete table'} className="btn py-1 px-2.5 text-xs disabled:opacity-40" style={{ background: 'var(--paper-2)', border: '1px solid var(--clay)', color: 'var(--clay)' }}>Delete</button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };
  const startEditTable = (t: FloorTable) => { setEditTableId(t.id); setEditTableDraft({ label: t.label, seats: String(t.seats) }); };
  const handleSaveTable = async (id: string) => {
    if (!editTableDraft.label.trim()) { flashMessage('Enter a table name'); return; }
    if (await floorApi({ action: 'update', id, label: editTableDraft.label.trim(), seats: Number(editTableDraft.seats) || 2 }, 'Table updated')) {
      setEditTableId(null);
    }
  };
  const handleDeleteTable = (t: FloorTable) => {
    if (!window.confirm(`Delete table “${t.label}”? This can’t be undone.`)) return;
    floorApi({ action: 'delete', id: t.id }, `Table ${t.label} deleted`);
  };
  const handleRegenerateQr = (t: FloorTable) => {
    if (!window.confirm(`Rotate the QR for “${t.label}”? Any printed code for this table will stop working.`)) return;
    floorApi({ action: 'regenerate', id: t.id }, `New QR generated for ${t.label}`).then((ok) => { if (ok) setQrTable(null); });
  };
  const copyTableLink = async (t: FloorTable) => {
    try { await navigator.clipboard.writeText(tableOrderUrl(t.qrToken)); flashMessage(`Link for ${t.label} copied`); }
    catch { flashMessage('Could not copy link'); }
  };
  const printTableQr = (t: FloorTable) => {
    const url = tableOrderUrl(t.qrToken);
    const img = tableQrImageUrl(t.qrToken, 600);
    const w = window.open('', '_blank', 'width=420,height=560');
    if (!w) { flashMessage('Allow pop-ups to print'); return; }
    const close = '<' + '/script>';
    w.document.write(`<html><head><title>QR · ${t.label}</title><style>
      *{font-family:ui-sans-serif,system-ui,sans-serif;color:#1e120a;box-sizing:border-box}
      body{width:300px;margin:0 auto;padding:24px;text-align:center}
      h1{font-size:22px;margin:0 0 2px} .sub{color:#6b5b4d;font-size:13px;margin-bottom:16px}
      img{width:260px;height:260px} .lbl{font-size:34px;font-weight:800;margin:14px 0 2px}
      .tap{font-size:13px;color:#6b5b4d} .url{font-size:10px;color:#9a8a7c;word-break:break-all;margin-top:10px}
    </style></head><body>
      <h1>${outlet.brand}</h1><div class="sub">Scan to view the menu &amp; order</div>
      <img src="${img}" alt="QR for ${t.label}" />
      <div class="lbl">${t.label}</div><div class="tap">Point your camera here</div>
      <div class="url">${url}</div>
      <script>var i=document.images[0];function go(){window.print();setTimeout(function(){window.close()},300)}i.complete?go():(i.onload=go,i.onerror=go)${close}
    </body></html>`);
    w.document.close();
  };

  useEffect(() => { if (activeMenu === 'settings' && !profileLoaded) loadProfile(); }, [activeMenu, profileLoaded]);

  const openDeviceForm = (dev?: Device) => {
    if (dev) {
      setDeviceForm({ id: dev.id, name: dev.name, type: dev.type, connection: dev.connection, target: dev.target, station: dev.station ?? 'kitchen', copies: String(dev.copies), isDefault: dev.isDefault });
    } else {
      setDeviceForm({ ...blankDevice });
    }
    setShowDeviceForm(true);
  };

  const handleSaveDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceForm.name.trim()) { flashMessage('Enter a device name'); return; }
    try {
      const res = await fetch('/api/dashboard/settings', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'device_save',
          device: {
            id: deviceForm.id || undefined,
            name: deviceForm.name.trim(),
            type: deviceForm.type,
            connection: deviceForm.connection,
            target: deviceForm.target.trim(),
            station: deviceForm.station,
            copies: Number(deviceForm.copies) || 1,
            isDefault: deviceForm.isDefault,
          },
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) { flashMessage(deviceForm.id ? 'Device updated' : 'Device added'); setDevices(d.devices ?? []); setShowDeviceForm(false); }
      else flashMessage('Could not save device');
    } catch (err) { console.error(err); }
  };

  const handleDeleteDevice = async (id: string, name: string) => {
    if (!window.confirm(`Remove “${name}”?`)) return;
    try {
      const res = await fetch('/api/dashboard/settings', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'device_delete', id }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) { flashMessage('Device removed'); setDevices(d.devices ?? []); }
      else flashMessage('Could not remove device');
    } catch (err) { console.error(err); }
  };

  const handleSetDefaultDevice = async (dev: Device) => {
    try {
      const res = await fetch('/api/dashboard/settings', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'device_save', device: { ...dev, isDefault: true } }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) { setDevices(d.devices ?? []); flashMessage('Default set'); }
    } catch (err) { console.error(err); }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // GST is managed in its own Tax & GST panel; profile save leaves it untouched.
      const res = await fetch('/api/dashboard/settings', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'outlet', name: profile.name, gstin: profile.gstin || null, stateCode: profile.stateCode || null, address: { line1: profile.line1, city: profile.city, pincode: profile.pincode } }),
      });
      if (res.ok) { flashMessage('Store profile saved'); router.refresh(); }
      else flashMessage('Could not save profile');
    } catch (err) {
      console.error(err);
    }
  };

  // Settings → Tax & GST — saves only the GST config block
  const handleSaveGst = async (e: React.FormEvent) => {
    e.preventDefault();
    setGstSaving(true);
    try {
      const res = await fetch('/api/dashboard/settings', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'outlet',
          gstEnabled: profile.gstEnabled,
          gstRate: profile.gstRate.trim() === '' ? null : Number(profile.gstRate),
          gstType: profile.gstType,
        }),
      });
      if (res.ok) { flashMessage(profile.gstEnabled ? 'GST settings saved' : 'GST turned off — bills are now tax-free'); router.refresh(); }
      else flashMessage('Could not save GST settings');
    } catch (err) { console.error(err); }
    finally { setGstSaving(false); }
  };

  // Settings → Location Gate — capture the owner's current position as the cafe pin.
  const useMyLocation = async () => {
    setGeoBusy(true);
    try {
      const h = await getGeoHeaders(12000);
      if (h['x-geo-lat'] && h['x-geo-lng']) {
        setLocation((p) => ({ ...p, lat: h['x-geo-lat']!, lng: h['x-geo-lng']! }));
        flashMessage('Pinned to your current location');
      } else {
        flashMessage('Could not read your location — allow location access and try again');
      }
    } finally { setGeoBusy(false); }
  };

  // Settings → Location Gate — saves only the location block (owner only server-side).
  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocationSaving(true);
    try {
      const res = await fetch('/api/dashboard/settings', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'location',
          location: {
            enabled: location.enabled,
            lat: location.lat.trim() === '' ? null : Number(location.lat),
            lng: location.lng.trim() === '' ? null : Number(location.lng),
            radiusM: location.radiusM.trim() === '' ? 100 : Number(location.radiusM),
            gateQrOrders: location.gateQrOrders,
            gatePosOrders: location.gatePosOrders,
            gateAttendance: location.gateAttendance,
          },
        }),
      });
      if (res.ok) { flashMessage(location.enabled ? 'Location gate saved' : 'Location gate turned off'); router.refresh(); }
      else flashMessage('Could not save location settings');
    } catch (err) { console.error(err); flashMessage('Could not save location settings'); }
    finally { setLocationSaving(false); }
  };

  // Settings → General → Store Logo
  const saveLogo = async (url: string | null) => {
    setLogoBusy(true);
    try {
      const res = await fetch('/api/dashboard/settings', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'outlet', logoUrl: url }),
      });
      if (res.ok) { setLogoUrl(url); flashMessage(url ? 'Logo updated' : 'Logo removed'); router.refresh(); }
      else flashMessage('Could not save logo');
    } catch (err) { console.error(err); flashMessage('Could not save logo'); }
    finally { setLogoBusy(false); }
  };
  const handleLogoFile = async (file: File) => {
    setLogoBusy(true);
    const url = await uploadImage(file);
    setLogoBusy(false);
    if (url) await saveLogo(url);
  };

  // Settings → Devices & Printers → Receipt Layout
  const handleSaveReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    setReceiptSaving(true);
    try {
      const res = await fetch('/api/dashboard/settings', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'receipt', receipt: receiptForm }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        if (d.receipt) setReceiptForm({ header: d.receipt.header, footer: d.receipt.footer, phone: d.receipt.phone, showLogo: d.receipt.showLogo, showGstin: d.receipt.showGstin });
        flashMessage('Receipt layout saved'); router.refresh();
      } else flashMessage('Could not save receipt layout');
    } catch (err) { console.error(err); flashMessage('Could not save receipt layout'); }
    finally { setReceiptSaving(false); }
  };

  const handleSaveKitchenWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    setKwSaving(true);
    try {
      const res = await fetch('/api/dashboard/settings', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'kitchen_workflow', workflow: kwForm }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        if (d.kitchenWorkflow) setKwForm(d.kitchenWorkflow);
        flashMessage('Kitchen workflow saved'); router.refresh();
      } else flashMessage('Could not save kitchen workflow');
    } catch (err) { console.error(err); flashMessage('Could not save kitchen workflow'); }
    finally { setKwSaving(false); }
  };

  // ── Report export — Excel (.xls) + print-to-PDF, dependency-free ──
  const escCell = (s: string | number) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const reportFileBase = (name: string) => `${outlet.brand}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  function exportExcel(name: string, title: string, headers: string[], rows: (string | number)[][]) {
    const thead = `<tr>${headers.map((h) => `<th>${escCell(h)}</th>`).join('')}</tr>`;
    const tbody = rows.map((r) => `<tr>${r.map((c) => `<td>${escCell(c)}</td>`).join('')}</tr>`).join('');
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"/><style>td,th{border:1px solid #ccc;padding:4px 8px;text-align:left} th{background:#f2e9da;font-weight:bold}</style></head><body><h3>${escCell(title)}</h3><table>${thead}${tbody}</table></body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${reportFileBase(name)}.xls`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    flashMessage('Excel file downloaded');
  }

  function exportPdf(title: string, headers: string[], rows: (string | number)[][]) {
    const w = window.open('', '_blank', 'width=820,height=900');
    if (!w) { flashMessage('Allow pop-ups to export'); return; }
    const close = '<' + '/script>';
    const thead = `<tr>${headers.map((h) => `<th>${escCell(h)}</th>`).join('')}</tr>`;
    const tbody = rows.map((r) => `<tr>${r.map((c, i) => `<td class="${i === 0 ? 'l' : ''}">${escCell(c)}</td>`).join('')}</tr>`).join('');
    w.document.write(`<html><head><title>${escCell(title)}</title><style>
      *{font-family:ui-sans-serif,system-ui,sans-serif;color:#1e120a;box-sizing:border-box}
      body{padding:28px;max-width:760px;margin:0 auto}
      h1{font-size:20px;margin:0 0 2px} .sub{color:#6b5b4d;font-size:12px;margin-bottom:16px}
      table{width:100%;border-collapse:collapse;font-size:13px}
      th,td{border-bottom:1px solid #ddd;padding:7px 6px;text-align:right} th:first-child,td.l{text-align:left} th{background:#f7efe2}
    </style></head><body>
      <h1>${escCell(outlet.brand)}</h1><div class="sub">${escCell(title)} · ${new Date().toLocaleString('en-IN')}</div>
      <table><thead>${thead}</thead><tbody>${tbody}</tbody></table>
      <script>window.onload=function(){window.print()}${close}</body></html>`);
    w.document.close();
  }

  /** Export toolbar (Excel + PDF) shown on each Reports tab. */
  const ExportBar = ({ name, title, headers, rows }: { name: string; title: string; headers: string[]; rows: (string | number)[][] }) => (
    <div className="flex items-center gap-2 shrink-0">
      <button type="button" onClick={() => exportExcel(name, title, headers, rows)} disabled={!rows.length} className="btn btn-sm inline-flex items-center gap-1.5 disabled:opacity-50" style={{ background: 'var(--paper-3)', border: '1px solid var(--line)' }}><Download size={14} aria-hidden /> Excel</button>
      <button type="button" onClick={() => exportPdf(title, headers, rows)} disabled={!rows.length} className="btn btn-sm inline-flex items-center gap-1.5 disabled:opacity-50" style={{ background: 'var(--paper-3)', border: '1px solid var(--line)' }}><Download size={14} aria-hidden /> PDF</button>
    </div>
  );

  // GST report data (exact figures) loaded when the Finance → GST tab or Reports → GST tab opens
  useEffect(() => {
    if ((activeMenu === 'reports' || activeMenu === 'finance') && activeSubTab === 'gst' && !salesGst) {
      fetch('/api/dashboard/section?s=sales').then((r) => (r.ok ? r.json() : null)).then((d) => setSalesGst(d?.data ?? null)).catch(() => {});
    }
  }, [activeMenu, activeSubTab, salesGst]);

  async function logout() {
    // clock out (no-op if no open punch) before ending the session, so attendance
    // never has a dangling punch — same behaviour as the ShiftStatus "Out" button
    await fetch('/api/attendance', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'out' }) }).catch(() => {});
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.replace('/login');
    router.refresh();
  }

  // Calculated estimated profit (70% margin default)
  const totalSales = kpi.todaySalesPaise;
  const estimatedProfit = Math.round(totalSales * 0.70);

  const isExpanded = isHovered;

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--paper)' }}>
      {/* sidebar rail — collapsible (hidden on mobile; nav uses the header dropdown there) */}
      <aside
        className="hidden md:flex flex-col shrink-0 md:sticky md:top-0 md:h-screen md:self-start overflow-hidden"
        style={{
          width: isExpanded ? 248 : 72,
          borderRight: '1px solid var(--line)',
          background: 'var(--paper-2)',
          transition: 'width 220ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          setHoveredItem(null);
        }}
      >
      <div className={`flex flex-col gap-1 w-full h-full min-h-0 relative ${isExpanded ? 'p-4' : 'pt-4 pb-4 px-2'}`} style={{ width: isExpanded ? 248 : 72 }}>
        {/* Logo container with smooth transitions */}
        <div className="flex items-center justify-center h-16 mb-4 relative w-full shrink-0">
          <motion.div
            initial={false}
            animate={{ opacity: isExpanded ? 1 : 0, scale: isExpanded ? 1 : 0.8 }}
            transition={{ duration: 0.2 }}
            className={`absolute inset-0 flex items-center justify-center ${isExpanded ? 'pointer-events-auto' : 'pointer-events-none'}`}
          >
            <img src="/logo chaya one.png" alt="ChayaOne" style={{ width: '100%', height: 'auto', margin: 0, maxWidth: 140 }} className="brand-logo object-contain" />
          </motion.div>
          <motion.div
            initial={false}
            animate={{ opacity: isExpanded ? 0 : 1, scale: isExpanded ? 0.8 : 1 }}
            transition={{ duration: 0.2 }}
            className={`absolute inset-0 flex items-center justify-center ${!isExpanded ? 'pointer-events-auto' : 'pointer-events-none'}`}
          >
            <img src="/app.png" alt="ChayaOne" style={{ width: 36, height: 36, margin: 0 }} className="object-contain" />
          </motion.div>
        </div>

        <nav className="flex flex-col gap-1 flex-1 min-h-0 overflow-y-auto overflow-x-hidden no-scrollbar shrink-0">
          {visibleMenus.map((m, i) => {
            const on = activeMenu === m.key;
            const Ic = m.icon;
            return (
              <button
                key={m.key}
                onClick={() => {
                  setActiveMenu(m.key);
                  setLiveOrders(0);
                }}
                aria-current={on ? 'page' : undefined}
                className={`group relative flex items-center rounded-xl transition ${
                  isExpanded ? 'gap-2.5 px-2 py-1 w-full text-left' : 'justify-center w-8 h-8 mx-auto shrink-0'
                } ${
                  isExpanded
                    ? on
                      ? 'text-white font-bold'
                      : 'text-[var(--ink-2)] hover:bg-[var(--paper-3)] hover:text-[var(--ink)]'
                    : ''
                }`}
                style={
                  isExpanded && on
                    ? {
                        background: 'var(--turmeric)',
                        boxShadow: '0 4px 12px -3px color-mix(in srgb, var(--turmeric) 70%, transparent)',
                      }
                    : undefined
                }
                onMouseEnter={(e) => {
                  if (!isExpanded) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setHoveredItem({
                      label: m.label,
                      top: rect.top + rect.height / 2,
                      right: rect.right,
                    });
                  }
                }}
                onMouseLeave={() => {
                  setHoveredItem(null);
                }}
              >
                {/* Icon wrapper */}
                <div
                  className={`grid place-items-center w-8 h-8 rounded-full transition shrink-0 ${
                    !isExpanded
                      ? on
                        ? 'bg-[var(--turmeric)] text-white shadow-sm'
                        : 'text-[var(--ink-2)] group-hover:bg-[var(--paper-3)] group-hover:text-[var(--ink)]'
                      : 'text-inherit'
                  }`}
                  style={
                    !isExpanded && on
                      ? { boxShadow: '0 4px 12px -3px color-mix(in srgb, var(--turmeric) 70%, transparent)' }
                      : undefined
                  }
                >
                  <Ic size={16} aria-hidden />
                </div>
                {/* Text Label */}
                {isExpanded && (
                  <span className="font-semibold text-sm transition-opacity duration-200 whitespace-nowrap">
                    {m.label}
                  </span>
                )}
                {/* Live orders badge */}
                {m.key === 'dashboard' && liveOrders > 0 && isExpanded && (
                  <span className="ml-auto bg-[var(--clay)] text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                    {liveOrders}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Open Till (POS) Link */}
        <div className={`transition-all duration-200 overflow-hidden shrink-0 ${isExpanded ? 'opacity-100 h-auto mt-2' : 'opacity-0 h-0 pointer-events-none'}`}>
          <button
            onClick={() => setShowPos(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-xl transition font-bold cursor-pointer text-left w-full hover:bg-[var(--paper-3)]"
            style={{ color: 'var(--turmeric-d)' }}
          >
            <Table2 size={16} aria-hidden /> Open Till (POS)
          </button>
        </div>

        {/* Manager Dashboard Link */}
        {staff.role === 'manager' && (
          <div className={`transition-all duration-200 overflow-hidden shrink-0 ${isExpanded ? 'opacity-100 h-auto mt-1' : 'opacity-0 h-0 pointer-events-none'}`}>
            <Link href="/dashboard" className="flex items-center gap-2 px-3 py-2 text-sm rounded-xl transition font-bold hover:bg-[var(--paper-3)]" style={{ color: 'var(--turmeric-d)' }}>
              <LayoutDashboard size={16} aria-hidden /> Manager Dashboard
            </Link>
          </div>
        )}



        {/* Logout Button */}
        <button
          onClick={logout}
          className={`group flex items-center text-sm text-left transition-all duration-200 shrink-0 ${
            isExpanded
              ? 'px-2 py-1 rounded-xl gap-2 w-full mt-2 hover:bg-[var(--paper-3)] text-[var(--ink-3)] hover:text-[var(--ink)]'
              : 'justify-center w-8 h-8 rounded-xl mx-auto mt-auto'
          }`}
          title={!isExpanded ? 'Log out' : undefined}
          onMouseEnter={(e) => {
            if (!isExpanded) {
              const rect = e.currentTarget.getBoundingClientRect();
              setHoveredItem({
                label: 'Log out',
                top: rect.top + rect.height / 2,
                right: rect.right,
              });
            }
          }}
          onMouseLeave={() => {
            setHoveredItem(null);
          }}
        >
          <div
            className={`grid place-items-center w-8 h-8 rounded-full transition shrink-0 ${
              !isExpanded ? 'group-hover:bg-[var(--paper-3)] group-hover:text-[var(--ink)]' : ''
            }`}
          >
            <LogOut size={16} aria-hidden />
          </div>
          {isExpanded && <span>Log out</span>}
        </button>
      </div>
      </aside>

      <main className="min-w-0 flex-1 flex flex-col gap-4 px-5 pt-5 md:px-7 md:pt-7 pb-[calc(76px_+_env(safe-area-inset-bottom))] lg:pb-7">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b" style={{ borderColor: 'var(--line)' }}>
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile: open the slide-out drawer (full menu) */}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              aria-expanded={drawerOpen}
              aria-haspopup="dialog"
              className="btn btn-icon btn-sm md:hidden shrink-0"
            >
              <Menu size={18} aria-hidden />
            </button>
            <div className="min-w-0">
              <h1 className="font-display text-2xl sm:text-3xl md:text-4xl leading-tight truncate">
                {activeMenu === 'home' ? outlet.name
                  : activeMenu === 'ai' ? 'AI Assistant'
                  : activeMenu.charAt(0).toUpperCase() + activeMenu.slice(1)}
              </h1>
              <p className="text-xs truncate" style={{ color: 'var(--ink-3)' }}>
                {outlet.brand} · {staff.name} · <span className="capitalize">{staff.role}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Table occupancy status indicator in header */}
            {tablesData && (
              <button
                type="button"
                onClick={() => {
                  setActiveMenu('home');
                  setActiveSubTab('floor');
                }}
                title="Click to view Live Floor Map"
                className="btn btn-sm inline-flex items-center gap-1.5 hover:opacity-85 transition cursor-pointer"
                style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', color: 'var(--ink)' }}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: (tablesData?.totals?.occupied ?? 0) > 0 ? 'var(--turmeric)' : 'var(--cardamom)' }} />
                <span>Tables: {tablesData?.totals?.occupied ?? 0} / {tablesData?.totals?.tables ?? 0}</span>
              </button>
            )}
            {/* Open POS — always visible in header; replaces sidebar POS link */}
            <button
              onClick={() => setShowPos(true)}
              className="btn btn-sm inline-flex items-center gap-1.5 hover:opacity-85 transition cursor-pointer"
              id="header-open-pos"
              style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', color: 'var(--ink)' }}
            >
              <Store size={15} aria-hidden /> Open POS
            </button>
            <span className="pill" style={{ color: connected ? 'var(--cardamom-d)' : 'var(--ink-3)' }}>
              <span
                ref={liveDot}
                className="inline-block w-2 h-2 rounded-full"
                style={{ background: connected ? 'var(--cardamom)' : 'var(--ink-3)', animation: connected ? 'pulse 2s infinite' : 'none' }}
              />
              {connected ? 'Live' : 'Offline'}
            </span>

            <ThemeToggle />

            {/* notification bell */}
            <div className="relative">
              <button onClick={() => { setBellOpen((o) => !o); if (!bellOpen) loadNotifs(); }} className="relative w-9 h-9 rounded-xl grid place-items-center" style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', color: 'var(--ink-2)' }} aria-label={unread > 0 ? `Alerts, ${unread} unread` : 'Alerts'}>
                <Bell size={18} aria-hidden />
                {unread > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full text-[10px] font-extrabold text-white tnum" style={{ background: 'var(--clay)' }}>{unread > 99 ? '99+' : unread}</span>}
              </button>
              {bellOpen && (
                <>
                  <div className="fixed inset-0 z-[40]" onClick={() => setBellOpen(false)} />
                  <div className="absolute right-0 mt-2 w-[min(320px,calc(100vw_-_24px))] max-h-[440px] overflow-auto z-[50] rounded-2xl shadow-3" style={{ background: 'var(--paper-2)', border: '1px solid var(--line)' }}>
                    <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0" style={{ borderColor: 'var(--line)', background: 'var(--paper-2)' }}>
                      <b className="text-sm">Alerts</b>
                      {unread > 0 && <button onClick={markAllRead} className="text-xs font-bold" style={{ color: 'var(--turmeric-d)' }}>Mark all read</button>}
                    </div>
                    {notifs.length === 0 ? (
                      <p className="text-sm text-ink-3 p-5 text-center">No alerts. You’re all caught up. ✨</p>
                    ) : (
                      <div className="flex flex-col">
                        {notifs.map((n) => (
                          <button key={n.id} onClick={() => !n.readAt && markRead(n.id)} className="text-left px-4 py-3 border-b flex gap-3 items-start transition" style={{ borderColor: 'var(--line)', background: n.readAt ? 'transparent' : 'color-mix(in srgb, var(--turmeric) 7%, transparent)' }}>
                            <span className="text-base leading-none mt-0.5">{n.severity === 'critical' ? '🔴' : n.severity === 'warn' ? '🟠' : '🔵'}</span>
                            <div className="min-w-0">
                              <div className="text-[13px] font-bold leading-snug">{n.title}</div>
                              {n.body && <div className="text-[11.5px] text-ink-3 leading-snug">{n.body}</div>}
                              <div className="text-[10px] text-ink-3 mt-0.5">{new Date(n.at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                            </div>
                            {!n.readAt && <span className="ml-auto w-2 h-2 rounded-full mt-1" style={{ background: 'var(--clay)' }} />}
                          </button>
                        ))}
                      </div>
                    )}
                    {/* message staff — everyone, a team (role), or one person */}
                    <div className="px-4 py-3 border-t sticky bottom-0" style={{ borderColor: 'var(--line)', background: 'var(--paper-2)' }}>
                      <label className="text-[11px] font-bold text-ink-3 uppercase tracking-wide">Message staff</label>
                      {/* who it goes to */}
                      <div className="flex items-center gap-1 mt-1.5">
                        {([
                          { key: 'floor', label: 'Everyone', Icon: Megaphone },
                          { key: 'role', label: 'Team', Icon: Users },
                          { key: 'user', label: 'Person', Icon: User },
                        ] as const).map(({ key, label, Icon }) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => { setBroadcastTo(key); if (key === 'user' && staffMembers.length === 0) loadStaff(); }}
                            aria-pressed={broadcastTo === key}
                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11.5px] font-bold border transition"
                            style={broadcastTo === key
                              ? { background: 'var(--ink)', color: 'var(--paper-2)', borderColor: 'var(--ink)' }
                              : { background: 'var(--paper)', color: 'var(--ink-2)', borderColor: 'var(--line)' }}
                          >
                            <Icon size={13} aria-hidden /> {label}
                          </button>
                        ))}
                      </div>
                      {/* pick the specific team or person */}
                      {broadcastTo === 'role' && (
                        <select
                          value={broadcastRole}
                          onChange={(e) => setBroadcastRole(e.target.value as typeof broadcastRole)}
                          className="w-full mt-2 px-3 py-2 rounded-lg border text-[13px] outline-none"
                          style={{ background: 'var(--paper)', borderColor: 'var(--line)' }}
                        >
                          {BROADCAST_TEAMS.map((t) => <option key={t.role} value={t.role}>{t.label}</option>)}
                        </select>
                      )}
                      {broadcastTo === 'user' && (
                        <select
                          value={broadcastStaffId}
                          onChange={(e) => setBroadcastStaffId(e.target.value)}
                          className="w-full mt-2 px-3 py-2 rounded-lg border text-[13px] outline-none"
                          style={{ background: 'var(--paper)', borderColor: 'var(--line)' }}
                        >
                          <option value="">{staffLoading ? 'Loading…' : 'Choose a person…'}</option>
                          {staffMembers.filter((m) => m.active).map((m) => (
                            <option key={m.id} value={m.id}>{m.name} · {ROLE_LABELS[m.role as keyof typeof ROLE_LABELS] ?? m.role}</option>
                          ))}
                        </select>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          value={broadcastMsg}
                          onChange={(e) => setBroadcastMsg(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') sendBroadcast(); }}
                          maxLength={280}
                          placeholder={broadcastTo === 'user' ? 'e.g. Please see me at the till' : broadcastTo === 'role' ? 'e.g. Prep for the 7pm rush' : 'e.g. Table 4 needs water'}
                          className="flex-1 min-w-0 px-3 py-2 rounded-lg border text-[13px] outline-none"
                          style={{ background: 'var(--paper)', borderColor: 'var(--line)' }}
                        />
                        <button onClick={sendBroadcast} disabled={!broadcastMsg.trim() || broadcasting || (broadcastTo === 'user' && !broadcastStaffId)} className="shrink-0 px-3 py-2 rounded-lg text-[12.5px] font-bold disabled:opacity-50" style={{ background: 'var(--ink)', color: 'var(--paper-2)' }}>
                          {broadcasting ? '…' : 'Send'}
                        </button>
                      </div>
                      {broadcastOk && <div className="text-[11px] font-bold mt-1.5" style={{ color: 'var(--ok, #2E7D32)' }}>Sent to {broadcastTargetLabel()} ✓</div>}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="hidden md:inline-flex">
              <ShiftStatus />
            </div>
          </div>
        </header>

        {/* ── Kitchen redirect — navigates to /kds ── */}
        {activeMenu === 'kitchen' && (
          <div className="flex flex-col items-center justify-center gap-6 py-16">
            <span className="text-6xl">🍳</span>
            <div className="text-center">
              <h2 className="font-display text-2xl font-bold mb-2">Kitchen Display</h2>
              <p className="text-sm" style={{ color: 'var(--ink-3)' }}>The KDS opens in a dedicated full-screen view.</p>
            </div>
            <button onClick={() => setShowKds(true)} className="btn btn-primary px-8 py-3 text-base cursor-pointer">
              Open Kitchen Display (KDS)
            </button>
            <p className="text-xs" style={{ color: 'var(--ink-3)' }}>Tip: Bookmark /kds on your kitchen screen for instant access.</p>
          </div>
        )}

        {/* ── Finance section ── */}
        {activeMenu === 'finance' && (
          <FinanceManagement outlet={outlet} staff={staff} kpi={kpi} formatINR={formatINR} />
        )}

        {/* ── Live Monitor (legacy — now embedded on Home) ── */}
        {activeMenu === 'monitor' && (
          <div className="flex flex-col gap-4">
            {monitorLoading && !monitor ? (
              <TeaLoader label="Loading live metrics…" size={44} />
            ) : (
              <>
                {/* live metric tiles */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <KpiCard label="Today's sales" value={formatINR(monitor?.today?.salesPaise ?? 0)} tone="cardamom" />
                  <section className="card p-4">
                    <span className="block text-xs mb-2 text-ink-3">Orders in progress</span>
                    <span className="block text-2xl md:text-3xl font-bold tnum font-mono">{(monitor?.ordersInProgress?.pendingApproval ?? 0) + (monitor?.ordersInProgress?.inKitchen ?? 0) + (monitor?.ordersInProgress?.ready ?? 0)}</span>
                    <span className="text-[11px] text-ink-3">{monitor?.ordersInProgress?.pendingApproval ?? 0} approval · {monitor?.ordersInProgress?.inKitchen ?? 0} kitchen · {monitor?.ordersInProgress?.ready ?? 0} ready</span>
                  </section>
                  <KpiCard label="Cash today" value={formatINR(monitor?.today?.cashPaise ?? 0)} />
                  <KpiCard label="UPI today" value={formatINR(monitor?.today?.upiPaise ?? 0)} />
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <section className="card p-4">
                    <span className="block text-xs mb-2 text-ink-3">Active tables</span>
                    <span className="block text-2xl font-bold tnum font-mono">{monitor?.tables?.occupied ?? 0}<span className="text-sm text-ink-3"> / {monitor?.tables?.total ?? 0}</span></span>
                    {(monitor?.tables?.lowRevenue ?? 0) > 0 && <span className="text-[11px] font-bold" style={{ color: 'var(--clay)' }}>{monitor.tables.lowRevenue} low-revenue</span>}
                  </section>
                  <section className="card p-4">
                    <span className="block text-xs mb-2 text-ink-3">Inventory status</span>
                    <span className="block text-2xl font-bold tnum font-mono" style={{ color: (monitor?.inventory?.critical ?? 0) > 0 ? 'var(--clay)' : undefined }}>{(monitor?.inventory?.low ?? 0) + (monitor?.inventory?.critical ?? 0)}</span>
                    <span className="text-[11px] text-ink-3">{monitor?.inventory?.critical ?? 0} critical · {monitor?.inventory?.low ?? 0} low</span>
                  </section>
                  <section className="card p-4">
                    <span className="block text-xs mb-2 text-ink-3">Staff on duty</span>
                    <span className="block text-2xl font-bold tnum font-mono">{monitor?.staffOnDuty ?? 0}</span>
                  </section>
                  <KpiCard label="Supplier dues" value={formatINR(monitor?.supplierOutstandingPaise ?? 0)} tone="gold" />
                </div>

                {/* sales-vs-usual + channels */}
                <div className="grid lg:grid-cols-2 gap-4">
                  <section className="card p-5">
                    <h4 className="font-bold mb-2">Sales vs usual</h4>
                    <div className="flex items-end gap-3">
                      <span className="text-3xl font-bold font-mono">{formatINR(monitor?.salesTrend?.todayPaise ?? 0)}</span>
                      <span className="text-sm font-bold mb-1" style={{ color: (monitor?.salesTrend?.deltaPct ?? 0) < 0 ? 'var(--clay)' : 'var(--cardamom-d)' }}>
                        {(monitor?.salesTrend?.deltaPct ?? 0) >= 0 ? '▲' : '▼'} {Math.abs(monitor?.salesTrend?.deltaPct ?? 0)}%
                      </span>
                    </div>
                    <span className="text-xs text-ink-3">vs ~{formatINR(monitor?.salesTrend?.avg7Paise ?? 0)} typical (7-day avg)</span>
                  </section>
                  <section className="card p-5">
                    <h4 className="font-bold mb-2">Notification channels</h4>
                    <div className="flex flex-wrap gap-2">
                      {[['In-app', monitor?.channels?.inApp], ['Push', monitor?.channels?.push], ['WhatsApp', monitor?.channels?.whatsapp], ['Email', monitor?.channels?.email]].map(([label, on]) => (
                        <span key={label as string} className="pill text-xs" style={{ color: on ? 'var(--cardamom-d)' : 'var(--ink-3)' }}>
                          {on ? '● ' : '○ '}{label}{on ? '' : ' (ready)'}
                        </span>
                      ))}
                    </div>
                    <p className="text-[11px] text-ink-3 mt-2">WhatsApp & email fire automatically once their API keys are set in the environment.</p>
                  </section>
                </div>

                {/* live alert feed */}
                <section className="card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold">Live Alerts {unread > 0 && <span className="text-xs font-bold" style={{ color: 'var(--clay)' }}>· {unread} unread</span>}</h4>
                    {unread > 0 && <button onClick={markAllRead} className="text-xs font-bold" style={{ color: 'var(--turmeric-d)' }}>Mark all read</button>}
                  </div>
                  {!monitor?.alerts?.length ? (
                    <p className="text-sm text-ink-3">No open alerts. Stock, occupancy, discounts and cancellations will surface here in real time.</p>
                  ) : (
                    <div className="grid gap-2">
                      {monitor.alerts.map((a: any) => (
                        <div key={a.id} className="flex items-start gap-3 text-sm p-3 rounded-xl" style={{ background: 'var(--paper-3)' }}>
                          <span className="mt-0.5">{a.severity === 'critical' ? '🔴' : a.severity === 'warn' ? '🟠' : '🔵'}</span>
                          <div className="flex-1">
                            <div className="font-bold">{a.title}</div>
                            {a.body && <div className="text-xs text-ink-3">{a.body}</div>}
                          </div>
                          <span className="text-[10px] text-ink-3">{new Date(a.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        )}

        {/* ── 1. Dashboard View ── */}
        {activeMenu === 'home' && (
          <div className="flex flex-col gap-4">
            {/* Home Sub Tabs */}
            <div className="flex justify-start md:justify-center pb-1 overflow-x-auto no-scrollbar w-full">
              <div className="flex flex-nowrap gap-1 p-1 rounded-full border shadow-sm w-fit" style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }} role="tablist" aria-label="Home sections">
                {[
                  { key: 'overview', label: '📊 Overview' },
                  { key: 'floor', label: '🍽️ Live Floor' }
                ].map((tab) => (
                  <button
                    key={tab.key}
                    role="tab"
                    aria-selected={activeSubTab === tab.key}
                    onClick={() => setActiveSubTab(tab.key)}
                    className="px-5 py-2 rounded-full text-xs font-bold transition whitespace-nowrap cursor-pointer"
                    style={activeSubTab === tab.key
                      ? { background: 'var(--turmeric)', color: '#2A1607', boxShadow: 'var(--sh-1)' }
                      : { color: 'var(--ink-2)', background: 'transparent' }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Overview Tab */}
            {activeSubTab === 'overview' && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* AI Briefing */}
                <motion.section className="card col-span-2 p-5 flex flex-col justify-between" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: [0.25, 0.8, 0.25, 1], delay: 0.05 }}>
                  <div>
                    <span className="font-bold text-xs" style={{ color: 'var(--berry)' }}>✦ AI Morning Briefing</span>
                    <div className="grid gap-2.5 mt-3">
                      {briefing.length === 0 ? (
                        <p className="text-sm text-ink-3">Briefing updates instantly as sales come in.</p>
                      ) : (
                        briefing.map((b, i) => (
                          <div key={i} className="flex gap-2 text-sm leading-snug">
                            <span style={{ color: b.tone === 'up' ? 'var(--cardamom)' : 'var(--clay)' }}>●</span>
                            <p>{b.text}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </motion.section>

                {/* Constraints display: Sales, Orders, Profit, Low Stock, Top Sellers */}
                <KpiCard label="Today's Sales" n={totalSales} format={formatINR} index={0} />
                <KpiCard label="Orders" n={kpi.todayOrders} index={1} />
                <KpiCard label="Profit (est. 70%)" n={estimatedProfit} format={formatINR} tone="cardamom" index={2} />
                <KpiCard label="Low Stock Items" n={lowStock.length} tone={lowStock.length > 0 ? 'gold' : undefined} index={3} />

                {/* Revenue overview — total revenue + date-wise sales chart/report */}
                {features.revenue_analytics !== false && (
                  <div className="col-span-2 lg:col-span-4">
                    <RevenuePanel initialTrend={trend} restrictToToday={staff.role === 'cashier'} />
                  </div>
                )}

                {/* Low Stock Alerts list */}
                <motion.section className="card col-span-2 p-5" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: [0.25, 0.8, 0.25, 1], delay: 0.1 }}>
                  <h4 className="text-base font-bold mb-3">⚠ Low Stock Alerts</h4>
                  {lowStock.length === 0 ? (
                    <p className="text-sm text-ink-3">All ingredients look healthy!</p>
                  ) : (
                    <div className="grid gap-2">
                      {lowStock.map((s) => (
                        <div key={s.id} className="flex justify-between items-center text-sm py-1 border-b" style={{ borderColor: 'var(--line-2)' }}>
                          <span>{s.name}</span>
                          <span className="pill py-0.5">{s.qty} ({s.level})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.section>

                {/* Top Selling Items */}
                <motion.section className="card col-span-2 p-5" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: [0.25, 0.8, 0.25, 1], delay: 0.15 }}>
                  <h4 className="text-base font-bold mb-3">⭐ Top Selling Items</h4>
                  {topItems.length === 0 ? (
                    <p className="text-sm text-ink-3">Not enough orders to rank bestsellers.</p>
                  ) : (
                    <div className="grid gap-2">
                      {topItems.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-sm py-1 border-b" style={{ borderColor: 'var(--line-2)' }}>
                          <span><b>{idx + 1}.</b> {item.name}</span>
                          <span className="font-mono text-ink-2">{item.qty} sold</span>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.section>

                {/* AI Assistant grounded box */}
                {features.ai_assistant !== false && <Assistant />}
              </div>
            )}

            {/* Live Floor Tab */}
            {activeSubTab === 'floor' && (() => {
              const occMap = new Map<string, any>((tablesData?.occupancy ?? []).map((o: any) => [o.id, o]));
              const STATUS = {
                free: { label: 'Free', color: '#34C759' },
                occupied: { label: 'Occupied', color: '#3B82F6' },
                long: { label: 'Long stay', color: '#E8A22B' },
                low: { label: 'Low revenue', color: '#C3492F' },
              };
              const minutes = tablesData?.config?.minutes ?? 90;
              const statusOf = (id: string): keyof typeof STATUS => {
                const o = occMap.get(id);
                if (!o) return 'free';
                if (o.lowRevenue) return 'low';
                if (o.durationMin >= minutes) return 'long';
                return 'occupied';
              };
              const roster = tablesData?.roster ?? [];
              const floorList = tablesData?.floors ?? [];
              const floorIds = new Set(floorList.map((f: any) => f.id));
              const groups = [
                ...floorList.map((f: any) => ({ key: f.id, name: f.name, tables: roster.filter((t: any) => t.floorId === f.id) })),
                { key: 'unassigned', name: 'Unassigned', tables: roster.filter((t: any) => !t.floorId || !floorIds.has(t.floorId)) },
              ].filter((g) => g.tables.length > 0);

              const renderTile = (t: any) => {
                const st = statusOf(t.id);
                const s = STATUS[st];
                const o = occMap.get(t.id);
                return (
                  <div
                    key={t.id}
                    onClick={o ? () => openTableOrders(t) : undefined}
                    role={o ? 'button' : undefined}
                    tabIndex={o ? 0 : undefined}
                    onKeyDown={o ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openTableOrders(t); } } : undefined}
                    title={o ? 'View orders on this table' : undefined}
                    className={`rounded-xl border p-3 flex flex-col gap-1${o ? ' cursor-pointer transition hover:-translate-y-0.5' : ''}`}
                    style={{ background: `color-mix(in srgb, ${s.color} 8%, var(--paper-3))`, borderColor: s.color, borderTopWidth: 3, borderTopColor: s.color }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display font-bold text-lg">{t.label}</span>
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                    </div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wide" style={{ color: s.color }}>{s.label}</span>
                    {o ? (
                      <div className="text-[11px] mt-0.5" style={{ color: 'var(--ink-3)' }}>
                        <div className="flex justify-between"><span>{o.durationMin} min</span><span className="font-mono">{formatINR(o.billPaise)}</span></div>
                        <span className="flex justify-between"><span>{o.orders} order{o.orders > 1 ? 's' : ''}</span><span style={{ color: s.color }}>view ▸</span></span>
                      </div>
                    ) : (
                      <span className="text-[11px] mt-0.5" style={{ color: 'var(--ink-3)' }}>{'•'.repeat(t.seats)} · open</span>
                    )}
                  </div>
                );
              };

              return (
                <section className="card p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <h4 className="font-bold">Live Floor</h4>
                    <div className="flex flex-wrap gap-3">
                      {Object.entries(STATUS).map(([k, s]) => (
                        <span key={k} className="inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: 'var(--ink-2)' }}>
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />{s.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  {tablesLoading && !tablesData ? (
                    <TeaLoader label="Loading tables…" size={44} />
                  ) : roster.length === 0 ? (
                    <p className="text-sm text-ink-3">No tables configured yet.</p>
                  ) : (
                    <div className="flex flex-col gap-5">
                      {groups.map((g) => (
                        <div key={g.key}>
                          <h5 className="font-bold text-xs uppercase tracking-wider mb-2.5" style={{ color: 'var(--ink-3)' }}>{g.name} · {g.tables.length} table{g.tables.length === 1 ? '' : 's'}</h5>
                          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                            {g.tables.map(renderTile)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })()}
          </div>
        )}

        {/* ── 2. Orders View ── */}
        {activeMenu === 'orders' && (
          <div className="flex flex-col gap-4">
            {/* Quick launcher cards */}
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setShowPos(true)} className="card p-6 flex flex-col justify-between hover:-translate-y-0.5 transition text-left cursor-pointer">
                <span className="text-3xl">⊞</span>
                <div className="mt-3">
                  <h3 className="text-lg font-bold">Take Order (POS)</h3>
                  <p className="text-xs text-ink-3">Open interactive cashier till</p>
                </div>
              </button>
              <button onClick={() => setShowKds(true)} className="card p-6 flex flex-col justify-between hover:-translate-y-0.5 transition text-left cursor-pointer">
                <span className="text-3xl">⊟</span>
                <div className="mt-3">
                  <h3 className="text-lg font-bold">Kitchen Display (KDS)</h3>
                  <p className="text-xs text-ink-3">Track live cooking queues</p>
                </div>
              </button>
            </div>

            <section className="card p-5">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-bold">Live Order Queue</h4>
                <button onClick={loadOrders} className="btn py-1 px-3 text-xs">↻ Refresh</button>
              </div>
              {ordersLoading ? (
                <p className="text-sm">Loading orders...</p>
              ) : ordersList.filter((o) => o.status !== 'settled' && o.status !== 'cancelled').length === 0 ? (
                <p className="text-sm text-ink-3">No active orders right now.</p>
              ) : (
                <div className="grid gap-3">
                  {ordersList
                    .filter((o) => o.status !== 'settled' && o.status !== 'cancelled')
                    .map((o) => (
                      <div key={o.id} className="card p-4 flex flex-wrap justify-between items-center gap-3" style={{ background: 'var(--paper-3)' }}>
                        <button onClick={() => setOrderDetail(o)} className="text-left flex-1 min-w-0">
                          <span className="font-bold text-base">#{o.number} ({o.type === 'takeaway' ? 'Takeaway' : `Table ${o.table?.label ?? '—'}`}) <span className="text-xs font-normal" style={{ color: 'var(--turmeric-d)' }}>· details ▸</span></span>
                          <div className="text-xs text-ink-3 mt-1 truncate">
                            {o.items.map((i: any) => `${i.qty}× ${i.nameSnapshot}`).join(', ')}
                          </div>
                        </button>
                        <div className="flex items-center gap-2">
                          <span className="pill text-[10px] uppercase">{o.status}</span>
                          {o.status === 'in_kitchen' && (
                            <button onClick={() => handleBumpOrder(o.id, 'ready')} className="btn py-1.5 px-3 text-xs btn-primary">Mark Ready</button>
                          )}
                          {o.status === 'ready' && (
                            <button onClick={() => handleBumpOrder(o.id, 'served')} className="btn py-1.5 px-3 text-xs btn-primary">Mark Served</button>
                          )}
                          {o.status === 'served' && (
                            <div className="flex gap-1">
                              <button onClick={() => handleSettleOrder(o.id, 'cash')} className="btn py-1.5 px-3 text-xs btn-dark">Settle Cash</button>
                              <button onClick={() => handleSettleOrder(o.id, 'upi')} className="btn py-1.5 px-3 text-xs btn-primary">Settle UPI</button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* reprint is now the History/Reprint tab inside Orders — kept here as fallback */}
        {activeMenu === 'reprint' && (
          <div className="flex flex-col gap-4">
            <section className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <h4 className="font-bold">Print Bills</h4>
                  <button onClick={openQuickInvoice} className="px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1" style={{ background: 'var(--turmeric)', color: '#2A1607' }}>
                    ＋ Create Custom Bill
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="p-2.5 rounded-xl border text-sm outline-none"
                    style={{ background: 'var(--paper-3)', borderColor: 'var(--line-2)' }}
                  >
                    <option value="all">All Statuses</option>
                    <option value="paid">Paid (Settled)</option>
                    <option value="unpaid">Unpaid (Active)</option>
                  </select>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--ink-3)' }}>🔍</span>
                    <input
                      value={billSearch}
                      onChange={(e) => setBillSearch(e.target.value)}
                      placeholder="Search name, phone, table, bill #..."
                      className="pl-8 pr-3 py-2 rounded-xl border text-sm outline-none w-64"
                      style={{ background: 'var(--paper-3)', borderColor: 'var(--line-2)' }}
                    />
                  </div>
                </div>
              </div>
              {ordersList.filter((o) => {
                if (statusFilter === 'paid') return o.status === 'settled';
                if (statusFilter === 'unpaid') return o.status !== 'settled' && o.status !== 'cancelled';
                return o.status !== 'cancelled';
              }).length === 0 ? (
                <p className="text-sm text-ink-3">No matching invoices recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="rtable w-full text-sm border-collapse text-left">
                    <thead>
                      <tr className="border-b" style={{ borderColor: 'var(--line)' }}>
                        <th className="pb-2">Bill No.</th>
                        <th className="pb-2">Customer</th>
                        <th className="pb-2">Table</th>
                        <th className="pb-2">Amount</th>
                        <th className="pb-2">Settled At / Placed At</th>
                        <th className="pb-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ordersList
                        .filter((o) => {
                          if (statusFilter === 'paid') return o.status === 'settled';
                          if (statusFilter === 'unpaid') return o.status !== 'settled' && o.status !== 'cancelled';
                          return o.status !== 'cancelled';
                        })
                        .filter((o) => {
                          if (!billSearch.trim()) return true;
                          const q = billSearch.toLowerCase();
                          const numStr = String(o.number);
                          const nameStr = o.customer?.name?.toLowerCase() || '';
                          const phoneStr = o.customer?.phone?.toLowerCase() || '';
                          const tableStr = o.table?.label?.toLowerCase() || 'takeaway';
                          return numStr.includes(q) || nameStr.includes(q) || phoneStr.includes(q) || tableStr.includes(q);
                        })
                        .slice(0, 30)
                        .map((o) => (
                          <tr key={o.id} onClick={() => setOrderDetail(o)} className="border-b cursor-pointer hover:bg-[var(--paper-3)]" style={{ borderColor: 'var(--line-2)' }}>
                            <td className="py-2.5 font-bold" data-label="Bill No.">#{o.number}</td>
                            <td className="py-2.5" data-label="Customer">
                              {o.customer ? (
                                <div>
                                  <span className="block text-sm font-semibold">{o.customer.name || 'Walk-in'}</span>
                                  <span className="block text-[10px] text-ink-3 font-mono">{o.customer.phone}</span>
                                </div>
                              ) : (
                                <span className="text-ink-3">—</span>
                              )}
                            </td>
                            <td className="py-2.5" data-label="Table">{o.table?.label ?? 'Takeaway'}</td>
                            <td className="py-2.5 font-mono" data-label="Amount">{formatINR(o.totalPaise)}</td>
                            <td className="py-2.5 text-xs" data-label="Date">{new Date(o.settledAt || o.placedAt).toLocaleString()}</td>
                            <td className="py-2.5" data-label="Status">
                              {o.status === 'settled' ? (
                                <span className="pill text-[9px] bg-green-100 text-green-800">PAID</span>
                              ) : (
                                <span className="pill text-[9px] bg-amber-100 text-amber-800">{o.status.toUpperCase()}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ── Staff View ── */}
        {activeMenu === 'staff' && (
          <div className="flex flex-col gap-4">
            <SectionView section="staff" />
            <StaffDevices />
          </div>
        )}

        {/* ── Customer Management (CRM) ── */}
        {activeMenu === 'customers' && features.crm !== false && (
          <CustomerManagement role={staff.role} flash={flashMessage} />
        )}

        {/* ── 3. Inventory View ── */}
        {activeMenu === 'inventory' && (
          <div className="flex flex-col gap-4">
            {/* Tabs */}
            <div className="flex justify-start md:justify-center pb-2 overflow-x-auto no-scrollbar w-full">
              <div className="flex flex-nowrap gap-1 p-1 rounded-full border w-fit" style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }} role="tablist">
                {[
                  { key: 'stock', label: 'Basic Stock' },
                  { key: 'consumption', label: `Consumption` },
                  { key: 'purchase', label: 'Purchase Entry' },
                  { key: 'adjust', label: 'Adjustment' },
                  { key: 'recipes', label: 'Recipes 🧪' },
                  ...(isAdvanced ? [
                    { key: 'vendors', label: 'Vendors' },
                    { key: 'autopo', label: 'Auto POs' }
                  ] : [])
                ].map((tab) => (
                  <button
                    key={tab.key}
                    role="tab"
                    aria-selected={activeSubTab === tab.key}
                    onClick={() => {
                      if (tab.key === 'vendors') {
                        setActiveMenu('suppliers');
                        setActiveSubTab('ledger');
                      } else {
                        setActiveSubTab(tab.key);
                      }
                    }}
                    className="px-5 py-2 rounded-full text-xs font-bold transition whitespace-nowrap cursor-pointer"
                    style={activeSubTab === tab.key
                      ? { background: 'var(--turmeric)', color: '#2A1607', boxShadow: 'var(--sh-1)' }
                      : { color: 'var(--ink-2)', background: 'transparent' }}
                  >
                    {tab.label === 'Consumption' && consumption.length > 0 ? (
                      <span className="flex items-center gap-1">
                        Consumption <span className="w-1.5 h-1.5 rounded-full bg-turmeric-d" />
                      </span>
                    ) : tab.label}
                  </button>
                ))}
              </div>
            </div>

            {activeSubTab === 'stock' && (
              <section className="card p-5">
                {/* low-stock alerts raised automatically as recipes consume stock */}
                {stockAlerts.length > 0 && (
                  <div className="mb-4 grid gap-2">
                    {stockAlerts.map((a) => (
                      <div key={a.id} className="flex items-center gap-3 text-sm p-3 rounded-xl border"
                        style={{ background: a.severity === 'critical' ? 'rgba(195,73,47,.12)' : 'rgba(217,138,43,.12)', borderColor: a.severity === 'critical' ? 'var(--clay)' : 'var(--turmeric)' }}>
                        <span>{a.severity === 'critical' ? '🔴' : '🟠'}</span>
                        <div className="flex-1">
                          <div className="font-bold">{a.title}</div>
                          {a.body && <div className="text-xs text-ink-3">{a.body}</div>}
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                          style={{ color: a.severity === 'critical' ? 'var(--clay)' : 'var(--turmeric-d)' }}>{a.type.replace('_', ' ')}</span>
                      </div>
                    ))}
                  </div>
                )}
                <h4 className="font-bold mb-3">Current Stock Levels</h4>
                {inventoryLoading ? (
                  <TeaLoader label="Loading stock…" size={44} />
                ) : stockItems.length === 0 ? (
                  <p className="text-sm text-ink-3">No stock items tracked yet.</p>
                ) : (
                  <div className="grid gap-2">
                    {stockItems.map((item) => (
                      <div key={item.id} className="flex justify-between items-center text-sm p-3 rounded-xl" style={{ background: 'var(--paper-3)' }}>
                        <div className="flex items-center gap-2">
                          {item.status !== 'ok' && <span className="w-2 h-2 rounded-full" style={{ background: item.status === 'critical' ? 'var(--clay)' : 'var(--turmeric)' }} />}
                          <span className="font-bold">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-ink-2">{item.onHand} {item.unit}</span>
                          <span className="text-xs text-ink-3">Cost: {formatINR(item.valuePaise)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {activeSubTab === 'consumption' && (
              <section className="card p-5">
                <h4 className="font-bold mb-1">Stock Consumption History</h4>
                <p className="text-xs text-ink-3 mb-3">Raw materials auto-deducted from recipes as menu items are sold.</p>
                {inventoryLoading ? (
                  <TeaLoader label="Loading…" size={44} />
                ) : consumption.length === 0 ? (
                  <p className="text-sm text-ink-3">No consumption yet. Link recipes in the Recipes Wizard, then sell items on the POS — deductions appear here.</p>
                ) : (
                  <div className="grid gap-2">
                    {consumption.map((c) => (
                      <div key={c.id} className="flex justify-between items-center text-sm p-3 rounded-xl" style={{ background: 'var(--paper-3)' }}>
                        <span className="font-bold">{c.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-mono" style={{ color: 'var(--clay)' }}>− {c.qty} {c.unit}</span>
                          <span className="text-xs text-ink-3">{new Date(c.at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {activeSubTab === 'purchase' && (
              <section className="card p-5 max-w-md">
                <h4 className="font-bold mb-3">Record Purchase</h4>
                <form onSubmit={handleAddPurchase} className="grid gap-3">
                  <div>
                    <label className="lbl">Select Ingredient</label>
                    <select
                      value={purchItemId}
                      onChange={(e) => setPurchItemId(e.target.value)}
                      className="w-full p-2.5 rounded-xl border text-sm outline-none"
                      style={{ background: 'var(--paper-3)', borderColor: 'var(--line-2)' }}
                      required
                    >
                      <option value="">-- Choose Item --</option>
                      {stockItems.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="lbl">Purchase Quantity</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 5"
                      value={purchQty}
                      onChange={(e) => setPurchQty(e.target.value)}
                      className="w-full p-2.5 rounded-xl border text-sm outline-none"
                      style={{ background: 'var(--paper-3)', borderColor: 'var(--line-2)' }}
                      required
                    />
                  </div>
                  <div>
                    <label className="lbl">Unit Cost (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 150"
                      value={purchPrice}
                      onChange={(e) => setPurchPrice(e.target.value)}
                      className="w-full p-2.5 rounded-xl border text-sm outline-none"
                      style={{ background: 'var(--paper-3)', borderColor: 'var(--line-2)' }}
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-primary mt-2">Submit Purchase</button>
                </form>
              </section>
            )}

            {activeSubTab === 'adjust' && (
              <section className="card p-5 max-w-md">
                <h4 className="font-bold mb-3">Adjust Stock Count</h4>
                <form onSubmit={handleAdjustStock} className="grid gap-3">
                  <div>
                    <label className="lbl">Select Ingredient</label>
                    <select
                      value={adjustItemId}
                      onChange={(e) => setAdjustItemId(e.target.value)}
                      className="w-full p-2.5 rounded-xl border text-sm outline-none"
                      style={{ background: 'var(--paper-3)', borderColor: 'var(--line-2)' }}
                      required
                    >
                      <option value="">-- Choose Item --</option>
                      {stockItems.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="lbl">Actual Qty On Hand</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 4.2"
                      value={adjustQty}
                      onChange={(e) => setAdjustQty(e.target.value)}
                      className="w-full p-2.5 rounded-xl border text-sm outline-none"
                      style={{ background: 'var(--paper-3)', borderColor: 'var(--line-2)' }}
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-primary mt-2">Save Stock Level</button>
                </form>
              </section>
            )}

            {activeSubTab === 'recipes' && (
              <div className="flex flex-col gap-4">
                <section className="card p-5">
                  <h4 className="font-bold mb-1">Add Ingredient to a Recipe</h4>
                  <p className="text-xs text-ink-3 mb-3">Link raw materials to a menu item. Each sale auto-deducts these quantities from stock.</p>
                  <form onSubmit={handleLinkRecipe} className="grid gap-3 max-w-md">
                    <div>
                      <label className="lbl">Menu Item (POS)</label>
                      <select value={recipeMenuItemId} onChange={(e) => setRecipeMenuItemId(e.target.value)} className="inp" required>
                        <option value="">-- Choose Menu Item --</option>
                        {menuItems.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="lbl">Raw Material</label>
                      <select value={recipeStockItemId} onChange={(e) => setRecipeStockItemId(e.target.value)} className="inp" required>
                        <option value="">-- Choose Material --</option>
                        {stockItems.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="lbl">Quantity per item</label>
                        <input type="number" step="0.001" placeholder="e.g. 100" value={recipeQty} onChange={(e) => setRecipeQty(e.target.value)} className="inp" required />
                      </div>
                      <div>
                        <label className="lbl">Unit (optional)</label>
                        <input value={recipeUnit} onChange={(e) => setRecipeUnit(e.target.value)} placeholder="defaults to stock unit" className="inp" />
                      </div>
                    </div>
                    <button type="submit" className="btn btn-primary mt-1">Link Ingredient</button>
                  </form>
                </section>

                <section className="card p-5">
                  <h4 className="font-bold mb-3">Existing Recipes</h4>
                  {inventoryLoading && recipes.length === 0 ? (
                    <TeaLoader label="Loading…" size={44} />
                  ) : recipes.length === 0 ? (
                    <p className="text-sm text-ink-3">No recipes yet. Link ingredients above — or run <span className="font-mono">activate:inventory</span> to seed them.</p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {recipes.map((r) => (
                        <div key={r.itemId} className="p-3 rounded-xl" style={{ background: 'var(--paper-3)' }}>
                          <b className="block text-sm mb-2">{r.itemName}</b>
                          <div className="grid gap-1">
                            {r.lines.map((l: any) => (
                              <div key={l.id} className="flex items-center justify-between text-sm">
                                <span>{l.material}</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-ink-2">{l.qty} {l.unit}</span>
                                  <button onClick={() => handleDeleteRecipe(l.id)} title="Remove" className="w-6 h-6 grid place-items-center rounded-lg text-xs" style={{ background: 'rgba(195,73,47,.12)', color: 'var(--clay)' }}>✕</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}

            {isAdvanced && activeSubTab === 'vendors' && (
              <section className="card p-5">
                <h4 className="font-bold mb-3">Vendor Management</h4>
                <div className="grid gap-2">
                  <div className="p-3 rounded-xl text-sm" style={{ background: 'var(--paper-3)' }}>
                    <b>Milk supplier</b> · Rating: 4.8 ★ · Contact: +91 9000100010
                  </div>
                  <div className="p-3 rounded-xl text-sm" style={{ background: 'var(--paper-3)' }}>
                    <b>Groceries vendor</b> · Rating: 4.5 ★ · Contact: +91 9000100020
                  </div>
                </div>
              </section>
            )}

            {isAdvanced && activeSubTab === 'autopo' && (
              <section className="card p-5">
                <h4 className="font-bold mb-3">Auto Purchase Orders</h4>
                <div className="p-4 rounded-xl" style={{ background: 'var(--paper-3)' }}>
                  <p className="text-sm">Auto replenishment is enabled. Draft purchase orders will automatically generate when items drop below reorder thresholds.</p>
                </div>
              </section>
            )}
          </div>
        )}

        {/* ── 3b. Suppliers & Credit View ── */}
        {activeMenu === 'suppliers' && (
          <div className="flex flex-col gap-4">
            <div className="flex justify-start md:justify-center pb-2 overflow-x-auto no-scrollbar w-full">
              <div className="flex flex-nowrap gap-1 p-1 rounded-full border w-fit" style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }} role="tablist">
                {[
                  { key: 'ledger', label: 'Ledger & Dues' },
                  { key: 'invoice', label: 'New Invoice' },
                  { key: 'payment', label: 'Record Payment' },
                  { key: 'addvendor', label: 'Add Supplier' }
                ].map((tab) => (
                  <button
                    key={tab.key}
                    role="tab"
                    aria-selected={activeSubTab === tab.key}
                    onClick={() => setActiveSubTab(tab.key)}
                    className="px-5 py-2 rounded-full text-xs font-bold transition whitespace-nowrap cursor-pointer"
                    style={activeSubTab === tab.key
                      ? { background: 'var(--turmeric)', color: '#2A1607', boxShadow: 'var(--sh-1)' }
                      : { color: 'var(--ink-2)', background: 'transparent' }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {activeSubTab === 'ledger' && (
              <div className="flex flex-col gap-4">
                {/* summary */}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  <KpiCard label="Total outstanding" value={formatINR(suppliers?.summary?.outstandingPaise ?? 0)} tone="gold" />
                  <KpiCard label="Paid (30 days)" value={formatINR(suppliers?.summary?.paid30Paise ?? 0)} tone="cardamom" />
                  <section className="card p-4">
                    <span className="block text-xs mb-2 text-ink-3">Overdue invoices</span>
                    <span className="block text-2xl md:text-3xl font-bold tnum font-mono" style={{ color: (suppliers?.summary?.overdueCount ?? 0) > 0 ? 'var(--clay)' : undefined }}>
                      {suppliers?.summary?.overdueCount ?? 0}
                    </span>
                    {(suppliers?.summary?.overduePaise ?? 0) > 0 && <span className="text-xs" style={{ color: 'var(--clay)' }}>{formatINR(suppliers.summary.overduePaise)} due</span>}
                  </section>
                </div>

                {/* vendor balances */}
                <section className="card p-5">
                  <h4 className="font-bold mb-3">Supplier Balances</h4>
                  {suppliersLoading ? (
                    <TeaLoader label="Loading…" size={44} />
                  ) : !suppliers?.vendors?.length ? (
                    <p className="text-sm text-ink-3">No suppliers yet. Add one under “Add Supplier”.</p>
                  ) : (
                    <div className="grid gap-2.5">
                      {suppliers.vendors.map((v: any) => (
                        <button
                          key={v.id}
                          onClick={() => openStatement(v.id)}
                          className="flex justify-between items-center text-sm p-4 rounded-2xl text-left transition duration-200 hover:-translate-y-0.5 cursor-pointer"
                          style={{ background: 'var(--paper-3)', border: '1px solid var(--line)', boxShadow: 'var(--sh-1)' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'var(--turmeric)';
                            e.currentTarget.style.boxShadow = 'var(--sh-2)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--line)';
                            e.currentTarget.style.boxShadow = 'var(--sh-1)';
                          }}
                        >
                          <div>
                            <span className="font-bold text-slate-800">{v.name}</span>
                            {v.phone && <span className="text-xs text-ink-3 ml-2">{v.phone}</span>}
                            <span className="block text-[11px] text-ink-3 mt-1">Invoiced {formatINR(v.invoicedPaise)} · Paid {formatINR(v.paidPaise)}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-mono font-bold text-sm" style={{ color: v.balancePaise > 0 ? 'var(--clay)' : 'var(--cardamom-d)' }}>{formatINR(v.balancePaise)}</span>
                            <span className="block text-[10px] text-ink-3 uppercase mt-0.5">{v.balancePaise > 0 ? 'payable' : 'settled'}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
 
                <div className="grid lg:grid-cols-2 gap-4">
                  {/* recent invoices */}
                  <section className="card p-5">
                    <h4 className="font-bold mb-3">Recent Invoices</h4>
                    {!suppliers?.invoices?.length ? (
                      <p className="text-sm text-ink-3">No invoices recorded yet.</p>
                    ) : (
                      <div className="grid gap-2">
                        {suppliers.invoices.map((inv: any) => (
                          <div key={inv.id} className="flex justify-between items-center text-sm p-3.5 rounded-xl border" style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }}>
                            <div>
                              <span className="font-bold text-slate-800">{inv.vendorName}</span>
                              <span className="block text-[11px] text-ink-3 mt-1">{inv.invoiceNo ? `#${inv.invoiceNo} · ` : ''}{new Date(inv.at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}{inv.dueDate ? ` · due ${new Date(inv.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}` : ''}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-mono font-bold">{formatINR(inv.totalPaise)}</span>
                              <span className="block text-[10px] font-bold uppercase mt-0.5" style={{ color: inv.overdue ? 'var(--clay)' : inv.payStatus === 'paid' ? 'var(--cardamom-d)' : 'var(--turmeric-d)' }}>
                                {inv.overdue ? 'overdue' : inv.payStatus}{inv.balancePaise > 0 ? ` · ${formatINR(inv.balancePaise)} left` : ''}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
 
                  {/* recent payments */}
                  <section className="card p-5">
                    <h4 className="font-bold mb-3">Recent Payments</h4>
                    {!suppliers?.payments?.length ? (
                      <p className="text-sm text-ink-3">No payments recorded yet.</p>
                    ) : (
                      <div className="grid gap-2">
                        {suppliers.payments.map((p: any) => (
                          <div key={p.id} className="flex justify-between items-center text-sm p-3.5 rounded-xl border" style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }}>
                            <div>
                              <span className="font-bold text-slate-800">{p.vendorName}</span>
                              <span className="block text-[11px] text-ink-3 mt-1 capitalize">{p.method}{p.reference ? ` · ${p.reference}` : ''} · {new Date(p.at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                            </div>
                            <span className="font-mono font-bold text-sm" style={{ color: 'var(--cardamom-d)' }}>− {formatINR(p.amountPaise)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              </div>
            )}

            {activeSubTab === 'invoice' && (
              <section className="card p-5 max-w-md">
                <h4 className="font-bold mb-3">Record Purchase Invoice</h4>
                <form onSubmit={handleAddInvoice} className="grid gap-3">
                  <div>
                    <label className="lbl">Supplier</label>
                    <select value={invVendorId} onChange={(e) => setInvVendorId(e.target.value)} required className="inp">
                      <option value="">-- Choose Supplier --</option>
                      {(suppliers?.vendors ?? []).map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="lbl">Invoice No.</label>
                      <input value={invNo} onChange={(e) => setInvNo(e.target.value)} placeholder="INV-001" className="inp" />
                    </div>
                    <div>
                      <label className="lbl">Total (₹)</label>
                      <input type="number" step="0.01" value={invTotal} onChange={(e) => setInvTotal(e.target.value)} placeholder="1000" required className="inp" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="lbl">Invoice date</label>
                      <input type="date" value={invDate} onChange={(e) => setInvDate(e.target.value)} className="inp" />
                    </div>
                    <div>
                      <label className="lbl">Due date</label>
                      <input type="date" value={invDue} onChange={(e) => setInvDue(e.target.value)} className="inp" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="lbl">Paid now (₹)</label>
                      <input type="number" step="0.01" value={invPaidNow} onChange={(e) => setInvPaidNow(e.target.value)} placeholder="0" className="inp" />
                    </div>
                    <div>
                      <label className="lbl">Pay method</label>
                      <select value={invMethod} onChange={(e) => setInvMethod(e.target.value)} className="inp">
                        {['cash', 'upi', 'bank', 'card', 'cheque'].map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>
                  <p className="text-[11px] text-ink-3">Leave “Paid now” at 0 to record a full-credit purchase. The unpaid balance shows up under Ledger & Dues.</p>
                  <button type="submit" className="btn btn-primary mt-1">Save Invoice</button>
                </form>
              </section>
            )}

            {activeSubTab === 'payment' && (
              <section className="card p-5 max-w-md">
                <h4 className="font-bold mb-3">Record Payment to Supplier</h4>
                <form onSubmit={handleAddPayment} className="grid gap-3">
                  <div>
                    <label className="lbl">Supplier</label>
                    <select value={payVendorId} onChange={(e) => setPayVendorId(e.target.value)} required className="inp">
                      <option value="">-- Choose Supplier --</option>
                      {(suppliers?.vendors ?? []).map((v: any) => <option key={v.id} value={v.id}>{v.name} · {formatINR(v.balancePaise)} due</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="lbl">Amount (₹)</label>
                      <input type="number" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="500" required className="inp" />
                    </div>
                    <div>
                      <label className="lbl">Method</label>
                      <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="inp">
                        {['cash', 'upi', 'bank', 'card', 'cheque'].map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="lbl">Reference (txn / cheque no.)</label>
                    <input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="optional" className="inp" />
                  </div>
                  <button type="submit" className="btn btn-primary mt-1">Save Payment</button>
                </form>
              </section>
            )}

            {activeSubTab === 'addvendor' && (
              <section className="card p-5 max-w-md">
                <h4 className="font-bold mb-3">Add Supplier</h4>
                <form onSubmit={handleAddVendor} className="grid gap-3">
                  <div>
                    <label className="lbl">Supplier name</label>
                    <input value={vName} onChange={(e) => setVName(e.target.value)} placeholder="e.g. Friends Vegetables" required className="inp" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="lbl">Phone</label>
                      <input value={vPhone} onChange={(e) => setVPhone(e.target.value)} placeholder="+91…" className="inp" />
                    </div>
                    <div>
                      <label className="lbl">GSTIN</label>
                      <input value={vGstin} onChange={(e) => setVGstin(e.target.value)} placeholder="optional" className="inp" />
                    </div>
                  </div>
                  <div>
                    <label className="lbl">Opening balance owed (₹)</label>
                    <input type="number" step="0.01" value={vOpening} onChange={(e) => setVOpening(e.target.value)} placeholder="0" className="inp" />
                    <p className="text-[11px] text-ink-3 mt-1">Existing dues carried over when onboarding this supplier.</p>
                  </div>
                  <button type="submit" className="btn btn-primary mt-1">Add Supplier</button>
                </form>
              </section>
            )}
          </div>
        )}

        {/* ── 3c. Tables: occupancy & revenue ── */}
        {activeMenu === 'tables' && (
          <div className="flex flex-col gap-4">
            <div className="flex justify-start md:justify-center pb-2 overflow-x-auto no-scrollbar w-full">
              <div className="flex flex-nowrap gap-1 p-1 rounded-full border w-fit" style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }} role="tablist">
                {[
                  { key: 'floor', label: 'Live Floor' },
                  { key: 'profit', label: 'Profitability' },
                  { key: 'peak', label: 'Peak Hours' },
                  { key: 'tcfg', label: 'Alert Settings' }
                ].map((tab) => (
                  <button
                    key={tab.key}
                    role="tab"
                    aria-selected={activeSubTab === tab.key}
                    onClick={() => setActiveSubTab(tab.key)}
                    className="px-5 py-2 rounded-full text-xs font-bold transition whitespace-nowrap cursor-pointer"
                    style={activeSubTab === tab.key
                      ? { background: 'var(--turmeric)', color: '#2A1607', boxShadow: 'var(--sh-1)' }
                      : { color: 'var(--ink-2)', background: 'transparent' }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* KPI row (shared) */}
            <div className="grid grid-cols-1 gap-4">
              <section className="card p-4">
                <span className="block text-xs mb-2 text-ink-3">Occupied now</span>
                <span className="block text-2xl md:text-3xl font-bold tnum font-mono">{tablesData?.totals?.occupied ?? 0}<span className="text-base text-ink-3"> / {tablesData?.totals?.tables ?? 0}</span></span>
                {(tablesData?.totals?.lowRevenueCount ?? 0) > 0 && <span className="text-xs font-bold" style={{ color: 'var(--clay)' }}>{tablesData.totals.lowRevenueCount} low-revenue ⚠</span>}
              </section>
            </div>

            {activeSubTab === 'floor' && (() => {
              const occMap = new Map<string, any>((tablesData?.occupancy ?? []).map((o: any) => [o.id, o]));
              const STATUS = {
                free: { label: 'Free', color: '#34C759' },
                occupied: { label: 'Occupied', color: '#3B82F6' },
                long: { label: 'Long stay', color: '#E8A22B' },
                low: { label: 'Low revenue', color: '#C3492F' },
              };
              const minutes = tablesData?.config?.minutes ?? 90;
              const statusOf = (id: string): keyof typeof STATUS => {
                const o = occMap.get(id);
                if (!o) return 'free';
                if (o.lowRevenue) return 'low';
                if (o.durationMin >= minutes) return 'long';
                return 'occupied';
              };
              const roster = tablesData?.roster ?? [];
              const floorList = tablesData?.floors ?? [];
              // group tables under their floor (mirrors the POS floor map); a missing/stale floorId falls under "Unassigned"
              const floorIds = new Set(floorList.map((f: any) => f.id));
              const groups: { key: string; name: string; tables: any[] }[] = [
                ...floorList.map((f: any) => ({ key: f.id, name: f.name, tables: roster.filter((t: any) => t.floorId === f.id) })),
                { key: 'unassigned', name: 'Unassigned', tables: roster.filter((t: any) => !t.floorId || !floorIds.has(t.floorId)) },
              ].filter((g) => g.tables.length > 0);
              const renderTile = (t: any) => {
                const st = statusOf(t.id);
                const s = STATUS[st];
                const o = occMap.get(t.id);
                return (
                  <div
                    key={t.id}
                    onClick={o ? () => openTableOrders(t) : undefined}
                    role={o ? 'button' : undefined}
                    tabIndex={o ? 0 : undefined}
                    onKeyDown={o ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openTableOrders(t); } } : undefined}
                    title={o ? 'View orders on this table' : undefined}
                    className={`rounded-xl border p-3 flex flex-col gap-1${o ? ' cursor-pointer transition hover:-translate-y-0.5' : ''}`}
                    style={{ background: `color-mix(in srgb, ${s.color} 8%, var(--paper-3))`, borderColor: s.color, borderTopWidth: 3, borderTopColor: s.color }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display font-bold text-lg">{t.label}</span>
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                    </div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wide" style={{ color: s.color }}>{s.label}</span>
                    {o ? (
                      <div className="text-[11px] mt-0.5" style={{ color: 'var(--ink-3)' }}>
                        <div className="flex justify-between"><span>{o.durationMin} min</span><span className="font-mono">{formatINR(o.billPaise)}</span></div>
                        <span className="flex justify-between"><span>{o.orders} order{o.orders > 1 ? 's' : ''}</span><span style={{ color: s.color }}>view ▸</span></span>
                      </div>
                    ) : (
                      <span className="text-[11px] mt-0.5" style={{ color: 'var(--ink-3)' }}>{'•'.repeat(t.seats)} · open</span>
                    )}
                  </div>
                );
              };
              return (
                <section className="card p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <h4 className="font-bold">Live Floor</h4>
                    {/* top status legend */}
                    <div className="flex flex-wrap gap-3">
                      {Object.entries(STATUS).map(([k, s]) => (
                        <span key={k} className="inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: 'var(--ink-2)' }}>
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />{s.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  {tablesLoading && !tablesData ? (
                    <TeaLoader label="Loading…" size={44} />
                  ) : roster.length === 0 ? (
                    <p className="text-sm text-ink-3">No tables configured yet.</p>
                  ) : (
                    <div className="flex flex-col gap-5">
                      {groups.map((g) => (
                        <div key={g.key}>
                          {floorList.length > 0 && (
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-extrabold uppercase tracking-wide" style={{ color: 'var(--ink-3)' }}>{g.name}</span>
                              <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>· {g.tables.length} table{g.tables.length > 1 ? 's' : ''}</span>
                            </div>
                          )}
                          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
                            {g.tables.map(renderTile)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })()}

            {activeSubTab === 'profit' && (
              <section className="card p-5">
                <h4 className="font-bold mb-1">Table Profitability</h4>
                <p className="text-xs text-ink-3 mb-3">Revenue per table over the last 30 days — most profitable at the top.</p>
                {!tablesData?.profitability?.length ? (
                  <p className="text-sm text-ink-3">No table revenue yet.</p>
                ) : (() => {
                  const maxRev = Math.max(1, ...tablesData.profitability.map((p: any) => p.revenuePaise));
                  return (
                    <div className="grid gap-2">
                      {tablesData.profitability.map((p: any, idx: number) => {
                        const last = idx === tablesData.profitability.length - 1;
                        return (
                          <div key={p.id} className="text-sm p-3 rounded-xl" style={{ background: 'var(--paper-3)' }}>
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="font-bold">{p.label}
                                {idx === 0 && p.revenuePaise > 0 && <span className="ml-2 text-[10px] font-extrabold uppercase" style={{ color: 'var(--cardamom-d)' }}>★ top</span>}
                                {last && p.revenuePaise === 0 && <span className="ml-2 text-[10px] font-extrabold uppercase" style={{ color: 'var(--clay)' }}>idle</span>}
                              </span>
                              <span className="font-mono font-bold">{formatINR(p.revenuePaise)}</span>
                            </div>
                            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--line)' }}>
                              <div style={{ width: `${Math.round((p.revenuePaise / maxRev) * 100)}%`, height: '100%', background: 'var(--turmeric)' }} />
                            </div>
                            <div className="flex justify-between text-[11px] mt-1" style={{ color: 'var(--ink-3)' }}>
                              <span>{p.orders} orders</span><span>avg {p.avgStayMin} min</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </section>
            )}

            {activeSubTab === 'peak' && (
              <div className="flex flex-col gap-4">
                <section className="card p-5">
                  <h4 className="font-bold mb-3">Peak Hours (revenue, 30 days)</h4>
                  {!tablesData?.peakHours?.length ? (
                    <p className="text-sm text-ink-3">Not enough data yet.</p>
                  ) : (() => {
                    const maxRev = Math.max(1, ...tablesData.peakHours.map((h: any) => h.revenuePaise));
                    return (
                      <div className="flex items-end gap-1.5 h-40">
                        {tablesData.peakHours.map((h: any) => (
                          <div key={h.hour} className="flex-1 flex flex-col items-center gap-1 justify-end" title={`${h.hour}:00 · ${formatINR(h.revenuePaise)}`}>
                            <div className="w-full rounded-t" style={{ height: `${Math.max(2, Math.round((h.revenuePaise / maxRev) * 130))}px`, background: 'var(--turmeric)' }} />
                            <span className="text-[9px]" style={{ color: 'var(--ink-3)' }}>{h.hour}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </section>

                <section className="card p-5 overflow-x-auto">
                  <h4 className="font-bold mb-3">Revenue Heatmap (day × hour)</h4>
                  {!tablesData?.heatmap?.length ? (
                    <p className="text-sm text-ink-3">Not enough data yet.</p>
                  ) : (() => {
                    const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                    const hours = Array.from(new Set(tablesData.heatmap.map((c: any) => c.hour))).sort((a: any, b: any) => a - b) as number[];
                    const cell = new Map<string, number>();
                    let maxRev = 1;
                    for (const c of tablesData.heatmap) { cell.set(`${c.dow}-${c.hour}`, c.revenuePaise); maxRev = Math.max(maxRev, c.revenuePaise); }
                    return (
                      <table className="text-[10px]" style={{ borderCollapse: 'separate', borderSpacing: 2 }}>
                        <thead>
                          <tr><th></th>{hours.map((h) => <th key={h} className="font-bold text-ink-3 px-1">{h}</th>)}</tr>
                        </thead>
                        <tbody>
                          {DOW.map((d, dow) => (
                            <tr key={d}>
                              <td className="font-bold text-ink-3 pr-2">{d}</td>
                              {hours.map((h) => {
                                const rev = cell.get(`${dow}-${h}`) ?? 0;
                                const intensity = rev / maxRev;
                                return <td key={h} title={rev ? formatINR(rev) : ''} style={{ width: 22, height: 20, borderRadius: 4, background: rev ? `color-mix(in srgb, var(--turmeric) ${Math.round(15 + intensity * 85)}%, var(--paper-3))` : 'var(--paper-3)' }} />;
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    );
                  })()}
                </section>
              </div>
            )}

            {activeSubTab === 'tcfg' && (
              <section className="card p-5 max-w-md">
                <h4 className="font-bold mb-1">Low-Revenue Occupancy Alert</h4>
                <p className="text-xs text-ink-3 mb-3">Flag a table when it has been occupied beyond this many minutes while the bill is still under the amount below.</p>
                <form onSubmit={handleSaveTableConfig} className="grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="lbl">Occupied over (minutes)</label>
                      <input type="number" value={cfgMinutes} onChange={(e) => setCfgMinutes(e.target.value)} placeholder="90" className="inp" />
                    </div>
                    <div>
                      <label className="lbl">Bill under (₹)</label>
                      <input type="number" value={cfgMinBill} onChange={(e) => setCfgMinBill(e.target.value)} placeholder="500" className="inp" />
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary mt-1">Save thresholds</button>
                </form>
              </section>
            )}
          </div>
        )}

        {/* ── 4. Reports View ── */}
        {activeMenu === 'reports' && (
          <div className="flex flex-col gap-4">
            {/* Tabs */}
            <div className="flex justify-start md:justify-center pb-2 overflow-x-auto no-scrollbar w-full">
              <div className="flex flex-nowrap gap-1 p-1 rounded-full border w-fit" style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }} role="tablist">
                {[
                  { key: 'daily', label: 'Daily Sales' },
                  { key: 'best', label: 'Top Items' },
                  { key: 'gst', label: 'GST Report' },
                  ...(isAdvanced ? [
                    { key: 'analytics', label: 'Advanced Analytics 📊' },
                    { key: 'forecast', label: 'Demand Forecast' }
                  ] : [])
                ].map((tab) => (
                  <button
                    key={tab.key}
                    role="tab"
                    aria-selected={activeSubTab === tab.key}
                    onClick={() => setActiveSubTab(tab.key)}
                    className="px-5 py-2 rounded-full text-xs font-bold transition whitespace-nowrap cursor-pointer"
                    style={activeSubTab === tab.key
                      ? { background: 'var(--turmeric)', color: '#2A1607', boxShadow: 'var(--sh-1)' }
                      : { color: 'var(--ink-2)', background: 'transparent' }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {activeSubTab === 'daily' && (
              <section className="card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h4 className="font-bold">Daily Sales Ledger</h4>
                  <ExportBar name="daily-sales" title="Daily Sales Ledger" headers={['Date', 'Orders', 'Revenue', 'Discount', 'Tax']} rows={trend.map((t) => [`${t.date} (${t.label})`, t.orders, formatINR(t.grossPaise), formatINR(0), formatINR(Math.round(t.grossPaise * 0.05))])} />
                </div>
                <div className="overflow-x-auto">
                  <table className="rtable w-full text-sm border-collapse text-left">
                    <thead>
                      <tr className="border-b" style={{ borderColor: 'var(--line)' }}>
                        <th className="pb-2">Date</th>
                        <th className="pb-2">Orders</th>
                        <th className="pb-2">Revenue</th>
                        <th className="pb-2">Discount</th>
                        <th className="pb-2">Tax</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trend.map((t, idx) => (
                        <tr key={idx} className="border-b" style={{ borderColor: 'var(--line-2)' }}>
                          <td className="py-2" data-label="Date">{t.date} ({t.label})</td>
                          <td className="py-2 font-mono" data-label="Orders">{t.orders}</td>
                          <td className="py-2 font-mono" data-label="Revenue">{formatINR(t.grossPaise)}</td>
                          <td className="py-2 font-mono" data-label="Discount">{formatINR(0)}</td>
                          <td className="py-2 font-mono" data-label="Tax">{formatINR(Math.round(t.grossPaise * 0.05))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {activeSubTab === 'best' && (
              <section className="card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h4 className="font-bold">Top Selling Products</h4>
                  <ExportBar name="top-items" title="Top Selling Products" headers={['Product', 'Qty sold', 'Gross revenue']} rows={topItems.map((i) => [i.name, i.qty, formatINR(i.revenuePaise)])} />
                </div>
                <div className="overflow-x-auto">
                  <table className="rtable w-full text-sm border-collapse text-left">
                    <thead>
                      <tr className="border-b" style={{ borderColor: 'var(--line)' }}>
                        <th className="pb-2">Product Name</th>
                        <th className="pb-2">Quantity Sold</th>
                        <th className="pb-2">Gross Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topItems.map((item, idx) => (
                        <tr key={idx} className="border-b" style={{ borderColor: 'var(--line-2)' }}>
                          <td className="py-2 font-bold" data-label="Product">{item.name}</td>
                          <td className="py-2 font-mono" data-label="Qty sold">{item.qty}</td>
                          <td className="py-2 font-mono" data-label="Gross revenue">{formatINR(item.revenuePaise)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {activeSubTab === 'gst' && (
              <div className="flex flex-col gap-4">
                {!salesGst ? (
                  <section className="card p-5"><p className="text-sm text-ink-3">Loading GST summary…</p></section>
                ) : (
                  <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <section className="card p-4">
                        <span className="block text-xs mb-2" style={{ color: 'var(--ink-3)' }}>Tax collected · 30d</span>
                        <span className="block text-2xl font-bold font-mono">{formatINR(salesGst.gst.taxCollectedPaise)}</span>
                      </section>
                      <section className="card p-4">
                        <span className="block text-xs mb-2" style={{ color: 'var(--ink-3)' }}>Taxable sales</span>
                        <span className="block text-2xl font-bold font-mono">{formatINR(salesGst.gst.taxableSalesPaise)}</span>
                      </section>
                      <section className="card p-4">
                        <span className="block text-xs mb-2" style={{ color: 'var(--ink-3)' }}>Non-taxable sales</span>
                        <span className="block text-2xl font-bold font-mono">{formatINR(salesGst.gst.nonTaxableSalesPaise)}</span>
                      </section>
                      <section className="card p-4">
                        <span className="block text-xs mb-2" style={{ color: 'var(--ink-3)' }}>Net tax rate</span>
                        <span className="block text-2xl font-bold font-mono">
                          {salesGst.gst.taxableSalesPaise > 0 ? `${((salesGst.gst.taxCollectedPaise / salesGst.gst.taxableSalesPaise) * 100).toFixed(1)}%` : '—'}
                        </span>
                      </section>
                    </div>

                    <section className="card p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <h4 className="font-bold">GST by rate</h4>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-ink-3">last 30 days · by item slab</span>
                          <ExportBar name="gst-report" title="GST by rate" headers={['GST slab', 'Revenue', 'Est. tax']} rows={salesGst.gst.byRate.map((r: any) => [r.rate === 0 ? 'Tax-free (0%)' : `${r.rate}%`, formatINR(r.revenuePaise), r.rate === 0 ? '—' : formatINR(r.estTaxPaise)])} />
                        </div>
                      </div>
                      {salesGst.gst.byRate.length === 0 ? (
                        <p className="text-sm text-ink-3 py-4 text-center">No sales in this window yet.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="rtable w-full text-sm border-collapse text-left">
                            <thead>
                              <tr className="border-b" style={{ borderColor: 'var(--line)' }}>
                                <th className="pb-2">GST slab</th>
                                <th className="pb-2 text-right">Revenue</th>
                                <th className="pb-2 text-right">Est. tax</th>
                              </tr>
                            </thead>
                            <tbody>
                              {salesGst.gst.byRate.map((r: any) => (
                                <tr key={r.rate} className="border-b" style={{ borderColor: 'var(--line-2)' }}>
                                  <td className="py-2 font-bold" data-label="GST slab">{r.rate === 0 ? 'Tax-free (0%)' : `${r.rate}%`}</td>
                                  <td className="py-2 font-mono text-right" data-label="Revenue">{formatINR(r.revenuePaise)}</td>
                                  <td className="py-2 font-mono text-right" data-label="Est. tax">{r.rate === 0 ? '—' : formatINR(r.estTaxPaise)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      <p className="text-[11px] mt-3" style={{ color: 'var(--ink-3)' }}>
                        “Tax collected” above is the exact amount billed (CGST+SGST+IGST). “Est. tax” per slab is a revenue×rate estimate for reconciliation.
                      </p>
                    </section>
                  </>
                )}
              </div>
            )}

            {isAdvanced && activeSubTab === 'analytics' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 7-day trend bar chart */}
                <section className="card p-5">
                  <h4 className="font-bold mb-3">7-Day Sales Trend</h4>
                  <div className="flex items-end justify-between gap-2 h-40 mt-6">
                    {trend.map((t, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-1.5">
                        <div
                          className="w-full max-w-[28px] rounded-t-md relative"
                          style={{ height: `${(t.orders / Math.max(...trend.map((x) => x.orders), 1)) * 100}%`, minHeight: t.orders > 0 ? 6 : 2, background: 'var(--turmeric)' }}
                        />
                        <span className="text-[10px]">{t.label}</span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* hour-of-day heatmap */}
                <section className="card p-5">
                  <h4 className="font-bold mb-3">Hour-of-day Heatmap</h4>
                  <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] gap-0.5 h-10 mt-6">
                    {hourly.map((v, idx) => (
                      <div
                        key={idx}
                        className="h-full rounded-sm"
                        style={{ background: v > 0 ? `rgba(232,144,42, ${v / Math.max(...hourly, 1)})` : 'var(--paper-3)', border: '1px solid var(--line-2)' }}
                        title={`${v} orders`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between mt-2 text-[10px]" style={{ color: 'var(--ink-3)' }}>
                    <span>12a</span><span>6a</span><span>12p</span><span>6p</span><span>11p</span>
                  </div>
                </section>

                {/* menu engineering quadrant */}
                <section className="card p-5 md:col-span-2">
                  <h4 className="font-bold mb-3">Menu Engineering Quadrant</h4>
                  <div className="relative h-40 sm:h-48 lg:h-56 border rounded-xl mt-2" style={{ background: 'var(--paper-3)' }}>
                    {menuQuadrant.map((d) => (
                      <span
                        key={d.itemId}
                        className="absolute w-2.5 h-2.5 rounded-full ring-2 ring-white"
                        style={{ left: `${d.pop}%`, bottom: `${d.profit}%`, background: d.quad === 'star' ? 'var(--cardamom)' : 'var(--turmeric)' }}
                        title={d.name}
                      />
                    ))}
                    <div className="absolute top-1 left-2 text-[10px] text-ink-3">High Margin / Low Vol (Puzzles)</div>
                    <div className="absolute top-1 right-2 text-[10px] text-cardamom-d">High Margin / High Vol (Stars)</div>
                  </div>
                </section>
              </div>
            )}

            {isAdvanced && activeSubTab === 'forecast' && (
              <section className="card p-5">
                <h4 className="font-bold mb-3">AI Demand Forecasting</h4>
                <div className="p-4 rounded-xl" style={{ background: 'var(--paper-3)' }}>
                  <p className="text-sm">Based on recent sales ledger trends, Milk is expected to reach critical levels in <b>2 days</b>. Suggest raising PO today.</p>
                </div>
              </section>
            )}
          </div>
        )}

        {/* ── 5. Settings View (also hosts the top-level Menu Items page) ── */}
        {(activeMenu === 'settings' || activeMenu === 'menu') && (
          <div className="flex flex-col gap-4">
            {activeMenu === 'settings' && (
              <SettingsCenter
                outlet={outlet}
                staff={staff}
                features={features}
                profile={profile}
                setProfile={setProfile}
                handleSaveProfile={handleSaveProfile}
                handleSaveGst={handleSaveGst}
                gstSaving={gstSaving}
                location={location}
                setLocation={setLocation}
                handleSaveLocation={handleSaveLocation}
                locationSaving={locationSaving}
                logoUrl={logoUrl}
                logoBusy={logoBusy}
                handleLogoFile={handleLogoFile}
                saveLogo={saveLogo}
                kwForm={kwForm}
                setKwForm={setKwForm}
                handleSaveKitchenWorkflow={handleSaveKitchenWorkflow}
                kwSaving={kwSaving}
                receiptForm={receiptForm}
                setReceiptForm={setReceiptForm}
                handleSaveReceipt={handleSaveReceipt}
                receiptSaving={receiptSaving}
                devices={devices}
                setDevices={setDevices}
                handleSaveDevice={handleSaveDevice}
                handleDeleteDevice={handleDeleteDevice}
                handleSetDefaultDevice={handleSetDefaultDevice}
                deviceForm={deviceForm}
                setDeviceForm={setDeviceForm}
                showDeviceForm={showDeviceForm}
                setShowDeviceForm={setShowDeviceForm}
                openDeviceForm={openDeviceForm}
                floors={floors}
                floorTables={floorTables}
                kitchens={kitchens}
                setKitchens={setKitchens}
                kitchenApi={kitchenApi}
                kitchenBusy={kitchenBusy}
                pwaCfg={pwaCfg}
                setPwaCfg={setPwaCfg}
                handleSavePwa={handleSavePwa}
                pwaSaving={pwaBusy}
                uploadImage={uploadImage}
                auditList={auditEntries}
                auditTotal={auditHasMore ? (auditPage * 20 + 1) : auditEntries.length}
                auditPage={auditPage}
                loadAudit={loadAudit}
                flashMessage={flashMessage}
                isAdvanced={isAdvanced}
                handleToggleAdvanced={handleToggleAdvanced}
                menuItems={menuItems}
                menuCategories={menuCategories}
                setMenuItems={setMenuItems}
              />
            )}

            {activeMenu === 'menu' && (
              <div className="flex flex-col gap-4">
                {/* Menu sub-tabs */}
                <div className="flex justify-start md:justify-center pb-1 overflow-x-auto no-scrollbar w-full">
                  <div className="flex flex-nowrap gap-1 p-1 rounded-full border shadow-sm w-fit" style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }} role="tablist">
                    <button
                      role="tab"
                      aria-selected={activeSubTab === 'menu'}
                      onClick={() => setActiveSubTab('menu')}
                      className="px-5 py-2 rounded-full text-xs font-bold transition whitespace-nowrap cursor-pointer"
                      style={activeSubTab === 'menu'
                        ? { background: 'var(--turmeric)', color: '#2A1607', boxShadow: 'var(--sh-1)' }
                        : { color: 'var(--ink-2)', background: 'transparent' }}
                    >
                      📝 Menu Management
                    </button>
                    <button
                      role="tab"
                      aria-selected={activeSubTab === 'availability'}
                      onClick={() => setActiveSubTab('availability')}
                      className="px-5 py-2 rounded-full text-xs font-bold transition whitespace-nowrap cursor-pointer"
                      style={activeSubTab === 'availability'
                        ? { background: 'var(--turmeric)', color: '#2A1607', boxShadow: 'var(--sh-1)' }
                        : { color: 'var(--ink-2)', background: 'transparent' }}
                    >
                      ⚡ Availability & Limits
                    </button>
                  </div>
                </div>

                {activeSubTab === 'menu' ? (() => {
                  const q = menuSearch.trim().toLowerCase();
                  // search + category filter
                  const filtered = menuItems.filter((m) => {
                    if (q && !m.name.toLowerCase().includes(q)) return false;
                    if (menuCatFilter === 'all') return true;
                    if (menuCatFilter === 'none') return !m.categoryId;
                    return m.categoryId === menuCatFilter;
                  });
                  // only offer the "Uncategorised" chip when such items exist
                  const hasUncategorised = menuItems.some((m) => !m.categoryId);
                  // group the filtered items by category, following the category sort order
                  const groups: { id: string; name: string; items: any[] }[] = [];
                  for (const c of menuCategories) {
                    const items = filtered.filter((m) => m.categoryId === c.id);
                    if (items.length) groups.push({ id: c.id, name: c.name, items });
                  }
                  const loose = filtered.filter((m) => !m.categoryId);
                  if (loose.length) groups.push({ id: 'none', name: 'Uncategorised', items: loose });
                  return (
                  <section className="card p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                      <h4 className="font-bold">Menu Management</h4>
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--ink-3)' }}>🔍</span>
                          <input
                            value={menuSearch}
                            onChange={(e) => setMenuSearch(e.target.value)}
                            placeholder="Search items…"
                            className="pl-8 pr-3 py-2 rounded-xl border text-sm outline-none w-44"
                            style={{ background: 'var(--paper-3)', borderColor: 'var(--line-2)' }}
                          />
                        </div>
                        <button onClick={() => setShowAddProduct((v) => !v)} className={`btn py-2 px-3 text-sm shrink-0 ${showAddProduct ? '' : 'btn-primary'}`} style={showAddProduct ? { background: 'var(--paper-2)', border: '1px solid var(--line)' } : undefined}>
                          {showAddProduct ? '✕ Cancel' : '+ Add Product'}
                        </button>
                      </div>
                    </div>

                    {/* category filter chips */}
                    {menuCategories.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {[{ id: 'all', name: 'All' }, ...menuCategories, ...(hasUncategorised ? [{ id: 'none', name: 'Uncategorised' }] : [])].map((c) => {
                          const active = menuCatFilter === c.id;
                          return (
                            <button
                              key={c.id}
                              onClick={() => setMenuCatFilter(c.id)}
                              className="px-3 py-1.5 rounded-full text-xs font-bold transition"
                              style={active
                                ? { background: 'var(--turmeric)', color: '#2A1607' }
                                : { background: 'var(--paper-3)', color: 'var(--ink-2)', border: '1px solid var(--line-2)' }}
                            >
                              {c.name}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Kitchens / prep stations — where each item routes on the KDS */}
                    <div className="p-4 mb-4 rounded-xl" style={{ background: 'var(--paper-3)', border: '1px solid var(--line-2)' }}>
                      <h5 className="font-bold text-sm mb-1">Kitchens / prep stations</h5>
                      <p className="text-xs text-ink-3 mb-3">Each product routes to one kitchen. Orders split into one ticket per kitchen on the KDS — a café with 2 kitchens (say Hot &amp; Cold) gets a screen tab for each.</p>
                      <form onSubmit={handleAddKitchen} className="flex flex-wrap items-end gap-2 mb-3">
                        <input value={newKitchenName} onChange={(e) => setNewKitchenName(e.target.value)} placeholder="e.g. Hot Kitchen" className="inp flex-1 min-w-[160px]" />
                        <button type="submit" disabled={kitchenBusy} className="btn btn-primary disabled:opacity-50">Add kitchen</button>
                      </form>
                      <div className="flex flex-wrap gap-2">
                        {kitchens.map((k) => editKitchenId === k.id ? (
                          <div key={k.id} className="flex items-center gap-1 px-2 py-1 rounded-lg" style={{ background: 'var(--paper-2)', border: '1px solid var(--line)' }}>
                            <input value={editKitchenName} onChange={(e) => setEditKitchenName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleRenameKitchen(k.id); } if (e.key === 'Escape') setEditKitchenId(null); }} className="w-32 p-1 rounded-lg border text-sm outline-none" style={{ background: 'var(--paper-2)', borderColor: 'var(--line-2)' }} autoFocus />
                            <button onClick={() => handleRenameKitchen(k.id)} disabled={kitchenBusy} className="btn btn-primary py-1 px-2 text-xs disabled:opacity-50">Save</button>
                            <button onClick={() => setEditKitchenId(null)} className="btn py-1 px-2 text-xs" style={{ background: 'var(--paper-2)', border: '1px solid var(--line)' }}>✕</button>
                          </div>
                        ) : (
                          <span key={k.id} className="inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-lg text-sm font-bold" style={{ background: 'var(--paper-2)', border: '1px solid var(--line)' }}>
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: k.color ?? 'var(--turmeric)' }} />
                            {k.name}
                            <button onClick={() => { setEditKitchenId(k.id); setEditKitchenName(k.name); }} className="text-xs text-ink-3 hover:text-ink" title="Rename" aria-label={`Rename ${k.name}`}>✎</button>
                            <button onClick={() => handleDeleteKitchen(k)} className="text-xs" style={{ color: 'var(--clay)' }} title="Delete" aria-label={`Delete ${k.name}`}>🗑</button>
                          </span>
                        ))}
                      </div>
                    </div>

                    {showAddProduct && (
                      <form onSubmit={handleCreateProduct} className="grid gap-3 p-4 mb-4 rounded-xl" style={{ background: 'var(--paper-3)', border: '1px solid var(--line-2)' }}>
                        <div className="grid sm:grid-cols-2 gap-3">
                          <div>
                            <label className="lbl">Product name</label>
                            <input value={newProduct.name} onChange={(e) => setNewProduct((p) => ({ ...p, name: e.target.value }))} required placeholder="e.g. Masala Chai" className="w-full p-2.5 rounded-xl border text-sm outline-none" style={{ background: 'var(--paper-2)', borderColor: 'var(--line-2)' }} />
                          </div>
                          <div>
                            <label className="lbl">Price (₹)</label>
                            <input value={newProduct.price} onChange={(e) => setNewProduct((p) => ({ ...p, price: e.target.value }))} required type="number" step="0.01" min="0" placeholder="0.00" className="w-full p-2.5 rounded-xl border text-sm outline-none" style={{ background: 'var(--paper-2)', borderColor: 'var(--line-2)' }} />
                          </div>
                        </div>
                        <div className="grid sm:grid-cols-5 gap-3">
                          <div>
                            <label className="lbl">Category</label>
                            <select value={newProduct.categoryId} onChange={(e) => setNewProduct((p) => ({ ...p, categoryId: e.target.value }))} className="w-full p-2.5 rounded-xl border text-sm outline-none" style={{ background: 'var(--paper-2)', borderColor: 'var(--line-2)' }}>
                              <option value="">— Uncategorised —</option>
                              {menuCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="lbl">HSN/SAC Code</label>
                            <input value={newProduct.hsnCode} onChange={(e) => setNewProduct((p) => ({ ...p, hsnCode: e.target.value }))} placeholder="e.g. 996331" className="w-full p-2.5 rounded-xl border text-sm outline-none" style={{ background: 'var(--paper-2)', borderColor: 'var(--line-2)' }} />
                          </div>
                          <div>
                            <label className="lbl">GST rate (%)</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              disabled={newProduct.tags?.includes('tax_exempt') || newProduct.tags?.includes('zero_rated') || newProduct.tags?.includes('nil_rated')}
                              value={newProduct.gstRate}
                              onChange={(e) => setNewProduct((p) => ({ ...p, gstRate: e.target.value }))}
                              className="w-full p-2.5 rounded-xl border text-sm outline-none"
                              style={{ background: 'var(--paper-2)', borderColor: 'var(--line-2)' }}
                            />
                          </div>
                          <div>
                            <label className="lbl">Station</label>
                            <select value={newProduct.station} onChange={(e) => setNewProduct((p) => ({ ...p, station: e.target.value }))} className="w-full p-2.5 rounded-xl border text-sm outline-none" style={{ background: 'var(--paper-2)', borderColor: 'var(--line-2)' }}>
                              {stationOptions(newProduct.station).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="lbl">Availability</label>
                            <select value={newProduct.isAvailable ? 'true' : 'false'} onChange={(e) => setNewProduct((p) => ({ ...p, isAvailable: e.target.value === 'true' }))} className="w-full p-2.5 rounded-xl border text-sm outline-none" style={{ background: 'var(--paper-2)', borderColor: 'var(--line-2)' }}>
                              <option value="true">Available</option>
                              <option value="false">Sold Out</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-4 items-center p-2 rounded-xl bg-paper-2 border" style={{ borderColor: 'var(--line-2)' }}>
                          <span className="text-xs font-bold text-ink-3">Exemptions:</span>
                          <label className="flex items-center gap-1.5 text-xs text-ink-2 select-none cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newProduct.tags?.includes('tax_exempt') ?? false}
                              onChange={(e) => {
                                const updated = e.target.checked
                                  ? [...(newProduct.tags ?? []).filter(t => t !== 'zero_rated' && t !== 'nil_rated'), 'tax_exempt']
                                  : (newProduct.tags ?? []).filter(t => t !== 'tax_exempt');
                                setNewProduct((p) => ({ ...p, tags: updated, gstRate: e.target.checked ? '0' : p.gstRate }));
                              }}
                              className="rounded border-line-2 text-turmeric accent-turmeric"
                            />
                            Tax Exempt (0% GST)
                          </label>
                          <label className="flex items-center gap-1.5 text-xs text-ink-2 select-none cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newProduct.tags?.includes('zero_rated') ?? false}
                              onChange={(e) => {
                                const updated = e.target.checked
                                  ? [...(newProduct.tags ?? []).filter(t => t !== 'tax_exempt' && t !== 'nil_rated'), 'zero_rated']
                                  : (newProduct.tags ?? []).filter(t => t !== 'zero_rated');
                                setNewProduct((p) => ({ ...p, tags: updated, gstRate: e.target.checked ? '0' : p.gstRate }));
                              }}
                              className="rounded border-line-2 text-turmeric accent-turmeric"
                            />
                            Zero Rated (0% GST)
                          </label>
                          <label className="flex items-center gap-1.5 text-xs text-ink-2 select-none cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newProduct.tags?.includes('nil_rated') ?? false}
                              onChange={(e) => {
                                const updated = e.target.checked
                                  ? [...(newProduct.tags ?? []).filter(t => t !== 'tax_exempt' && t !== 'zero_rated'), 'nil_rated']
                                  : (newProduct.tags ?? []).filter(t => t !== 'nil_rated');
                                setNewProduct((p) => ({ ...p, tags: updated, gstRate: e.target.checked ? '0' : p.gstRate }));
                              }}
                              className="rounded border-line-2 text-turmeric accent-turmeric"
                            />
                            Nil Rated (0% GST)
                          </label>
                        </div>
                        <div>
                          <label className="lbl">Description (optional)</label>
                          <input value={newProduct.description} onChange={(e) => setNewProduct((p) => ({ ...p, description: e.target.value }))} placeholder="Short description shown to customers" className="w-full p-2.5 rounded-xl border text-sm outline-none" style={{ background: 'var(--paper-2)', borderColor: 'var(--line-2)' }} />
                        </div>
                        <div className="flex flex-wrap items-end gap-2">
                          <div className="flex-1 min-w-[180px]">
                            <label className="lbl">New category (optional)</label>
                            <div className="flex gap-2">
                              <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="e.g. Beverages" className="flex-1 p-2.5 rounded-xl border text-sm outline-none" style={{ background: 'var(--paper-2)', borderColor: 'var(--line-2)' }} />
                              <button type="button" onClick={handleCreateCategory} className="btn py-2 px-3 text-sm" style={{ background: 'var(--paper-2)', border: '1px solid var(--line)' }}>Add</button>
                            </div>
                          </div>
                          <button type="submit" className="btn btn-primary">Create product</button>
                        </div>
                      </form>
                    )}
                    {inventoryLoading ? (
                      <p className="text-sm">Loading Menu...</p>
                    ) : menuItems.length === 0 ? (
                      <p className="text-sm text-ink-3">No menu items found.</p>
                    ) : filtered.length === 0 ? (
                      <p className="text-sm text-ink-3">{menuSearch ? `No items match “${menuSearch}”.` : 'No items in this category.'}</p>
                    ) : (
                      <div className="flex flex-col gap-5">
                        {groups.map((g) => (
                          <div key={g.id}>
                            <div className="flex items-center gap-2 mb-2">
                              <h5 className="font-bold text-sm">{g.name}</h5>
                              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--paper-3)', color: 'var(--ink-3)' }}>{g.items.length}</span>
                            </div>
                            <div className="grid gap-2">
                        {g.items.map((item) => (
                          <div key={item.id} className="rounded-xl" style={{ background: 'var(--paper-3)' }}>
                            <div className="flex justify-between items-center gap-2 text-sm p-3">
                              <div className="min-w-0">
                                <b className="block truncate">{item.name}</b>
                                {priceEditId === item.id ? (
                                  <div className="flex items-center gap-1 mt-1">
                                    <span className="text-xs text-ink-3">₹</span>
                                    <input autoFocus type="number" step="0.01" value={priceDraft} onChange={(e) => setPriceDraft(e.target.value)}
                                      onKeyDown={(e) => { if (e.key === 'Enter') handleSavePrice(item.id); if (e.key === 'Escape') setPriceEditId(null); }}
                                      className="w-24 p-1 rounded-lg border text-xs outline-none" style={{ background: 'var(--paper-2)', borderColor: 'var(--line-2)' }} />
                                    <button onClick={() => handleSavePrice(item.id)} className="btn py-1 px-2 text-xs btn-primary">Save</button>
                                    <button onClick={() => setPriceEditId(null)} className="btn py-1 px-2 text-xs" style={{ background: 'var(--paper-2)', border: '1px solid var(--line)' }}>✕</button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-ink-3">
                                    <button onClick={() => { setPriceEditId(item.id); setPriceDraft((item.pricePaise / 100).toString()); }} className="underline decoration-dotted">
                                      {formatINR(item.pricePaise)}
                                    </button>
                                    {item.station ? <span> · {kitchens.find((k) => k.id === item.station)?.name ?? item.station}</span> : null} · GST {item.gstRate}%
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  onClick={() => (editProductId === item.id ? setEditProductId(null) : startEditProduct(item))}
                                  className="btn py-1 px-3 text-xs"
                                  style={{ background: 'var(--paper-2)', border: '1px solid var(--line)' }}
                                >
                                  {editProductId === item.id ? 'Close' : 'Customize'}
                                </button>
                                <button
                                  onClick={() => handleToggleMenuAvailability(item.id, !item.isAvailable)}
                                  className={`btn py-1 px-3 text-xs ${item.isAvailable ? 'btn-primary' : 'btn-dark'}`}
                                >
                                  {item.isAvailable ? 'Available' : 'Sold Out'}
                                </button>
                              </div>
                            </div>

                            {editProductId === item.id && (
                              <div className="grid gap-3 px-3 pb-3 pt-1 border-t" style={{ borderColor: 'var(--line-2)' }}>
                                <div className="grid sm:grid-cols-2 gap-3">
                                  <div>
                                    <label className="lbl">Name</label>
                                    <input value={editDraft.name} onChange={(e) => setEditDraft((p) => ({ ...p, name: e.target.value }))} className="w-full p-2.5 rounded-xl border text-sm outline-none" style={{ background: 'var(--paper-2)', borderColor: 'var(--line-2)' }} />
                                  </div>
                                  <div>
                                    <label className="lbl">Price (₹)</label>
                                    <input value={editDraft.price} onChange={(e) => setEditDraft((p) => ({ ...p, price: e.target.value }))} type="number" step="0.01" min="0" className="w-full p-2.5 rounded-xl border text-sm outline-none" style={{ background: 'var(--paper-2)', borderColor: 'var(--line-2)' }} />
                                  </div>
                                </div>
                                <div className="grid sm:grid-cols-5 gap-3">
                                  <div>
                                    <label className="lbl">Category</label>
                                    <select value={editDraft.categoryId} onChange={(e) => setEditDraft((p) => ({ ...p, categoryId: e.target.value }))} className="w-full p-2.5 rounded-xl border text-sm outline-none" style={{ background: 'var(--paper-2)', borderColor: 'var(--line-2)' }}>
                                      <option value="">— Uncategorised —</option>
                                      {menuCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="lbl">HSN/SAC Code</label>
                                    <input value={editDraft.hsnCode} onChange={(e) => setEditDraft((p) => ({ ...p, hsnCode: e.target.value }))} placeholder="e.g. 996331" className="w-full p-2.5 rounded-xl border text-sm outline-none" style={{ background: 'var(--paper-2)', borderColor: 'var(--line-2)' }} />
                                  </div>
                                  <div>
                                    <label className="lbl">GST rate (%)</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      max="100"
                                      disabled={editDraft.tags?.includes('tax_exempt') || editDraft.tags?.includes('zero_rated') || editDraft.tags?.includes('nil_rated')}
                                      value={editDraft.gstRate}
                                      onChange={(e) => setEditDraft((p) => ({ ...p, gstRate: e.target.value }))}
                                      className="w-full p-2.5 rounded-xl border text-sm outline-none"
                                      style={{ background: 'var(--paper-2)', borderColor: 'var(--line-2)' }}
                                    />
                                  </div>
                                  <div>
                                    <label className="lbl">Station</label>
                                    <select value={editDraft.station} onChange={(e) => setEditDraft((p) => ({ ...p, station: e.target.value }))} className="w-full p-2.5 rounded-xl border text-sm outline-none" style={{ background: 'var(--paper-2)', borderColor: 'var(--line-2)' }}>
                                      {stationOptions(editDraft.station).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="lbl">Availability</label>
                                    <select value={editDraft.isAvailable ? 'true' : 'false'} onChange={(e) => setEditDraft((p) => ({ ...p, isAvailable: e.target.value === 'true' }))} className="w-full p-2.5 rounded-xl border text-sm outline-none" style={{ background: 'var(--paper-2)', borderColor: 'var(--line-2)' }}>
                                      <option value="true">Available</option>
                                      <option value="false">Sold Out</option>
                                    </select>
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-4 items-center p-2 rounded-xl bg-paper-2 border" style={{ borderColor: 'var(--line-2)' }}>
                                  <span className="text-xs font-bold text-ink-3">Exemptions:</span>
                                  <label className="flex items-center gap-1.5 text-xs text-ink-2 select-none cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={editDraft.tags?.includes('tax_exempt') ?? false}
                                      onChange={(e) => {
                                        const updated = e.target.checked
                                          ? [...(editDraft.tags ?? []).filter(t => t !== 'zero_rated' && t !== 'nil_rated'), 'tax_exempt']
                                          : (editDraft.tags ?? []).filter(t => t !== 'tax_exempt');
                                        setEditDraft((p) => ({ ...p, tags: updated, gstRate: e.target.checked ? '0' : p.gstRate }));
                                      }}
                                      className="rounded border-line-2 text-turmeric accent-turmeric"
                                    />
                                    Tax Exempt (0% GST)
                                  </label>
                                  <label className="flex items-center gap-1.5 text-xs text-ink-2 select-none cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={editDraft.tags?.includes('zero_rated') ?? false}
                                      onChange={(e) => {
                                        const updated = e.target.checked
                                          ? [...(editDraft.tags ?? []).filter(t => t !== 'tax_exempt' && t !== 'nil_rated'), 'zero_rated']
                                          : (editDraft.tags ?? []).filter(t => t !== 'zero_rated');
                                        setEditDraft((p) => ({ ...p, tags: updated, gstRate: e.target.checked ? '0' : p.gstRate }));
                                      }}
                                      className="rounded border-line-2 text-turmeric accent-turmeric"
                                    />
                                    Zero Rated (0% GST)
                                  </label>
                                  <label className="flex items-center gap-1.5 text-xs text-ink-2 select-none cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={editDraft.tags?.includes('nil_rated') ?? false}
                                      onChange={(e) => {
                                        const updated = e.target.checked
                                          ? [...(editDraft.tags ?? []).filter(t => t !== 'tax_exempt' && t !== 'zero_rated'), 'nil_rated']
                                          : (editDraft.tags ?? []).filter(t => t !== 'nil_rated');
                                        setEditDraft((p) => ({ ...p, tags: updated, gstRate: e.target.checked ? '0' : p.gstRate }));
                                      }}
                                      className="rounded border-line-2 text-turmeric accent-turmeric"
                                    />
                                    Nil Rated (0% GST)
                                  </label>
                                </div>
                                <div>
                                  <label className="lbl">Description</label>
                                  <input value={editDraft.description} onChange={(e) => setEditDraft((p) => ({ ...p, description: e.target.value }))} placeholder="Short description" className="w-full p-2.5 rounded-xl border text-sm outline-none" style={{ background: 'var(--paper-2)', borderColor: 'var(--line-2)' }} />
                                </div>
                                <div className="flex flex-wrap justify-between gap-2">
                                  <button onClick={() => handleDeleteProduct(item.id, item.name)} className="btn py-2 px-3 text-sm" style={{ background: 'var(--paper-2)', border: '1px solid var(--clay)', color: 'var(--clay)' }}>Delete</button>
                                  <div className="flex gap-2">
                                    <button onClick={() => setEditProductId(null)} className="btn py-2 px-3 text-sm" style={{ background: 'var(--paper-2)', border: '1px solid var(--line)' }}>Cancel</button>
                                    <button onClick={() => handleUpdateProduct(item.id)} className="btn btn-primary py-2 px-4 text-sm">Save changes</button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                  );
                })() : (() => {
                  const q = menuSearch.trim().toLowerCase();
                  const filtered = menuItems.filter((m) => {
                    if (q && !m.name.toLowerCase().includes(q)) return false;
                    if (menuCatFilter === 'all') return true;
                    if (menuCatFilter === 'none') return !m.categoryId;
                    return m.categoryId === menuCatFilter;
                  });
                  const hasUncategorised = menuItems.some((m) => !m.categoryId);
                  return (
                    <section className="card p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                        <div>
                          <h4 className="font-bold">⚡ Availability & Daily Limits</h4>
                          <p className="text-xs text-ink-3 mt-1">Set items as Sold Out or configure a daily quantity limit (e.g. 15 remaining today).</p>
                        </div>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--ink-3)' }}>🔍</span>
                          <input
                            value={menuSearch}
                            onChange={(e) => setMenuSearch(e.target.value)}
                            placeholder="Search items…"
                            className="pl-8 pr-3 py-2 rounded-xl border text-sm outline-none w-44"
                            style={{ background: 'var(--paper-3)', borderColor: 'var(--line-2)' }}
                          />
                        </div>
                      </div>

                      {/* category filter chips */}
                      {menuCategories.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4">
                          {[{ id: 'all', name: 'All' }, ...menuCategories, ...(hasUncategorised ? [{ id: 'none', name: 'Uncategorised' }] : [])].map((c) => {
                            const active = menuCatFilter === c.id;
                            return (
                              <button
                                key={c.id}
                                onClick={() => setMenuCatFilter(c.id)}
                                className="px-3 py-1.5 rounded-full text-xs font-bold transition"
                                style={active
                                  ? { background: 'var(--turmeric)', color: '#2A1607' }
                                  : { background: 'var(--paper-3)', color: 'var(--ink-2)', border: '1px solid var(--line-2)' }}
                              >
                                {c.name}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {filtered.length === 0 ? (
                        <p className="text-sm text-ink-3">{menuSearch ? `No items match “${menuSearch}”.` : 'No items in this category.'}</p>
                      ) : (
                        <div className="grid gap-2.5">
                          {filtered.map((item) => {
                            const limitTag = item.tags?.find((t: string) => t.startsWith('limit:'));
                            const limitVal = limitTag ? limitTag.split(':')[1] : '';
                            return (
                              <div key={item.id} className="p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3 text-sm" style={{ background: 'var(--paper-3)', border: '1px solid var(--line-2)' }}>
                                <div className="min-w-0">
                                  <b className="block truncate">{item.name}</b>
                                  <span className="text-xs text-ink-3">
                                    {item.categoryId ? menuCategories.find(c => c.id === item.categoryId)?.name : 'Uncategorised'} · {formatINR(item.pricePaise)}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                  {/* availability toggle */}
                                  <button
                                    onClick={() => handleToggleMenuAvailability(item.id, !item.isAvailable)}
                                    className={`btn py-1 px-3 text-xs ${item.isAvailable ? 'btn-success' : 'btn-dark'}`}
                                    style={{ minHeight: '36px' }}
                                  >
                                    {item.isAvailable ? '🟢 Available' : '🔴 Sold Out'}
                                  </button>

                                  {/* quantity limit (only if Available) */}
                                  {item.isAvailable && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-ink-3">Daily Limit:</span>
                                      <input
                                        type="number"
                                        min="0"
                                        placeholder="No limit"
                                        defaultValue={limitVal}
                                        onBlur={(e) => {
                                          const val = e.target.value.trim();
                                          const newLimit = val === '' ? null : parseInt(val);
                                          handleSaveItemLimit(item, newLimit);
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            const val = (e.target as HTMLInputElement).value.trim();
                                            const newLimit = val === '' ? null : parseInt(val);
                                            handleSaveItemLimit(item, newLimit);
                                          }
                                        }}
                                        className="w-20 px-2 py-1 rounded-lg border text-xs text-center font-mono outline-none"
                                        style={{ background: 'var(--paper-2)', borderColor: 'var(--line-2)' }}
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  );
                })()}
              </div>
            )}



            {/* Settings modals cleaned up — handled inline in SettingsCenter */}
          </div>
        )}
      </main>

      {/* table QR preview / print modal */}
      {qrTable && (
        <div onClick={() => setQrTable(null)} className="fixed inset-0 z-[8500] grid place-items-center p-5" style={{ background: 'rgba(30,18,10,.5)', backdropFilter: 'blur(6px)' }}>
          <div onClick={(e) => e.stopPropagation()} className="w-[min(380px,100%)]" style={{ background: 'var(--paper-2)', borderRadius: 24, boxShadow: 'var(--sh-3)', border: '1px solid var(--line)' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--line)' }}>
              <div>
                <h3 className="text-lg font-bold">Table {qrTable.label}</h3>
                <span className="text-xs text-ink-3">{qrTable.seats} seat{qrTable.seats === 1 ? '' : 's'} · scan to order</span>
              </div>
              <button onClick={() => setQrTable(null)} aria-label="Close" className="btn py-1.5 px-3 text-sm" style={{ background: 'var(--paper-3)', border: '1px solid var(--line)' }}>✕</button>
            </div>
            <div className="p-5 flex flex-col items-center gap-3">
              <div className="rounded-2xl bg-white p-3" style={{ border: '1px solid var(--line-2)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={tableQrImageUrl(qrTable.qrToken, 480)} alt={`QR code for table ${qrTable.label}`} width={240} height={240} />
              </div>
              <code className="text-[11px] text-ink-3 break-all text-center px-2">{tableOrderUrl(qrTable.qrToken)}</code>
              <div className="grid grid-cols-2 gap-2 w-full mt-1">
                <button onClick={() => printTableQr(qrTable)} className="btn btn-primary py-2.5 text-sm">Print</button>
                <a href={tableQrImageUrl(qrTable.qrToken, 800)} download={`qr-${qrTable.label}.png`} target="_blank" rel="noopener noreferrer" className="btn py-2.5 text-sm text-center" style={{ background: 'var(--paper-3)', border: '1px solid var(--line)' }}>Download</a>
                <button onClick={() => copyTableLink(qrTable)} className="btn py-2.5 text-sm" style={{ background: 'var(--paper-3)', border: '1px solid var(--line)' }}>Copy link</button>
                <button onClick={() => handleRegenerateQr(qrTable)} disabled={floorBusy} className="btn py-2.5 text-sm disabled:opacity-50" style={{ background: 'var(--paper-3)', border: '1px solid var(--clay)', color: 'var(--clay)' }}>Rotate QR</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* supplier statement modal */}
      {statement && (
        <div onClick={() => setStatement(null)} className="fixed inset-0 z-[8500] grid place-items-center p-5" style={{ background: 'rgba(30,18,10,.5)', backdropFilter: 'blur(6px)' }}>
          <div onClick={(e) => e.stopPropagation()} className="w-[min(640px,100%)] max-h-[88vh] overflow-auto" style={{ background: 'var(--paper-2)', borderRadius: 24, boxShadow: 'var(--sh-3)', border: '1px solid var(--line)' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--line)' }}>
              <div>
                <h3 className="text-lg font-bold">{statement.vendor.name}</h3>
                <span className="text-xs text-ink-3">{statement.vendor.phone ?? ''}{statement.vendor.gstin ? ` · ${statement.vendor.gstin}` : ''}</span>
              </div>
              <div className="text-right">
                <span className="block text-[11px] text-ink-3 uppercase">Balance</span>
                <span className="font-mono font-bold text-lg" style={{ color: statement.balancePaise > 0 ? 'var(--clay)' : 'var(--cardamom-d)' }}>{formatINR(statement.balancePaise)}</span>
              </div>
            </div>
            <div className="p-5">
              <h4 className="font-bold text-sm mb-2">Statement</h4>
              {!statement.ledger?.length ? (
                <p className="text-sm text-ink-3">No transactions yet.</p>
              ) : (
                <div className="grid gap-1.5">
                  <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-3 text-[10px] font-bold uppercase text-ink-3 px-3">
                    <span>Entry</span><span className="text-right">Debit</span><span className="text-right">Credit</span><span className="text-right">Balance</span>
                  </div>
                  {statement.ledger.map((e: any) => (
                    <div key={e.id} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-1.5 sm:gap-3 text-sm p-3.5 rounded-xl sm:items-center border" style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }}>
                      <div>
                        <span className="font-bold">{e.label}</span>
                        <span className="block text-[11px] text-ink-3">{new Date(e.at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</span>
                      </div>
                      <span className="flex justify-between sm:block sm:text-right font-mono">
                        <span className="sm:hidden text-[10px] font-bold uppercase text-ink-3">Debit</span>
                        <span style={{ color: e.debitPaise ? 'var(--clay)' : 'var(--ink-3)' }}>{e.debitPaise ? formatINR(e.debitPaise) : '—'}</span>
                      </span>
                      <span className="flex justify-between sm:block sm:text-right font-mono">
                        <span className="sm:hidden text-[10px] font-bold uppercase text-ink-3">Credit</span>
                        <span style={{ color: e.creditPaise ? 'var(--cardamom-d)' : 'var(--ink-3)' }}>{e.creditPaise ? formatINR(e.creditPaise) : '—'}</span>
                      </span>
                      <span className="flex justify-between sm:block sm:text-right font-mono font-bold">
                        <span className="sm:hidden text-[10px] font-bold uppercase text-ink-3">Balance</span>
                        <span>{formatINR(e.balancePaise)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => setStatement(null)} className="btn btn-dark w-full mt-4">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* live-floor table orders modal — every running order on the tapped table */}
      {tableOrders && (
        <div onClick={() => setTableOrders(null)} className="fixed inset-0 z-[8500] grid place-items-center p-5" style={{ background: 'rgba(30,18,10,.5)', backdropFilter: 'blur(6px)' }}>
          <div onClick={(e) => e.stopPropagation()} className="w-[min(560px,100%)] max-h-[88vh] overflow-auto" style={{ background: 'var(--paper-2)', borderRadius: 24, boxShadow: 'var(--sh-3)', border: '1px solid var(--line)' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--line)' }}>
              <div>
                <h3 className="text-lg font-bold">Table {tableOrders.label}</h3>
                <span className="text-xs text-ink-3">
                  {tableOrdersLoading ? 'Loading…' : `${tableOrders.data?.count ?? 0} running order${(tableOrders.data?.count ?? 0) === 1 ? '' : 's'}`}
                </span>
              </div>
              <button onClick={() => setTableOrders(null)} className="btn btn-dark py-1.5 px-3 text-xs">Close</button>
            </div>
            <div className="p-5">
              {tableOrdersLoading ? (
                <TeaLoader label="Loading orders…" size={44} />
              ) : !tableOrders.data || (tableOrders.data.orders?.length ?? 0) === 0 ? (
                <p className="text-sm text-ink-3">No running orders on this table.</p>
              ) : (
                <>
                  {tableOrders.data.orders.map((ord: any) => {
                    const lines = (tableOrders.data.lines ?? []).filter((l: any) => l.orderId === ord.id);
                    return (
                      <div key={ord.id} className="mb-3 last:mb-0 rounded-xl p-3" style={{ background: 'var(--paper-3)' }}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-sm">Order #{ord.number}</span>
                          <span className="pill text-[9px] uppercase">{ord.status}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          {lines.length === 0 ? (
                            <span className="text-xs text-ink-3">No active items.</span>
                          ) : lines.map((l: any) => (
                            <div key={l.id} className="flex justify-between text-sm">
                              <span><b className="mr-1.5" style={{ color: 'var(--turmeric-d)' }}>{l.qty}×</b>{l.name}{l.station ? <span className="text-[10px] text-ink-3 ml-1.5 uppercase">{l.station}</span> : null}</span>
                              <span className="tnum" style={{ fontFamily: 'var(--font-mono)' }}>{formatINR(l.linePaise)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <div className="grid gap-1 text-sm border-t pt-3 mt-1" style={{ borderColor: 'var(--line)' }}>
                    <Line label="Subtotal" val={formatINR(tableOrders.data.totals?.subtotalPaise ?? 0)} />
                    {(tableOrders.data.totals?.taxPaise ?? 0) > 0 && <Line label="Tax" val={formatINR(tableOrders.data.totals.taxPaise)} />}
                    <div className="flex justify-between font-extrabold font-display text-lg mt-1 pt-2 border-t" style={{ borderColor: 'var(--line)' }}>
                      <span>Total</span><span className="tnum" style={{ fontFamily: 'var(--font-mono)' }}>{formatINR(tableOrders.data.totals?.totalPaise ?? 0)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* order detail modal — full bill, printable */}
      {orderDetail && (
        <div onClick={() => setOrderDetail(null)} className="fixed inset-0 z-[8500] grid place-items-center p-5" style={{ background: 'rgba(30,18,10,.5)', backdropFilter: 'blur(6px)' }}>
          <div onClick={(e) => e.stopPropagation()} className="w-[min(560px,100%)] max-h-[88vh] overflow-auto" style={{ background: 'var(--paper-2)', borderRadius: 24, boxShadow: 'var(--sh-3)', border: '1px solid var(--line)' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--line)' }}>
              <div>
                <h3 className="text-lg font-bold">Order #{orderDetail.number}</h3>
                <span className="text-xs text-ink-3">
                  {orderDetail.table?.label ? `Table ${orderDetail.table.label}` : orderDetail.type} · {new Date(orderDetail.placedAt).toLocaleString('en-IN')}
                </span>
              </div>
              <span className="pill text-[10px] uppercase">{orderDetail.status}</span>
            </div>
            <div className="p-5">
              <div className="flex flex-col gap-1.5 border-b pb-3 mb-3" style={{ borderColor: 'var(--line)' }}>
                {orderDetail.items.map((i: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span><b className="mr-1.5" style={{ color: 'var(--turmeric-d)' }}>{i.qty}×</b>{i.nameSnapshot}{i.station ? <span className="text-[10px] text-ink-3 ml-1.5 uppercase">{i.station}</span> : null}</span>
                    <span className="tnum" style={{ fontFamily: 'var(--font-mono)' }}>{formatINR(i.unitPricePaise * i.qty)}</span>
                  </div>
                ))}
              </div>
              <div className="grid gap-1 text-sm">
                <Line label="Subtotal" val={formatINR(orderDetail.subtotalPaise)} />
                {orderDetail.discountPaise > 0 && <Line label="Discount" val={`− ${formatINR(orderDetail.discountPaise)}`} />}
                {orderDetail.cgstPaise > 0 && <Line label="CGST" val={formatINR(orderDetail.cgstPaise)} />}
                {orderDetail.sgstPaise > 0 && <Line label="SGST" val={formatINR(orderDetail.sgstPaise)} />}
                {orderDetail.igstPaise > 0 && <Line label="IGST" val={formatINR(orderDetail.igstPaise)} />}
                {orderDetail.serviceChargePaise > 0 && <Line label="Service charge" val={formatINR(orderDetail.serviceChargePaise)} />}
                <Line label="Round off" val={formatINR(orderDetail.roundOffPaise)} />
                <div className="flex justify-between font-extrabold font-display text-lg mt-1 pt-2 border-t" style={{ borderColor: 'var(--line)' }}>
                  <span>Total</span><span className="tnum" style={{ fontFamily: 'var(--font-mono)' }}>{formatINR(orderDetail.totalPaise)}</span>
                </div>
              </div>
              {editingDiscount ? (
                <div className="mt-4 p-4 rounded-xl border grid gap-3" style={{ background: 'var(--paper-3)', borderColor: 'var(--line-2)' }}>
                  <h4 className="font-bold text-sm">Apply Discount</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-ink-3 block mb-1">Discount %</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={editDiscountPct}
                        onChange={(e) => {
                          setEditDiscountPct(e.target.value);
                          setEditDiscountFlat('0');
                        }}
                        className="w-full p-2 rounded-xl border text-sm outline-none"
                        style={{ background: 'var(--paper-2)', borderColor: 'var(--line-2)' }}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-ink-3 block mb-1">Flat (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={editDiscountFlat}
                        onChange={(e) => {
                          setEditDiscountFlat(e.target.value);
                          setEditDiscountPct('0');
                        }}
                        className="w-full p-2 rounded-xl border text-sm outline-none"
                        style={{ background: 'var(--paper-2)', borderColor: 'var(--line-2)' }}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setEditingDiscount(false)} className="btn btn-dark py-1.5 px-3 text-xs">Cancel</button>
                    <button onClick={handleSaveDiscount} className="btn btn-primary py-1.5 px-3 text-xs">Save</button>
                  </div>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2 mt-5">
                <button onClick={() => printOrderBill(orderDetail)} className="btn btn-primary flex-1 min-w-[100px]">🖨 Print bill</button>
                <button onClick={() => printOrderKOT(orderDetail)} className="btn flex-1 min-w-[100px]" style={{ background: 'var(--paper-3)', border: '1px solid var(--line)' }}>🧾 Print KOT</button>
                <button onClick={() => { setEditingDiscount(true); setEditDiscountPct('0'); setEditDiscountFlat('0'); }} className="btn flex-1 min-w-[100px]" style={{ background: 'var(--paper-3)', border: '1px solid var(--line)' }}>✏️ Discount</button>
                <button onClick={() => { setOrderDetail(null); setEditingDiscount(false); }} className="btn btn-dark flex-1 min-w-[80px]">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Custom Invoice modal */}
      {quickInvoiceOpen && (
        <div onClick={() => setQuickInvoiceOpen(false)} className="fixed inset-0 z-[8500] grid place-items-center p-5" style={{ background: 'rgba(30,18,10,.5)', backdropFilter: 'blur(6px)' }}>
          <div onClick={(e) => e.stopPropagation()} className="w-[min(680px,100%)] max-h-[88vh] flex flex-col" style={{ background: 'var(--paper-2)', borderRadius: 24, boxShadow: 'var(--sh-3)', border: '1px solid var(--line)' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: 'var(--line)' }}>
              <div>
                <h3 className="text-lg font-bold">Quick Custom Bill</h3>
                <span className="text-xs text-ink-3">Print a bill directly without creating a POS ticket</span>
              </div>
              <button onClick={() => setQuickInvoiceOpen(false)} className="text-sm font-bold text-ink-3 hover:text-ink">Close</button>
            </div>
            
            <div className="p-5 overflow-auto flex-1 space-y-4">
              {/* Customer details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-ink-3 block mb-1">Customer Name (Optional)</label>
                  <input type="text" value={quickInvoiceCustName} onChange={(e) => setQuickInvoiceCustName(e.target.value)} placeholder="e.g. Walk-in Guest" className="inp" />
                </div>
                <div>
                  <label className="text-xs text-ink-3 block mb-1">Customer Phone (Optional)</label>
                  <input type="tel" value={quickInvoiceCustPhone} onChange={(e) => setQuickInvoiceCustPhone(e.target.value)} placeholder="e.g. 9876543210" className="inp" />
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-ink-3 block uppercase tracking-wider">Bill Items</span>
                {quickInvoiceLines.map((line, idx) => {
                  return (
                    <div key={line.key} className="flex flex-wrap items-center gap-2 p-3 rounded-xl border relative" style={{ background: 'var(--paper-3)', borderColor: 'var(--line-2)' }}>
                      {/* Source selector */}
                      <div className="w-[110px]">
                        <select value={line.source} onChange={(e) => {
                          const src = e.target.value as 'inventory' | 'custom';
                          setQuickInvoiceLines(prev => prev.map(l => l.key === line.key ? { ...l, source: src, itemId: '', name: '', price: '', gst: 5 } : l));
                        }} className="inp inp-compact" aria-label="Item Source">
                          <option value="custom">✍ Custom</option>
                          <option value="inventory">☕ From Menu</option>
                        </select>
                      </div>

                      {/* Item Selector / Name Input */}
                      <div className="flex-grow min-w-[150px]">
                        {line.source === 'inventory' ? (
                          <select value={line.itemId} onChange={(e) => {
                            const id = e.target.value;
                            const item = menuItems.find(it => it.id === id);
                            setQuickInvoiceLines(prev => prev.map(l => l.key === line.key ? {
                              ...l,
                              itemId: id,
                              name: item ? item.name : '',
                              price: item ? String(item.pricePaise / 100) : '',
                              gst: item ? Number(item.gstRate) : 5
                            } : l));
                          }} className="inp inp-compact" aria-label="Select Menu Item" required>
                            <option value="">-- Select Menu Item --</option>
                            {menuItems.map(it => <option key={it.id} value={it.id}>{it.name} (₹{it.pricePaise / 100})</option>)}
                          </select>
                        ) : (
                          <input type="text" value={line.name} onChange={(e) => {
                            const val = e.target.value;
                            setQuickInvoiceLines(prev => prev.map(l => l.key === line.key ? { ...l, name: val } : l));
                          }} placeholder="Item name" className="inp inp-compact" aria-label="Item Name" required />
                        )}
                      </div>

                      {/* Price Input */}
                      <div className="w-[80px]">
                        <input type="number" step="0.01" value={line.price} onChange={(e) => {
                          const val = e.target.value;
                          setQuickInvoiceLines(prev => prev.map(l => l.key === line.key ? { ...l, price: val } : l));
                        }} placeholder="₹ Price" className="inp inp-compact text-right font-mono" aria-label="Price" required />
                      </div>

                      {/* Qty Input */}
                      <div className="w-[60px]">
                        <input type="number" min="1" value={line.qty} onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value) || 1);
                          setQuickInvoiceLines(prev => prev.map(l => l.key === line.key ? { ...l, qty: val } : l));
                        }} className="inp inp-compact text-center font-mono" aria-label="Quantity" required />
                      </div>

                      {/* GST Selection */}
                      <div className="w-[70px]">
                        <select value={line.gst} onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setQuickInvoiceLines(prev => prev.map(l => l.key === line.key ? { ...l, gst: val } : l));
                        }} className="inp inp-compact" aria-label="GST Rate">
                          {[0, 5, 12, 18, 28].map(g => <option key={g} value={g}>{g}%</option>)}
                        </select>
                      </div>

                      {/* Delete button */}
                      <button type="button" onClick={() => {
                        setQuickInvoiceLines(prev => prev.filter(l => l.key !== line.key));
                      }} className="w-8 h-8 grid place-items-center text-red-500 hover:bg-red-50 rounded-lg" aria-label="Delete line">
                        🗑
                      </button>
                    </div>
                  );
                })}

                <button type="button" onClick={() => {
                  setQuickInvoiceLines(prev => [...prev, { key: Math.random().toString(), itemId: '', name: '', price: '', qty: 1, gst: 5, source: 'custom' }]);
                }} className="btn border border-dashed py-2 w-full text-xs font-bold transition hover:bg-[var(--paper-3)]" style={{ borderColor: 'var(--line)' }}>
                  ＋ Add New Line
                </button>
              </div>

              {/* Totals Section */}
              {quickInvoiceLines.length > 0 && (() => {
                const totals = computeQuickInvoiceTotals();
                return (
                  <div className="border-t pt-3 mt-4 text-sm space-y-1.5" style={{ borderColor: 'var(--line)' }}>
                    <div className="flex justify-between text-ink-3">
                      <span>Subtotal</span>
                      <span className="font-mono">{formatINR(totals.subtotalPaise)}</span>
                    </div>
                    {totals.cgstPaise > 0 && (
                      <div className="flex justify-between text-ink-3">
                        <span>CGST</span>
                        <span className="font-mono">{formatINR(totals.cgstPaise)}</span>
                      </div>
                    )}
                    {totals.sgstPaise > 0 && (
                      <div className="flex justify-between text-ink-3">
                        <span>SGST</span>
                        <span className="font-mono">{formatINR(totals.sgstPaise)}</span>
                      </div>
                    )}
                    {totals.roundOffPaise !== 0 && (
                      <div className="flex justify-between text-ink-3">
                        <span>Round-off</span>
                        <span className="font-mono">{totals.roundOffPaise >= 0 ? '+' : ''}{formatINR(totals.roundOffPaise)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-extrabold text-lg border-t pt-2 mt-1" style={{ borderColor: 'var(--line)' }}>
                      <span>Total</span>
                      <span className="font-mono">{formatINR(totals.totalPaise)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="p-5 border-t shrink-0 flex gap-2" style={{ borderColor: 'var(--line)' }}>
              <button onClick={handlePrintQuickBill} className="btn btn-primary flex-1">🖨 Print Bill</button>
              <button onClick={handlePrintQuickKOT} className="btn flex-1" style={{ background: 'var(--paper-3)', border: '1px solid var(--line)' }}>🧾 Print KOT</button>
              <button onClick={() => setQuickInvoiceOpen(false)} className="btn btn-dark w-24">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div role="status" aria-live="polite" className="anim-slide-in fixed left-1/2 -translate-x-1/2 bottom-[calc(76px_+_env(safe-area-inset-bottom))] lg:bottom-7 z-[9000] px-5 py-3 rounded-full font-bold text-sm shadow-3" style={{ background: 'var(--ink)', color: 'var(--paper-2)' }}>
          {toast}
        </div>
      )}

      {/* Mobile navigation — slide-out drawer (full menu) + bottom nav (key actions) */}
      {showPos && (
        <div className="fixed inset-0 z-[9500] flex flex-col" style={{ background: 'var(--paper)', color: 'var(--ink)' }}>
          {/* Header bar */}
          <div className="flex items-center justify-between px-5 py-3 border-b shrink-0" style={{ borderColor: 'var(--line)', background: 'var(--paper-2)' }}>
            <div className="flex items-center gap-2.5">
              <span className="grid place-items-center rounded-xl shrink-0" style={{ width: 34, height: 34, background: 'var(--paper-3)', color: 'var(--turmeric)' }}>
                <Store size={18} aria-hidden />
              </span>
              <div>
                <h2 className="font-display text-sm font-bold leading-tight">POS Terminal</h2>
                <p className="text-[10px]" style={{ color: 'var(--ink-3)' }}>{outlet.name} · {staff.name}</p>
              </div>
            </div>
            <button
              onClick={() => setShowPos(false)}
              className="btn btn-sm btn-ghost flex items-center gap-1.5 px-3 py-1.5 font-bold cursor-pointer"
              style={{ color: 'var(--ink-2)' }}
            >
              <X size={16} aria-hidden />
              <span>Exit POS</span>
            </button>
          </div>
          {/* Iframe */}
          <div className="flex-1 relative overflow-hidden bg-background">
            <iframe
              src="/pos"
              className="absolute inset-0 w-full h-full border-none"
              title="POS Terminal"
            />
          </div>
        </div>
      )}

      {showKds && (
        <div className="fixed inset-0 z-[9500] flex flex-col" style={{ background: 'var(--paper)', color: 'var(--ink)' }}>
          {/* Header bar */}
          <div className="flex items-center justify-between px-5 py-3 border-b shrink-0" style={{ borderColor: 'var(--line)', background: 'var(--paper-2)' }}>
            <div className="flex items-center gap-2.5">
              <span className="grid place-items-center rounded-xl shrink-0" style={{ width: 34, height: 34, background: 'var(--paper-3)', color: 'var(--turmeric)' }}>
                <ChefHat size={18} aria-hidden />
              </span>
              <div>
                <h2 className="font-display text-sm font-bold leading-tight">Kitchen Display System</h2>
                <p className="text-[10px]" style={{ color: 'var(--ink-3)' }}>{outlet.name} · {staff.name}</p>
              </div>
            </div>
            <button
              onClick={() => setShowKds(false)}
              className="btn btn-sm btn-ghost flex items-center gap-1.5 px-3 py-1.5 font-bold cursor-pointer"
              style={{ color: 'var(--ink-2)' }}
            >
              <X size={16} aria-hidden />
              <span>Exit KDS</span>
            </button>
          </div>
          {/* Iframe */}
          <div className="flex-1 relative overflow-hidden bg-background">
            <iframe
              src="/kds"
              className="absolute inset-0 w-full h-full border-none"
              title="Kitchen Display System"
            />
          </div>
        </div>
      )}

      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        items={visibleMenus as NavItem[]}
        activeKey={activeMenu}
        onSelect={(k) => { setActiveMenu(k); setLiveOrders(0); }}
        plan={outlet.plan}
        onLogout={logout}
        staffRole={staff.role}
      />
      <BottomNav
        items={visibleBottomNav as NavItem[]}
        activeKey={activeMenu}
        onSelect={(k) => { setActiveMenu(k); setLiveOrders(0); }}
        onMore={() => setDrawerOpen(true)}
        drawerOpen={drawerOpen}
        liveOrders={liveOrders}
      />

      {/* Viewport tooltip for collapsed sidebar */}
      {hoveredItem && (
        <div
          className="fixed z-[9999] px-2.5 py-1.5 text-xs font-bold rounded-lg shadow-md pointer-events-none whitespace-nowrap"
          style={{
            top: hoveredItem.top,
            left: hoveredItem.right + 8,
            transform: 'translateY(-50%)',
            background: 'var(--espresso)',
            color: 'var(--paper)',
            boxShadow: 'var(--sh-2)',
            border: '1px solid var(--line)',
          }}
        >
          {hoveredItem.label}
        </div>
      )}
    </div>
  );
}

function Line({ label, val }: { label: string; val: string }) {
  return (
    <div className="flex justify-between py-0.5" style={{ color: 'var(--ink-2)' }}>
      <span>{label}</span><span className="tnum" style={{ fontFamily: 'var(--font-mono)' }}>{val}</span>
    </div>
  );
}

function KpiCard({ label, value, n, format, tone, index = 0 }: { label: string; value?: string; n?: number; format?: (x: number) => string; tone?: 'cardamom' | 'gold'; index?: number }) {
  const color = tone === 'cardamom' ? 'var(--cardamom-d)' : tone === 'gold' ? 'var(--gold)' : undefined;
  return (
    <motion.section
      className="card card-glow p-4"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.25, 0.8, 0.25, 1], delay: index * 0.08 }}
      whileHover={{ y: -3 }}
    >
      <span className="block text-xs mb-2 text-ink-3">{label}</span>
      <span className="block text-2xl md:text-3xl font-bold tnum font-mono" style={{ color }}>
        {n !== undefined ? <CountUp value={n} format={format ?? ((x) => x.toLocaleString('en-IN'))} /> : value}
      </span>
    </motion.section>
  );
}

// quick-prompt chips per language
const PROMPTS: Record<'en' | 'ml', string[]> = {
  en: ['Why up today?', 'Promote tonight?', 'Who to win back?', 'Busiest hours?'],
  ml: ['ഇന്നത്തെ വിൽപ്പന?', 'എന്ത് പ്രമോട്ട് ചെയ്യണം?', 'ആരെ തിരികെ കൊണ്ടുവരണം?', 'തിരക്കുള്ള സമയം?'],
};

function Assistant() {
  const [msgs, setMsgs] = useState<Msg[]>([
    { who: 'ai', html: 'Ask me anything — “why are sales down?”, “what to promote?” · മലയാളത്തിലും ചോദിക്കാം 🎙️' },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [uiLang, setUiLang] = useState<'en' | 'ml'>('en'); // drives quick chips + mic locale
  const [speakOn, setSpeakOn] = useState(true); // read replies aloud
  const [listening, setListening] = useState(false);
  const [voiceOk, setVoiceOk] = useState(false); // speech-recognition support (set client-side)
  const scroll = useRef<HTMLDivElement>(null);
  const recRef = useRef<any>(null);

  useEffect(() => {
    scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, busy]);

  // feature-detect the Web Speech API on the client (avoids SSR hydration mismatch)
  useEffect(() => {
    setVoiceOk(typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window));
    return () => { try { window.speechSynthesis?.cancel(); } catch {} };
  }, []);

  // read an AI reply aloud in the language the server answered in
  function speak(html: string, lang: 'en' | 'ml') {
    if (!speakOn || typeof window === 'undefined' || !window.speechSynthesis) return;
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'ml' ? 'ml-IN' : 'en-IN';
    const match = window.speechSynthesis.getVoices().find((v) => v.lang === u.lang);
    if (match) u.voice = match;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }

  async function ask(q: string) {
    if (!q.trim() || busy) return;
    setMsgs((m) => [...m, { who: 'me', html: q }]);
    setInput('');
    setBusy(true);
    try {
      const res = await fetch('/api/dashboard/assistant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ q }),
      });
      const data = await res.json().catch(() => ({}));
      // Surface the real reason instead of a generic "couldn't read that" — the
      // gate (402) and auth (401/403) return an `error`, not a `reply`.
      if (!res.ok) {
        const html =
          res.status === 402
            ? 'The <b>AI Sales Assistant</b> isn’t included in your current plan. <span class="msg-act">Upgrade to Pro to switch it on.</span>'
            : res.status === 401 || res.status === 403
              ? 'You don’t have access to the assistant — sign in as an owner or manager.'
              : 'The assistant is unavailable right now — please try again in a moment.';
        setMsgs((m) => [...m, { who: 'ai', html }]);
        return;
      }
      const { reply, lang } = data;
      const safe = reply ?? 'Sorry, I couldn’t read that.';
      setMsgs((m) => [...m, { who: 'ai', html: safe }]);
      speak(safe, lang === 'ml' ? 'ml' : 'en');
    } catch {
      setMsgs((m) => [...m, { who: 'ai', html: 'Network hiccup — try again in a moment.' }]);
    } finally {
      setBusy(false);
    }
  }

  // mic: dictate the question (Malayalam or English per the language toggle)
  function toggleMic() {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (listening) { recRef.current?.stop(); return; }
    const rec = new SR();
    rec.lang = uiLang === 'ml' ? 'ml-IN' : 'en-IN';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      const said = e.results?.[0]?.[0]?.transcript ?? '';
      if (said) ask(said);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    try { rec.start(); } catch { setListening(false); }
  }

  return (
    <section className="card col-span-2 p-5 flex flex-col" style={{ minHeight: 320 }}>
      <div className="flex items-center justify-between mb-3">
        <span className="font-bold text-xs" style={{ color: 'var(--berry)' }}>🤖 Sales Assistant</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setUiLang((l) => (l === 'en' ? 'ml' : 'en'))}
            className="text-[10px] font-bold px-2 py-1 rounded-full"
            style={{ background: 'var(--paper-3)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}
            title="Question language for the mic"
          >{uiLang === 'en' ? 'EN' : 'മ'}</button>
          <button
            onClick={() => { setSpeakOn((s) => { if (s) window.speechSynthesis?.cancel(); return !s; }); }}
            className="text-[12px] px-2 py-1 rounded-full"
            style={{ background: speakOn ? 'color-mix(in srgb, var(--berry) 16%, var(--paper-3))' : 'var(--paper-3)', border: '1px solid var(--line)' }}
            title={speakOn ? 'Voice replies on' : 'Voice replies off'}
          >{speakOn ? '🔊' : '🔇'}</button>
        </div>
      </div>

      <div ref={scroll} className="flex-1 overflow-y-auto flex flex-col gap-2.5 mb-3 pr-1" style={{ maxHeight: 220 }}>
        {msgs.map((m, i) => (
          <div
            key={i}
            className="text-sm px-3 py-2 rounded-2xl max-w-[88%]"
            style={m.who === 'me'
              ? { alignSelf: 'flex-end', background: 'var(--turmeric)', color: '#2A1607', fontWeight: 600 }
              : { alignSelf: 'flex-start', background: 'var(--paper-3)', color: 'var(--ink-2)', border: '1px solid var(--line)' }}
            dangerouslySetInnerHTML={{ __html: m.html }}
          />
        ))}
        {busy && (
          <div className="text-sm px-3 py-2.5 rounded-2xl self-start flex gap-1" style={{ background: 'var(--paper-3)', border: '1px solid var(--line)' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--ink-3)' }} />
            <span className="w-1.5 h-1.5 rounded-full animate-bounce delay-150" style={{ background: 'var(--ink-3)' }} />
            <span className="w-1.5 h-1.5 rounded-full animate-bounce delay-300" style={{ background: 'var(--ink-3)' }} />
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-2.5">
        {PROMPTS[uiLang].map((q) => (
          <button key={q} onClick={() => ask(q)} disabled={busy} className="pill text-xs disabled:opacity-50 hover:-translate-y-0.5 transition">{q}</button>
        ))}
      </div>

      <div className="flex gap-2">
        {voiceOk && (
          <button
            onClick={toggleMic}
            disabled={busy}
            className="btn"
            style={{ padding: '0 14px', background: listening ? 'var(--clay)' : 'var(--paper-3)', color: listening ? '#fff' : 'var(--ink)', border: '1px solid var(--line-2)' }}
            title={listening ? 'Listening… tap to stop' : `Speak (${uiLang === 'ml' ? 'മലയാളം' : 'English'})`}
          >{listening ? '⏺' : '🎙️'}</button>
        )}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ask(input)}
          placeholder={uiLang === 'ml' ? 'ചോദിക്കൂ…' : 'Ask the assistant…'}
          className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none"
          style={{ background: 'var(--paper-3)', border: '1px solid var(--line-2)', color: 'var(--ink)' }}
        />
        <button onClick={() => ask(input)} disabled={busy || !input.trim()} className="btn btn-dark" style={{ padding: '0 16px' }}>↑</button>
      </div>
    </section>
  );
}

/* ============================ Settings primitives ============================ */
/* Reuse the app's global form classes (.inp/.lbl/.help) so every settings panel
   looks identical. PWA_INPUT is kept as an alias so existing call-sites upgrade. */
const PWA_INPUT = 'inp';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="lbl">{label}</label>
      {children}
      {hint && <p className="help">{hint}</p>}
    </div>
  );
}

/** One toggle for the whole app: label + optional description + animated switch. */
function Toggle({ label, desc, on, onChange, disabled }: { label: string; desc?: string; on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)} className="flex items-center justify-between gap-3 p-3 rounded-xl border w-full text-left disabled:opacity-50" style={{ borderColor: 'var(--line)', background: 'var(--paper-3)' }}>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        {desc && <span className="block text-xs" style={{ color: 'var(--ink-3)' }}>{desc}</span>}
      </span>
      <span className="relative shrink-0 rounded-full transition-colors" style={{ width: 44, height: 26, background: on ? 'var(--cardamom)' : 'var(--line-2)' }}>
        <span className="absolute top-[3px] rounded-full bg-white transition-all" style={{ width: 20, height: 20, left: on ? 21 : 3, boxShadow: 'var(--sh-1)' }} />
      </span>
    </button>
  );
}

/** Standard settings card: header (title + subtitle), body, optional footer (save row). */
function SettingsSection({ title, desc, children, footer, className = '' }: { title: string; desc?: string; children: React.ReactNode; footer?: React.ReactNode; className?: string }) {
  return (
    <section className={`card p-5 flex flex-col gap-4 ${className}`}>
      <div>
        <h4 className="font-bold">{title}</h4>
        {desc && <p className="text-xs text-ink-3">{desc}</p>}
      </div>
      {children}
      {footer && <div className="flex flex-wrap items-center gap-2 pt-1">{footer}</div>}
    </section>
  );
}

/** Consistent save affordance with a busy spinner. */
function SaveButton({ busy, onClick, children = 'Save changes' }: { busy: boolean; onClick: () => void; children?: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={busy} className="btn btn-primary w-fit disabled:opacity-50">
      {busy ? (<><span className="inline-block w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />Saving…</>) : children}
    </button>
  );
}

/* Grouped sub-navigation for the PWA settings panel (keys map to pwaTab values). */
const PWA_NAV: { group: string; items: [string, string][] }[] = [
  { group: 'Home & Appearance', items: [['theme', 'Theme'], ['home', 'Home Layout'], ['featured', 'Featured Dishes'], ['banners', 'Banners']] },
  { group: 'Access & Ordering', items: [['registration', 'Customer Login'], ['table', 'QR Table']] },
  { group: 'Rewards & Games', items: [['points', 'Reward Points'], ['wallet', 'Wallet'], ['loyalty', 'Loyalty Tiers'], ['gamification', 'Games']] },
];

function PwaFeaturedForm({ items, busy, uploadImage, onAdd }: {
  items: { id: string; name: string; pricePaise: number; categoryName: string | null }[];
  busy: boolean;
  uploadImage: (f: File) => Promise<string | null>;
  onAdd: (dish: { itemId: string; label: string | null; priority: number; imageUrl: string | null }) => Promise<boolean>;
}) {
  const [itemId, setItemId] = useState('');
  const [label, setLabel] = useState<string>('best_seller');
  const [priority, setPriority] = useState('0');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-end gap-3 p-3 rounded-xl border" style={{ background: 'var(--paper-2)', borderColor: 'var(--line)' }}>
      <Field label="Dish">
        <select value={itemId} onChange={(e) => setItemId(e.target.value)} className="inp min-w-[180px]">
          <option value="">Select a dish…</option>
          {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
      </Field>
      <Field label="Label">
        <select value={label} onChange={(e) => setLabel(e.target.value)} className="inp">
          {FEATURED_LABELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
      </Field>
      <Field label="Priority"><input type="number" value={priority} onChange={(e) => setPriority(e.target.value)} className="inp w-24" /></Field>
      <Field label="Image override (optional)">
        <div className="flex items-center gap-2">
          {imageUrl && <img src={imageUrl} alt="" className="rounded object-cover" style={{ width: 40, height: 40 }} />}
          <label className="btn btn-sm cursor-pointer">
            {imageUrl ? 'Replace image' : 'Choose image'}
            <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setImageUrl(await uploadImage(f)); }} />
          </label>
        </div>
      </Field>
      <button
        disabled={busy || !itemId}
        onClick={async () => { if (await onAdd({ itemId, label, priority: Number(priority) || 0, imageUrl })) { setItemId(''); setImageUrl(null); } }}
        className="btn btn-primary py-2.5 px-4 text-sm disabled:opacity-50"
      >+ Add featured</button>
    </div>
  );
}

function PwaBannerForm({ busy, uploadImage, onAdd }: {
  busy: boolean;
  uploadImage: (f: File) => Promise<string | null>;
  onAdd: (banner: { imageUrl: string; title: string; link: string | null; startAt: string | null; endAt: string | null; order: number }) => Promise<boolean>;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [order, setOrder] = useState('0');
  return (
    <div className="grid sm:grid-cols-2 gap-3 p-3 rounded-xl border" style={{ background: 'var(--paper-2)', borderColor: 'var(--line)' }}>
      <Field label="Poster image">
        <div className="flex items-center gap-2">
          {imageUrl && <img src={imageUrl} alt="" className="rounded object-cover" style={{ width: 56, height: 34 }} />}
          <label className="btn btn-sm cursor-pointer">
            {imageUrl ? 'Replace image' : 'Choose image'}
            <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setImageUrl(await uploadImage(f)); }} />
          </label>
        </div>
      </Field>
      <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Buy 2 Get 1 Free" className={PWA_INPUT} /></Field>
      <Field label="Link (optional)"><input value={link} onChange={(e) => setLink(e.target.value)} placeholder="/app or https://…" className={PWA_INPUT} /></Field>
      <Field label="Display order"><input type="number" value={order} onChange={(e) => setOrder(e.target.value)} className={PWA_INPUT} /></Field>
      <Field label="Start date (optional)"><input type="date" value={startAt} onChange={(e) => setStartAt(e.target.value)} className={PWA_INPUT} /></Field>
      <Field label="End date (optional)"><input type="date" value={endAt} onChange={(e) => setEndAt(e.target.value)} className={PWA_INPUT} /></Field>
      <div className="sm:col-span-2">
        <button
          disabled={busy || !imageUrl}
          onClick={async () => { if (imageUrl && (await onAdd({ imageUrl, title, link: link || null, startAt: startAt || null, endAt: endAt || null, order: Number(order) || 0 }))) { setImageUrl(null); setTitle(''); setLink(''); setStartAt(''); setEndAt(''); } }}
          className="btn btn-primary py-2.5 px-4 text-sm disabled:opacity-50"
        >+ Add banner</button>
      </div>
    </div>
  );
}
