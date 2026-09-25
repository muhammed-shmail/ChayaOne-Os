'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { computeBill, formatINR, type BillLine } from '@cafeos/core';
import { STAGES, posStageOf } from '@/lib/orderStatus';
import type { Floor } from '@/lib/floors';
import type { ReceiptConfig } from '@/lib/receipt';
import type { KitchenWorkflowConfig } from '@/lib/kitchenWorkflow';
import { ThemeToggle } from '@/components/ui';
import {
  Table2, ClipboardList, LayoutDashboard, RefreshCw, Coffee,
  Plus, Minus, X, Printer, Receipt, Smartphone, Banknote, CreditCard,
  CupSoda, UtensilsCrossed, Croissant, Cake, Soup, User, QrCode,
  ShoppingCart, ChevronUp, Menu, Search, Download, LogOut, type LucideIcon,
  ArrowLeftRight, ArrowRight, CircleAlert, FileText, Edit3,
} from 'lucide-react';
import { ShiftStatus } from '@/components/ShiftStatus';
import { ServerSyncCard } from '@/components/ServerSyncCard';
import { BusinessDayPrompt, BusinessDayHeaderBadge } from '@/components/BusinessDayPrompt';
import StaffBell from '@/components/StaffBell';
import LicenseStatusBadge from '@/components/license/LicenseStatusBadge';
import { subscribeStaff } from '@/lib/realtime-client';
import { useStaffInstall } from '@/components/staff-install';
import { isOffline, OFFLINE_ORDER_MSG, OFFLINE_PAY_MSG } from '@/components/online';
import { getGeoHeaders } from '@/lib/geo-client';

import { generateAuthoritativeUpiUri } from '@/lib/print/upi';
import { generateQrDataUrl } from '@/lib/print/qr';
import { hasRole, hasPermission, canAccess, canSettle } from '@/lib/rbac';

/** Category → SVG icon (replaces structural emoji; food glyph stays decorative). */
const CAT_ICON: Record<string, LucideIcon> = {
  Coffee, 'Chai & Tea': Soup, Coolers: CupSoda, 'All-Day': UtensilsCrossed, Bakery: Croissant, Desserts: Cake,
};
const PAY_ICON: Record<'cash' | 'upi' | 'card', LucideIcon> = { cash: Banknote, upi: Smartphone, card: CreditCard };

export type MenuItemDto = {
  id: string;
  name: string;
  pricePaise: number;
  gstRate: number;
  station: string | null; // kitchen slug — configurable per outlet (Outlet.settings.kitchens)
  tags: string[];
  hsnCode?: string | null;
};
export type MenuCategory = { id: string; name: string; items: MenuItemDto[] };
export type TableDto = { id: string; label: string; seats: number; state: string; floorId: string | null };
type Outlet = {
  id: string;
  name: string;
  gstin: string | null;
  stateCode: string;
  gstEnabled: boolean;
  gstRate: number | null;
  gstInclusive: boolean;
  address?: any;
  timezone?: string;
  receipt: ReceiptConfig;
  kitchenWorkflow: KitchenWorkflowConfig;
  gstConfig?: any;
  upiConfig?: any;
};
type Staff = {
  id: string;
  name: string;
  role: string;
  roles?: string[];
  permissions?: any;
  effectivePermissions?: string[];
};

type Line = {
  key: string;
  itemId: string;
  name: string;
  pricePaise: number;
  gstRate: number;
  station: MenuItemDto['station'];
  qty: number;
  notes?: string;
};

/** an order this POS has fired, tracked live as the kitchen works it */
type LiveTicket = { id: string; number: number; where: string; status: string; placedAt: number };

const EMOJI: Record<string, string> = {
  Coffee: '☕', 'Chai & Tea': '🍵', Coolers: '🥤', 'All-Day': '🍳', Bakery: '🥐', Desserts: '🍰',
};

/** Floor-map status by order workflow stage (Free → Order → KOT → Ready → Served). */
const TABLE_STAGES = {
  free: { label: 'Free', color: 'var(--ink-3)' },
  order: { label: 'Order', color: '#3B82F6' },   // order taken, not yet sent
  kot: { label: 'KOT', color: '#E8A22B' },        // sent to kitchen / preparing
  ready: { label: 'Ready', color: '#34C759' },    // ready to serve
  served: { label: 'Served', color: '#14B8A6' },  // served, awaiting bill
} as const;
type TableStage = keyof typeof TABLE_STAGES;
const TABLE_STAGE_ORDER: TableStage[] = ['free', 'order', 'kot', 'ready', 'served'];

function tableStage(status?: string): TableStage {
  if (!status) return 'free';
  if (status === 'in_kitchen') return 'kot';
  if (status === 'ready') return 'ready';
  if (status === 'served') return 'served';
  return 'order'; // open / pending_approval / approved
}

function generateClientUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {}
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function PosClient({ outlet, staff, menu, tables, floors, staffAppEnabled = false, locationGate = false }: { outlet: Outlet; staff: Staff; menu: MenuCategory[]; tables: TableDto[]; floors: Floor[]; staffAppEnabled?: boolean; locationGate?: boolean }) {
  const [currentStaff, setCurrentStaff] = useState<Staff>(staff);
  useEffect(() => {
    setCurrentStaff(staff);
  }, [staff]);

  const [activeCat, setActiveCat] = useState(menu[0]?.id ?? '');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<Line[]>([]);
  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway'>('dine_in');
  const [tableId, setTableId] = useState<string | null>(null);
  const [discountPct, setDiscountPct] = useState(0);
  const [discountFlatPaise, setDiscountFlatPaise] = useState(0);
  const [scPct, setScPct] = useState(0);
  const [floorOpen, setFloorOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [floorFilter, setFloorFilter] = useState<string>('all'); // 'all' | floorId | 'unassigned'
  const [charging, setCharging] = useState(false);
  // when Send/Charge is tapped with no table, we open the floor map and remember the
  // intent here, then resume it (below) the moment a table is picked
  const [pendingAction, setPendingAction] = useState<null | 'kot' | 'charge'>(null);
  // mobile-only chrome: bottom-sheet cart + "More" drawer (phones; hidden at md+)
  const [cartSheetOpen, setCartSheetOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [live, setLive] = useState<LiveTicket[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [occupied, setOccupied] = useState<Record<string, { number: number; sinceMs: number; billPaise: number; orders: number; status: string }>>({});

  // Item custom notes per product (e.g. without sugar, less spicy, extra hot)
  const [editingNoteKey, setEditingNoteKey] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const QUICK_ITEM_NOTES = ['Without sugar', 'Less sugar', 'Extra hot', 'Less ice', 'No ice', 'Strong tea', 'Parcel'];

  function openNoteEdit(line: Line) {
    setEditingNoteKey(line.key);
    setNoteDraft(line.notes || '');
  }
  function saveNote(key: string) {
    setCart((c) => c.map((l) => (l.key === key ? { ...l, notes: noteDraft.trim() || undefined } : l)));
    setEditingNoteKey(null);
    setNoteDraft('');
  }
  function removeNote(key: string) {
    setCart((c) => c.map((l) => (l.key === key ? { ...l, notes: undefined } : l)));
    if (editingNoteKey === key) {
      setEditingNoteKey(null);
      setNoteDraft('');
    }
  }

  const handleDashboardClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (typeof window !== 'undefined' && window.parent !== window) {
      e.preventDefault();
      window.parent.postMessage({ type: 'close-pos' }, '*');
    }
  };

  // 1s clock so the live-order stage colours age (New → Preparing) on their own
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // mobile overlays (cart sheet / More drawer): lock background scroll + ESC to close
  useEffect(() => {
    if (!cartSheetOpen && !moreOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setCartSheetOpen(false); setMoreOpen(false); } };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [cartSheetOpen, moreOpen]);

  // live table occupancy (occupied until the bill is settled)
  const refreshTables = () => fetch('/api/tables').then((r) => (r.ok ? r.json() : null)).then((d) => { if (d?.occupied) setOccupied(d.occupied); }).catch(() => { });
  useEffect(() => { refreshTables(); }, []);
  useEffect(() => { if (floorOpen) { refreshTables(); setFloorFilter('all'); } }, [floorOpen]);

  // ---- table actions (open / settle / print) for an occupied table ----
  const [tableAction, setTableAction] = useState<{ id: string; label: string } | null>(null);
  const [tableOrder, setTableOrder] = useState<any>(null);
  const [settleBusy, setSettleBusy] = useState(false);
  const [askSettle, setAskSettle] = useState(false);
  const [billPrinted, setBillPrinted] = useState(false);
  const [printedOrderIds, setPrintedOrderIds] = useState<Set<string>>(new Set());
  const canSettleBill = canSettle(currentStaff);
  const canPrintBill = canSettleBill || hasRole(currentStaff, ['owner', 'manager', 'cashier', 'waiter']);
  // "Install the Staff App" entry — only when the cafe has the Staff App (PWA) offer
  // and the device can actually install (Android prompt ready, or iOS manual hint).
  const staffInstall = useStaffInstall();
  const showInstallApp = staffAppEnabled && staffInstall.available;

  // T-Billing modal
  const [showTBilling, setShowTBilling] = useState(false);
  const [tBillingMounted, setTBillingMounted] = useState(false);
  const [tBillingLoaded, setTBillingLoaded] = useState(false);
  const tBillingIframeRef = useRef<HTMLIFrameElement>(null);

  // Order-level customer field visibility (desktop right rail + mobile cart sheet)
  const [showOrderCust, setShowOrderCust] = useState(false);

  // Listen for close-t-billing message from embedded T-Billing iframe
  useEffect(() => {
    const handleMsg = (e: MessageEvent) => {
      if (e.data && e.data.type === 'close-t-billing') {
        setShowTBilling(false);
      }
    };
    window.addEventListener('message', handleMsg);
    return () => window.removeEventListener('message', handleMsg);
  }, []);

  useEffect(() => {
    if (!showTBilling) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowTBilling(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showTBilling]);

  // Mount state for hydration-safe rendering of PWA install buttons
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Derived counts
  const cartCount = cart.reduce((s, l) => s + l.qty, 0);

  // ---- inline "add items" + per-line void, inside the table popup ----
  const [addMode, setAddMode] = useState(false);
  const [tableCart, setTableCart] = useState<Line[]>([]);
  const [addSearch, setAddSearch] = useState('');
  const [sendBusy, setSendBusy] = useState(false);
  const [voidBusyId, setVoidBusyId] = useState<string | null>(null);

  // ---- optional customer on the table's bill (defaults to "Customer" when blank) ----
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [showCust, setShowCust] = useState(false);
  const billCustomer = custName.trim() || 'Customer';
  function resetCustomer() { setCustName(''); setCustPhone(''); setShowCust(false); }

  // ---- optional customer attached to the current POS ticket (Send to KOT or Charge) ----
  // separate from the table-settle customer above; the server find-or-creates the CRM
  const [orderCustName, setOrderCustName] = useState('');
  const [orderCustPhone, setOrderCustPhone] = useState('');

  // ---- Table Transfer System ----
  const [transferMode, setTransferMode] = useState(false);
  const [selectedDestTable, setSelectedDestTable] = useState<TableDto | null>(null);
  const [transferFloorFilter, setTransferFloorFilter] = useState<string>('all');
  const [transferReason, setTransferReason] = useState('');
  const [transferBusy, setTransferBusy] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState<{
    orderNumber: number;
    fromLabel: string;
    toLabel: string;
  } | null>(null);
  const [transferOccupiedError, setTransferOccupiedError] = useState<string | null>(null);

  function closeTableActions() {
    setTableAction(null); setTableOrder(null); setAddMode(false); setTableCart([]); setAddSearch(''); resetCustomer();
    setTransferMode(false); setSelectedDestTable(null); setTransferReason(''); setTransferSuccess(null); setTransferOccupiedError(null);
    setBillPrinted(false);
  }

  async function openTableActions(t: TableDto, startInTransfer = false) {
    setPendingAction(null); // tapping an occupied table diverts to its running order, not the new ticket
    setTableAction({ id: t.id, label: t.label });
    setTableOrder(null);
    setAskSettle(false);
    setBillPrinted(false);
    setAddMode(false); setTableCart([]); setAddSearch(''); resetCustomer();
    setTransferMode(startInTransfer); setSelectedDestTable(null); setTransferReason(''); setTransferSuccess(null); setTransferOccupiedError(null);
    const d = await fetch(`/api/tables/order?tableId=${t.id}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    setTableOrder(d);
    const isAlreadyPrinted = Boolean(d?.billPrinted) || (d?.orders && d.orders.some((o: any) => printedOrderIds.has(o.id)));
    if (isAlreadyPrinted) setBillPrinted(true);
  }

  async function executeTableTransfer() {
    if (!tableAction || !selectedDestTable) return;
    if (isOffline()) { flash(OFFLINE_ORDER_MSG); return; }
    setTransferBusy(true);
    try {
      const r = await fetch('/api/tables/transfer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fromTableId: tableAction.id,
          toTableId: selectedDestTable.id,
          reason: transferReason.trim() || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        if (d.error === 'destination_occupied') {
          setTransferOccupiedError(d.message || `Table ${selectedDestTable.label} is already occupied.`);
        } else {
          flash(d.message || 'Could not transfer table');
        }
        return;
      }
      const num = d.orderNumber || (tableOrder?.orders?.[0]?.number ?? 0);
      const fromL = tableAction.label;
      const toL = selectedDestTable.label;
      setTransferSuccess({ orderNumber: num, fromLabel: fromL, toLabel: toL });
      flash(`✓ Order #${num} transferred: Table ${fromL} → Table ${toL}`);
      refreshTables();
      setTimeout(() => {
        closeTableActions();
      }, 1600);
    } catch {
      flash('Network error during transfer');
    } finally {
      setTransferBusy(false);
    }
  }

  // refetch the open table's running order without resetting the add panel
  async function refreshTableOrder() {
    if (!tableAction) return null;
    const d = await fetch(`/api/tables/order?tableId=${tableAction.id}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    setTableOrder(d);
    return d;
  }

  // Sync listener: refresh tables & running order on sync events
  useEffect(() => {
    const handleSync = () => {
      refreshTables();
      if (tableAction) refreshTableOrder();
    };
    window.addEventListener('pos-sync-now', handleSync);
    return () => window.removeEventListener('pos-sync-now', handleSync);
  }, [tableAction]);

  // mini-cart helpers (kept separate from the main till `cart`)
  function addToTable(item: MenuItemDto) {
    setTableCart((c) => {
      const ex = c.find((l) => l.itemId === item.id);
      if (ex) return c.map((l) => (l.itemId === item.id ? { ...l, qty: l.qty + 1 } : l));
      return [...c, { key: item.id, itemId: item.id, name: item.name, pricePaise: item.pricePaise, gstRate: item.gstRate, station: item.station, qty: 1 }];
    });
  }
  function bumpTable(key: string, d: number) {
    setTableCart((c) => c.flatMap((l) => (l.key === key ? (l.qty + d <= 0 ? [] : [{ ...l, qty: l.qty + d }]) : [l])));
  }

  async function sendTableCart() {
    if (!tableAction || tableCart.length === 0) return;
    if (isOffline()) { flash(OFFLINE_ORDER_MSG); return; }
    setSendBusy(true);
    try {
      const body = {
        clientUuid: generateClientUuid(),
        outletId: outlet.id,
        staffId: staff.id,
        type: 'dine_in' as const,
        tableId: tableAction.id,
        ...(custName.trim() || custPhone.trim() ? { customer: { name: custName.trim(), phone: custPhone.trim() } } : {}),
        lines: tableCart.map((l) => ({ itemId: l.itemId, nameSnapshot: l.name, qty: l.qty, unitPricePaise: l.pricePaise, gstRate: l.gstRate, station: l.station, modifiers: [] })),
        discountPct: 0,
        serviceChargePct: 0,
        interState: false,
      };
      const geo = locationGate ? await getGeoHeaders() : {};
      const r = await fetch('/api/orders', { method: 'POST', headers: { 'content-type': 'application/json', ...geo }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) {
        flash(d?.message || (d?.error === 'out_of_range' ? 'Too far from the cafe to send this order' : 'Cannot reach Main PC — check Wi-Fi (disable 5G)'));
        return;
      }
      flash(`KOT #${d.order.number} sent to kitchen`);
      setTableCart([]); setAddMode(false); setAddSearch('');
      await refreshTableOrder(); refreshTables();
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('pos-entry-sync'));
    } catch { flash('Cannot reach Main PC — check Wi-Fi (disable 5G)'); }
    finally { setSendBusy(false); }
  }

  async function voidLine(l: { id: string; orderId: string; name: string }) {
    if (isOffline()) { flash(OFFLINE_ORDER_MSG); return; }
    if (!window.confirm(`Remove “${l.name}” from this table? Stock will be restored.`)) return;
    setVoidBusyId(l.id);
    try {
      const r = await fetch('/api/tables/order', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'void_item', orderId: l.orderId, itemId: l.id }) });
      const d = await r.json();
      if (r.ok) {
        flash(d.cancelled ? 'Item removed · order cancelled' : 'Item removed');
        const fresh = await refreshTableOrder();
        refreshTables();
        if (!fresh || fresh.count === 0) closeTableActions(); // table is now empty
      } else flash('Could not remove item');
    } catch { flash('Network error'); }
    finally { setVoidBusyId(null); }
  }

  async function settleTable(method: 'cash' | 'upi' | 'card') {
    if (!tableAction) return;
    if (isOffline()) { flash(OFFLINE_PAY_MSG); return; }
    setSettleBusy(true);
    try {
      const r = await fetch('/api/tables/order', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'settle',
          tableId: tableAction.id,
          method,
          // walk-in from the table panel → server creates/links the CRM customer
          ...(custName.trim() || custPhone.trim() ? { customer: { name: custName.trim(), phone: custPhone.trim() } } : {}),
        }),
      });
      const d = await r.json();
      if (r.ok) {
        flash(`Settled ${formatINR(d.totalPaise)} · ${billCustomer} · ${method.toUpperCase()}`);
        closeTableActions();
        refreshTables();
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('pos-entry-sync'));
      }
      else flash('Could not settle table');
    } catch { flash('Network error'); } finally { setSettleBusy(false); }
  }

  // ─── PRINT JOB DEDUPLICATION GUARD ───────────────────────────────────────
  // Prevents double-print from double-click, slow response, re-render, etc.
  const activePrintJobs = useRef<Set<string>>(new Set());

  function generatePrintJobId(type: string, ref: string): string {
    return `${type}:${ref}:${Date.now()}`;
  }

  // ─── 80mm THERMAL PRINT ENGINE ───────────────────────────────────────────
  // Uses a hidden iframe (not a popup) so clicking "Print bill" goes directly
  // to the Windows Print dialog — no intermediate popup step.
  function printThermal80mm(title: string, htmlBody: string, jobId?: string): void {
    const jid = jobId || generatePrintJobId('thermal', title);

    // Deduplication: block if same job is already in flight
    if (activePrintJobs.current.has(jid)) {
      console.warn(`[PRINT] Duplicate print blocked — Job ID: ${jid}`);
      return;
    }
    activePrintJobs.current.add(jid);

    console.log(`[PRINT] ── Job START ──`);
    console.log(`[PRINT] Job ID   : ${jid}`);
    console.log(`[PRINT] Title    : ${title}`);
    console.log(`[PRINT] Printer  : ${outlet.receipt?.paperWidth || '80mm'} thermal (Windows dialog)`);
    console.log(`[PRINT] Method   : hidden-iframe → window.print()`);
    console.log(`[PRINT] Timestamp: ${new Date().toISOString()}`);

    // Build the complete print document
    // 80mm roll: ~72mm printable at 203dpi ≈ 574px at 96dpi screen preview
    // We use 72mm with left/right 4mm margins each for the print media.
    const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"/>
<title>${title}</title>
<style>
  /* ─── 80mm thermal receipt optimised for TVSE RP3200 Lite ─── */
  @page {
    size: 80mm auto;
    margin: 3mm 4mm;
  }
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body {
    width: 72mm;
    font-family: 'Courier New', Courier, 'Lucida Console', monospace;
    font-size: 11pt;
    line-height: 1.35;
    color: #000;
    background: #fff;
  }
  .receipt {
    width: 100%;
    padding: 0;
  }
  /* ── Typography hierarchy ── */
  .store-name {
    text-align: center;
    font-size: 15pt;
    font-weight: 900;
    letter-spacing: 1px;
    text-transform: uppercase;
    line-height: 1.2;
    margin-bottom: 2pt;
  }
  .store-sub {
    text-align: center;
    font-size: 9pt;
    color: #222;
    line-height: 1.3;
    margin-bottom: 1pt;
  }
  .doc-title {
    text-align: center;
    font-size: 10pt;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin: 3pt 0 2pt;
  }
  /* ── Dividers ── */
  .div-solid  { border-top: 1.5px solid #000; margin: 3pt 0; }
  .div-dashed { border-top: 1px dashed #000; margin: 3pt 0; }
  /* ── Meta rows (table / date / cashier) ── */
  .meta-row {
    display: flex;
    justify-content: space-between;
    font-size: 9pt;
    line-height: 1.3;
  }
  .meta-row.bold { font-weight: 700; font-size: 9.5pt; }
  /* ── Items table ── */
  .items-hdr {
    display: flex;
    font-size: 9pt;
    font-weight: 700;
    text-transform: uppercase;
    padding-bottom: 2pt;
  }
  .col-name   { flex: 1; }
  .col-qty    { width: 22pt; text-align: center; }
  .col-rate   { width: 30pt; text-align: right; }
  .col-amt    { width: 36pt; text-align: right; }
  .item-row {
    display: flex;
    font-size: 10pt;
    line-height: 1.35;
    padding: 1pt 0;
    align-items: flex-start;
  }
  .item-name  { flex: 1; word-break: break-word; }
  .item-note  { font-size: 8.5pt; color: #333; padding-left: 6pt; }
  /* ── Totals ── */
  .totals-row {
    display: flex;
    justify-content: space-between;
    font-size: 10pt;
    line-height: 1.4;
  }
  .totals-row.grand {
    font-size: 13pt;
    font-weight: 900;
    margin: 2pt 0;
  }
  .totals-row.discount { color: #1a7a1a; }
  /* ── Payment info ── */
  .pay-row {
    display: flex;
    justify-content: space-between;
    font-size: 10pt;
    line-height: 1.4;
  }
  .pay-row.change { font-weight: 700; }
  /* ── Footer ── */
  .footer {
    text-align: center;
    font-size: 9pt;
    color: #333;
    margin-top: 4pt;
    line-height: 1.4;
  }
  .footer .thank-you {
    font-size: 11pt;
    font-weight: 700;
    color: #000;
    margin-bottom: 2pt;
  }
  /* ── Watermarks ── */
  .watermark {
    text-align: center;
    font-size: 10pt;
    font-weight: 700;
    letter-spacing: 1px;
    border: 1.5px solid #000;
    padding: 2pt 4pt;
    margin-bottom: 3pt;
  }
  /* ── Logo ── */
  .logo-wrap { text-align: center; margin-bottom: 3pt; }
  .logo-wrap img { max-height: 14mm; max-width: 40mm; object-fit: contain; }
  /* Screen preview only — not printed */
  @media screen {
    body { background: #f5f5f5; padding: 8px; }
    .receipt { background: #fff; padding: 8px; box-shadow: 0 0 12px rgba(0,0,0,0.15); }
  }
</style>
</head><body>
<div class="receipt">
${htmlBody}
</div>
<script>
  window.onload = function() {
    window.print();
  };
<\/script>
</body></html>`;

    // Use a hidden iframe instead of a popup window.
    // This avoids the browser's pop-up blocker AND removes the intermediate
    // "window opened" step — clicking Print Bill goes straight to the OS
    // print dialog (same as the user's configured TVSE RP3200 Lite).
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;opacity:0;pointer-events:none;';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      console.error(`[PRINT ERROR] Could not access iframe document. Job ID: ${jid}`);
      flash('Print failed — could not open print frame');
      activePrintJobs.current.delete(jid);
      document.body.removeChild(iframe);
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    // Wait for iframe content to load, then trigger the system print dialog
    const iframeWin = iframe.contentWindow;
    const doCleanup = () => {
      activePrintJobs.current.delete(jid);
      try { document.body.removeChild(iframe); } catch {}
    };

    if (iframeWin) {
      const timer = setTimeout(() => {
        try {
          console.log(`[PRINT] Opening Windows print dialog for Job ID: ${jid}`);
          iframeWin.focus();
          iframeWin.print();
          console.log(`[PRINT] Print dialog launched — Job ID: ${jid}`);
        } catch (err: any) {
          console.error(`[PRINT ERROR] Job ID: ${jid} — Error: ${err?.message || err}`);
          flash('Print failed — please try again');
        } finally {
          setTimeout(doCleanup, 2000);
        }
      }, 350);

      iframeWin.onbeforeunload = () => {
        clearTimeout(timer);
        doCleanup();
      };
    } else {
      console.error(`[PRINT ERROR] iframe contentWindow unavailable — Job ID: ${jid}`);
      flash('Print failed — please try again');
      doCleanup();
    }
  }

  // ─── HTML ESCAPE (safe for receipt text) ─────────────────────────────────
  const escRcpt = (s: string) => s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] as string));

  // ─── 80mm RECEIPT HEADER SECTION ─────────────────────────────────────────
  function receiptHeaderHtml() {
    const r = outlet.receipt;
    const isGst = outlet.gstEnabled && outlet.gstConfig?.enabled;
    const docTitle = isGst ? (outlet.gstConfig?.taxInvoiceTitle || 'TAX INVOICE') : 'INVOICE';
    const storeName = escRcpt((outlet.name.split('—')[0] ?? outlet.name).trim().toUpperCase());
    const addressRaw = outlet.address;
    let addressLine = '';
    if (r.showAddress && addressRaw) {
      if (typeof addressRaw === 'string') addressLine = escRcpt(addressRaw.trim());
      else if (typeof addressRaw === 'object') {
        const parts = [addressRaw.line1, addressRaw.city, addressRaw.pincode].filter(Boolean).map(escRcpt);
        addressLine = parts.join(', ');
      }
    }
    const parts: string[] = [];
    if (r.showLogo && r.logoUrl) {
      parts.push(`<div class="logo-wrap"><img src="${r.logoUrl}" alt="logo" /></div>`);
    }
    parts.push(`<div class="store-name">${storeName}</div>`);
    if (addressLine) parts.push(`<div class="store-sub">${addressLine}</div>`);
    if (r.showPhone && r.phone.trim()) parts.push(`<div class="store-sub">Tel: ${escRcpt(r.phone)}</div>`);
    if (outlet.gstEnabled && outlet.gstConfig?.enabled && outlet.gstConfig?.showGstin && outlet.gstin) {
      parts.push(`<div class="store-sub">GSTIN: ${escRcpt(outlet.gstin)}</div>`);
    }
    if (r.header.trim()) parts.push(`<div class="store-sub">${escRcpt(r.header).replace(/\n/g, '<br/>')}</div>`);
    parts.push(`<div class="doc-title">${docTitle}</div>`);
    return parts.join('\n');
  }

  const receiptFooterText = () => {
    if (outlet.gstEnabled && outlet.gstConfig?.enabled && outlet.gstConfig?.receiptFooter) {
      return escRcpt(outlet.gstConfig.receiptFooter).replace(/\n/g, ' · ');
    }
    return outlet.receipt.footer.trim() ? escRcpt(outlet.receipt.footer).replace(/\n/g, ' · ') : 'Thank you! Visit Again';
  };

  function taxSummaryTableHtml(billObj: any) {
    if (!outlet.gstEnabled || !outlet.gstConfig?.enabled || !outlet.gstConfig?.showTaxSummary) return '';
    const summaryMap = new Map<number, { taxable: number; cgst: number; sgst: number; igst: number; hsnCodes: Set<string> }>();
    for (const line of billObj.lines) {
      const rate = line.gstRate ?? 0;
      const existing = summaryMap.get(rate) || { taxable: 0, cgst: 0, sgst: 0, igst: 0, hsnCodes: new Set<string>() };
      existing.taxable += line.taxableValuePaise ?? 0;
      existing.cgst += line.cgstPaise ?? 0;
      existing.sgst += line.sgstPaise ?? 0;
      existing.igst += line.igstPaise ?? 0;
      if (line.hsnCode) existing.hsnCodes.add(line.hsnCode);
      summaryMap.set(rate, existing);
    }
    if (summaryMap.size === 0) return '';
    const hasInterstate = Array.from(summaryMap.values()).some(v => v.igst > 0);
    const rows = Array.from(summaryMap.entries()).map(([rate, val]) => {
      const hsnStr = Array.from(val.hsnCodes).join(', ') || '—';
      return `
        <tr style="border-bottom:1px dotted #ccc; font-size:10px;">
          <td>${rate}%</td>
          <td>${hsnStr}</td>
          <td class="r">${formatINR(val.taxable)}</td>
          ${hasInterstate
          ? `<td class="r" colspan="2">${formatINR(val.igst)}</td>`
          : `<td class="r">${formatINR(val.cgst)}</td><td class="r">${formatINR(val.sgst)}</td>`
        }
        </tr>
      `;
    }).join('');

    return `
      <div class="line"></div>
      <div style="font-size:10px; font-weight:bold; text-align:center; margin-bottom:4px; letter-spacing:0.5px;">GST TAX SUMMARY</div>
      <table style="width:100%; border-collapse:collapse; font-size:9px; margin-bottom:8px;">
        <thead>
          <tr style="border-bottom:1px dashed #000; font-weight:bold;">
            <th align="left">Rate</th>
            <th align="left">HSN</th>
            <th class="r">Taxable V.</th>
            ${hasInterstate
        ? `<th class="r" colspan="2">IGST</th>`
        : `<th class="r">CGST</th><th class="r">SGST</th>`
      }
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  function printBill() {
    if (!tableOrder || billPrinted) return;
    const isGstConfig = outlet.gstEnabled && outlet.gstConfig?.enabled;
    const showHsn = isGstConfig && outlet.gstConfig?.showHsn;
    const tableLabel = tableAction?.label ?? '';
    const orderNum = tableOrder.number || tableOrder.orderNumber || '';
    const jobId = `bill:table${tableLabel}:order${orderNum}`;

    console.log(`[PRINT] ── Print Bill ──`);
    console.log(`[PRINT] Bill ID  : ${jobId}`);
    console.log(`[PRINT] Table    : ${tableLabel}`);
    console.log(`[PRINT] Order #  : ${orderNum}`);
    console.log(`[PRINT] Cashier  : ${currentStaff.name}`);
    console.log(`[PRINT] Items    : ${tableOrder.lines?.length || 0}`);
    console.log(`[PRINT] Total    : ${formatINR(tableOrder.totals?.totalPaise || 0)}`);

    // Build item rows with proper 80mm column alignment
    const now80 = new Date();
    const dateStr = now80.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now80.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const itemRowsHtml = tableOrder.lines.map((l: any) => {
      const dbItem = menu.flatMap(c => c.items).find(it => it.id === l.itemId || it.name === l.name);
      const unitPrice = l.unitPricePaise ?? l.pricePaise ?? 0;
      const lineTotal = l.linePaise ?? l.totalPaise ?? 0;
      const hsnText = showHsn && dbItem?.hsnCode
        ? `<div class="item-note">HSN: ${escRcpt(dbItem.hsnCode)}</div>` : '';
      const noteText = l.notes
        ? `<div class="item-note">Note: ${escRcpt(l.notes)}</div>` : '';
      return `<div class="item-row">
        <div class="col-name item-name">${escRcpt(l.name)}${noteText}${hsnText}</div>
        <div class="col-qty">${l.qty}</div>
        <div class="col-rate">${formatINR(unitPrice)}</div>
        <div class="col-amt">${formatINR(lineTotal)}</div>
      </div>`;
    }).join('');

    const totals = tableOrder.totals;
    const orderTypeLabel = (tableOrder.type || 'DINE IN').toUpperCase().replace('_', ' ');
    const custLine = billCustomer !== 'Customer' ? escRcpt(billCustomer) : '';
    const custPhoneLine = custPhone.trim() ? escRcpt(custPhone.trim()) : '';

    const htmlBody = `
${receiptHeaderHtml()}
<div class="div-dashed"></div>
<div class="meta-row bold"><span>Table ${escRcpt(tableLabel)}</span><span>${orderTypeLabel}</span></div>
${orderNum ? `<div class="meta-row"><span>Bill #${escRcpt(String(orderNum))}</span><span>${dateStr}</span></div>` : `<div class="meta-row"><span>${dateStr}</span><span></span></div>`}
<div class="meta-row"><span>Cashier: ${escRcpt(currentStaff.name)}</span><span>${timeStr}</span></div>
${custLine ? `<div class="meta-row"><span>Customer: ${custLine}${custPhoneLine ? ` · ${custPhoneLine}` : ''}</span></div>` : ''}
<div class="div-solid"></div>
<div class="items-hdr">
  <div class="col-name">ITEM</div>
  <div class="col-qty">QTY</div>
  <div class="col-rate">RATE</div>
  <div class="col-amt">AMT</div>
</div>
<div class="div-dashed"></div>
${itemRowsHtml}
<div class="div-solid"></div>
<div class="totals-row"><span>Subtotal</span><span>${formatINR(totals.subtotalPaise)}</span></div>
${totals.discountPaise > 0 ? `<div class="totals-row discount"><span>Discount</span><span>-${formatINR(totals.discountPaise)}</span></div>` : ''}
${isGstConfig && outlet.gstConfig?.showCgst && totals.cgstPaise > 0 ? `<div class="totals-row"><span>CGST</span><span>${formatINR(totals.cgstPaise)}</span></div>` : ''}
${isGstConfig && outlet.gstConfig?.showSgst && totals.sgstPaise > 0 ? `<div class="totals-row"><span>SGST</span><span>${formatINR(totals.sgstPaise)}</span></div>` : ''}
${isGstConfig && outlet.gstConfig?.showIgst && totals.igstPaise > 0 ? `<div class="totals-row"><span>IGST</span><span>${formatINR(totals.igstPaise)}</span></div>` : ''}
${totals.serviceChargePaise > 0 ? `<div class="totals-row"><span>Service Charge</span><span>${formatINR(totals.serviceChargePaise)}</span></div>` : ''}
${Math.abs(totals.roundOffPaise || 0) > 0 ? `<div class="totals-row"><span>Round Off</span><span>${totals.roundOffPaise >= 0 ? '+' : '-'}${formatINR(Math.abs(totals.roundOffPaise))}</span></div>` : ''}
${taxSummaryTableHtml(tableOrder)}
<div class="div-solid"></div>
<div class="totals-row grand"><span>TOTAL</span><span>${formatINR(totals.totalPaise)}</span></div>
<div class="div-solid"></div>
<div class="footer">
  <div class="thank-you">${receiptFooterText()}</div>
  <div>Served by ${escRcpt(currentStaff.name)}</div>
</div>`;

    const waiterStation = (currentStaff.permissions as any)?.station || (currentStaff as any)?.station || null;
    console.log(`[PRINT] Sending bill directly to ${waiterStation ? waiterStation.toUpperCase() + ' station printer' : 'station printer'} (no popup)...`);

    // 1. Immediately disable button and record printed locally
    setBillPrinted(true);
    const tableId = tableAction?.id;
    const orderIds = (tableOrder?.orders || []).map((o: any) => o.id).concat(tableOrder?.id ? [tableOrder.id] : []);
    if (orderIds.length > 0) {
      setPrintedOrderIds((prev) => {
        const next = new Set(prev);
        orderIds.forEach((id: string) => next.add(id));
        return next;
      });
    }

    // 2. Immediately free table in local state so floor map updates with zero latency
    if (tableId) {
      setOccupied((prev) => {
        const next = { ...prev };
        delete next[tableId];
        return next;
      });
    }

    // 3. Mark table as free on server & dispatch station direct print (no browser popup)
    if (tableId) {
      fetch('/api/tables/order', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'print_bill',
          tableId,
          orderId: orderIds[0] || null,
          waiterStation,
          staffName: currentStaff.name,
        }),
      })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (data.printerName) {
            flash(`🖨️ Bill sent directly to ${data.printerName} (${(data.station || waiterStation || '').toUpperCase()})`);
          } else {
            flash('✓ Bill printed through station printer');
          }
          refreshTables();
        })
        .catch((err) => console.error('[PRINT] Server free table / bill print failed:', err));
    }

    // 4. Smoothly close modal after user sees confirmation
    setTimeout(() => closeTableActions(), 1000);
  }

  function printKOT() {
    if (!tableOrder) return;
    const tableLabel = tableAction?.label ?? '';
    const orderNum = tableOrder.number || tableOrder.orderNumber || '';
    const when = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const rows = tableOrder.lines.map((l: any) =>
      `<div class="item-row"><div class="col-qty" style="width:24pt;font-weight:700;">${l.qty}x</div><div class="col-name item-name" style="flex:1;font-size:12pt;font-weight:700;">${escRcpt(l.name)}${l.notes ? `<div class="item-note" style="font-size:9pt;">Note: ${escRcpt(l.notes)}</div>` : ''}${l.station ? `<div class="item-note" style="font-size:8.5pt;">[${escRcpt(l.station)}]</div>` : ''}</div></div>`
    ).join('');
    const htmlBody = `
<div class="store-name">KOT</div>
<div class="doc-title">KITCHEN ORDER TICKET</div>
<div class="div-solid"></div>
<div class="meta-row bold"><span>Table ${escRcpt(tableLabel)}</span><span>#${escRcpt(String(orderNum))}</span></div>
<div class="meta-row"><span>${when}</span><span>${escRcpt(currentStaff.name)}</span></div>
<div class="div-solid"></div>
${rows}
<div class="div-dashed"></div>
<div class="footer"><div>** End of Order **</div></div>`;
    printThermal80mm(`KOT - Table ${tableLabel}`, htmlBody);
  }

  // Auto-printed KOT for a just-sent POS order (Printed / Hybrid workflow). Reads
  // the current cart, so call it before clear(). Prints kotCopies copies in one
  // document, page-broken so each copy tears off separately.
  function printKotFromCart(number: number, whereLabel: string) {
    const copies = Math.max(1, Math.min(4, outlet.kitchenWorkflow.kotCopies || 1));
    const when = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const rows = cart.map((l) =>
      `<div class="item-row"><div class="col-qty" style="width:24pt;font-weight:700;">${l.qty}x</div><div class="col-name item-name" style="flex:1;font-size:12pt;font-weight:700;">${escRcpt(l.name)}${l.notes ? `<div class="item-note" style="font-size:9pt;">Note: ${escRcpt(l.notes)}</div>` : ''}${l.station ? `<div class="item-note" style="font-size:8.5pt;">[${escRcpt(l.station)}]</div>` : ''}</div></div>`
    ).join('');

    const oneKot = `
<div class="store-name">KOT #${number}</div>
<div class="doc-title">KITCHEN ORDER TICKET</div>
<div class="div-solid"></div>
<div class="meta-row bold"><span>${escRcpt(whereLabel)}</span><span>${when}</span></div>
<div class="meta-row"><span>By: ${escRcpt(currentStaff.name)}</span></div>
<div class="div-solid"></div>
${rows}
<div class="div-dashed"></div>
<div class="footer"><div>** End of Order **</div></div>`;

    const fullBody = Array.from({ length: copies }, (_, i) =>
      i === 0 ? oneKot : `<div style="page-break-before:always;"></div>${oneKot}`
    ).join('');

    printThermal80mm(`KOT #${number}`, fullBody);
  }

  // ─── PRINT RECEIPT (post-payment, for a just-charged POS order) ──────────
  function printReceipt(number: number, method: string, tipPaise: number, customer: { name: string; phone: string } | null) {
    const isGstConfig = outlet.gstEnabled && outlet.gstConfig?.enabled;
    const showHsn = isGstConfig && outlet.gstConfig?.showHsn;
    const totalWithTip = bill.totalPaise + tipPaise;
    const jobId = `receipt:${number}:${Date.now()}`;

    console.log(`[PRINT] ── Print Receipt ──`);
    console.log(`[PRINT] Receipt #: ${number}`);
    console.log(`[PRINT] Job ID   : ${jobId}`);
    console.log(`[PRINT] Method   : ${method.toUpperCase()}`);
    console.log(`[PRINT] Total    : ${formatINR(totalWithTip)}`);
    console.log(`[PRINT] Cashier  : ${currentStaff.name}`);

    const now80 = new Date();
    const dateStr = now80.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now80.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const itemRowsHtml = cart.map((l) => {
      const dbItem = menu.flatMap(c => c.items).find(it => it.id === l.itemId);
      const lineTotal = l.pricePaise * l.qty;
      const hsnText = showHsn && dbItem?.hsnCode
        ? `<div class="item-note">HSN: ${escRcpt(dbItem.hsnCode)}</div>` : '';
      const noteText = l.notes
        ? `<div class="item-note">Note: ${escRcpt(l.notes)}</div>` : '';
      return `<div class="item-row">
        <div class="col-name item-name">${escRcpt(l.name)}${noteText}${hsnText}</div>
        <div class="col-qty">${l.qty}</div>
        <div class="col-rate">${formatINR(l.pricePaise)}</div>
        <div class="col-amt">${formatINR(lineTotal)}</div>
      </div>`;
    }).join('');

    const custName = customer?.name?.trim() || '';
    const custPhoneStr = customer?.phone?.trim() || '';
    const subtotalLabel = outlet.gstEnabled && outlet.gstInclusive ? 'Taxable Value' : 'Subtotal';

    const htmlBody = `
${receiptHeaderHtml()}
<div class="div-dashed"></div>
<div class="meta-row bold"><span>Receipt #${number}</span><span>${dateStr}</span></div>
<div class="meta-row"><span>Cashier: ${escRcpt(currentStaff.name)}</span><span>${timeStr}</span></div>
${custName || custPhoneStr ? `<div class="meta-row"><span>Customer: ${escRcpt(custName)}${custPhoneStr ? ` · ${escRcpt(custPhoneStr)}` : ''}</span></div>` : ''}
<div class="div-solid"></div>
<div class="items-hdr">
  <div class="col-name">ITEM</div>
  <div class="col-qty">QTY</div>
  <div class="col-rate">RATE</div>
  <div class="col-amt">AMT</div>
</div>
<div class="div-dashed"></div>
${itemRowsHtml}
<div class="div-solid"></div>
<div class="totals-row"><span>${subtotalLabel}</span><span>${formatINR(bill.subtotalPaise)}</span></div>
${bill.discountPaise > 0 ? `<div class="totals-row discount"><span>Discount${discountPct > 0 ? ` (${discountPct}%)` : ''}</span><span>-${formatINR(bill.discountPaise)}</span></div>` : ''}
${isGstConfig && outlet.gstConfig?.showCgst && bill.cgstPaise > 0 ? `<div class="totals-row"><span>CGST</span><span>${formatINR(bill.cgstPaise)}</span></div>` : ''}
${isGstConfig && outlet.gstConfig?.showSgst && bill.sgstPaise > 0 ? `<div class="totals-row"><span>SGST</span><span>${formatINR(bill.sgstPaise)}</span></div>` : ''}
${isGstConfig && outlet.gstConfig?.showIgst && bill.igstPaise > 0 ? `<div class="totals-row"><span>IGST</span><span>${formatINR(bill.igstPaise)}</span></div>` : ''}
${scPct > 0 ? `<div class="totals-row"><span>Service Charge</span><span>${formatINR(bill.serviceChargePaise)}</span></div>` : ''}
${bill.deliveryChargePaise > 0 ? `<div class="totals-row"><span>Delivery Charge</span><span>${formatINR(bill.deliveryChargePaise)}</span></div>` : ''}
${bill.packagingChargePaise > 0 ? `<div class="totals-row"><span>Packaging Charge</span><span>${formatINR(bill.packagingChargePaise)}</span></div>` : ''}
${bill.convenienceFeePaise > 0 ? `<div class="totals-row"><span>Convenience Fee</span><span>${formatINR(bill.convenienceFeePaise)}</span></div>` : ''}
${Math.abs(bill.roundOffPaise || 0) > 0 ? `<div class="totals-row"><span>Round Off</span><span>${bill.roundOffPaise >= 0 ? '+' : '-'}${formatINR(Math.abs(bill.roundOffPaise))}</span></div>` : ''}
${tipPaise > 0 ? `<div class="totals-row"><span>Tip</span><span>${formatINR(tipPaise)}</span></div>` : ''}
${taxSummaryTableHtml(bill)}
<div class="div-solid"></div>
<div class="totals-row grand"><span>TOTAL</span><span>${formatINR(totalWithTip)}</span></div>
<div class="div-solid"></div>
<div class="pay-row"><span>Payment</span><span>${escRcpt(method.toUpperCase())}</span></div>
<div class="div-dashed"></div>
<div class="footer">
  <div class="thank-you">${receiptFooterText()}</div>
  <div>Served by ${escRcpt(currentStaff.name)}</div>
</div>`;

    console.log(`[PRINT] Sending receipt to print dialog...`);
    printThermal80mm(`Receipt #${number}`, htmlBody, jobId);
    console.log(`[PRINT] Receipt #${number} print dialog launched successfully.`);
  }

  // count of QR orders awaiting approval (badge on the Approvals link)
  useEffect(() => {
    let alive = true;
    const refresh = () => fetch('/api/approvals').then((r) => (r.ok ? r.json() : null)).then((d) => { if (alive && d) setPendingApprovals(d.orders?.length ?? 0); }).catch(() => { });
    refresh();
    return () => { alive = false; };
  }, []);

  // follow the same realtime channel the KDS uses, so status flips here the
  // instant the kitchen bumps a ticket. We only care about orders from this till.
  useEffect(() => {
    return subscribeStaff((msg: any) => {
      // keep the approvals badge + floor occupancy live as orders arrive / settle / transfer / merge / split
      if (
        msg.type === 'order.pending' ||
        msg.type === 'order.new' ||
        msg.type === 'order.updated' ||
        msg.type === 'table.transferred' ||
        msg.type === 'table.merged' ||
        msg.type === 'table.split' ||
        msg.type === 'table.updated'
      ) {
        fetch('/api/approvals').then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) setPendingApprovals(d.orders?.length ?? 0); }).catch(() => { });
        refreshTables();
      }
      if (msg.type === 'table.transferred' && msg.transfer) {
        flash(`Table ${msg.transfer.fromTableLabel} transferred to Table ${msg.transfer.toTableLabel} (#${msg.transfer.orderNumber})`);
      }
      if (msg.type === 'table.merged' && msg.merge) {
        flash(`Table ${msg.merge.sourceTableLabel} merged into Table ${msg.merge.destTableLabel}`);
      }
      if (msg.type === 'table.split' && msg.split) {
        flash(`Order #${msg.split.originalOrderNumber} split into #${msg.split.newOrderNumber}`);
      }
      if (msg.type === 'waiter.called' && msg.request) {
        flash(`🔔 Table ${msg.request.tableLabel} called waiter!`);
      }
      if (msg.type === 'bill.requested' && msg.request) {
        flash(`🧾 Table ${msg.request.tableLabel} requested bill!`);
      }
      if (msg.type === 'staff.updated' && msg.staffId === currentStaff.id) {
        fetch('/api/auth/me')
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d?.staff) {
              setCurrentStaff((prev) => ({ ...prev, ...d.staff }));
            }
          })
          .catch(() => {});
      }
      if (msg.type !== 'order.updated') return;
      setLive((prev) => {
        if (!prev.some((t) => t.id === msg.ticket.id)) return prev;
        // drop served/settled tickets a moment after they land, so the rail
        // briefly shows the green→teal hand-off then clears itself
        if (msg.ticket.status === 'served' || msg.ticket.status === 'settled') {
          setTimeout(() => setLive((p) => p.filter((t) => t.id !== msg.ticket.id)), 4000);
        }
        return prev.map((t) => (t.id === msg.ticket.id ? { ...t, status: msg.ticket.status } : t));
      });
    });
  }, []);

  const cat = menu.find((c) => c.id === activeCat) ?? menu[0];
  const selectedTable = tables.find((t) => t.id === tableId);

  // Menu search: a non-empty query shows matches across ALL categories; an empty
  // one falls back to the active category. Each item carries its category name so
  // the card still shows the right food glyph when results are mixed.
  const q = search.trim().toLowerCase();
  const shownItems = useMemo(() => {
    const withCat = (c: MenuCategory) => c.items.map((it) => ({ ...it, catName: c.name }));
    if (q) return menu.flatMap(withCat).filter((it) => it.name.toLowerCase().includes(q));
    return cat ? withCat(cat) : [];
  }, [q, menu, cat]);

  const bill = useMemo(() => {
    const lines: BillLine[] = cart.map((l) => ({ pricePaise: l.pricePaise, gstRate: l.gstRate, qty: l.qty }));
    return computeBill(lines, { discountPct, discountFlatPaise, serviceChargePct: scPct, gstEnabled: outlet.gstEnabled, gstRateOverride: outlet.gstRate, gstInclusive: outlet.gstInclusive });
  }, [cart, discountPct, discountFlatPaise, scPct, outlet.gstEnabled, outlet.gstRate, outlet.gstInclusive]);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }

  function add(item: MenuItemDto) {
    const limitTag = item.tags?.find((t) => t.startsWith('limit:'));
    const limitVal = limitTag ? parseInt(limitTag.split(':')[1] ?? '0') : null;
    if (limitVal !== null) {
      const currentQty = cart.find((l) => l.itemId === item.id)?.qty ?? 0;
      if (currentQty >= limitVal) {
        flash(`Cannot add: Only ${limitVal} available today`);
        return;
      }
    }
    setCart((c) => {
      const ex = c.find((l) => l.itemId === item.id);
      if (ex) return c.map((l) => (l.itemId === item.id ? { ...l, qty: l.qty + 1 } : l));
      return [...c, { key: item.id, itemId: item.id, name: item.name, pricePaise: item.pricePaise, gstRate: item.gstRate, station: item.station, qty: 1 }];
    });
  }
  function bump(key: string, d: number) {
    if (d > 0) {
      const line = cart.find((l) => l.key === key);
      if (line) {
        const item = menu.flatMap((c) => c.items).find((it) => it.id === line.itemId);
        if (item) {
          const limitTag = item.tags?.find((t) => t.startsWith('limit:'));
          const limitVal = limitTag ? parseInt(limitTag.split(':')[1] ?? '0') : null;
          if (limitVal !== null && line.qty >= limitVal) {
            flash(`Only ${limitVal} available today`);
            return;
          }
        }
      }
    }
    setCart((c) => c.flatMap((l) => (l.key === key ? (l.qty + d <= 0 ? [] : [{ ...l, qty: l.qty + d }]) : [l])));
  }
  function clear() {
    setCart([]); setDiscountPct(0); setDiscountFlatPaise(0); setScPct(0);
    setOrderCustName(''); setOrderCustPhone('');
  }

  // shared "Charge →" entry: dine-in needs a table first (opens the floor map)
  function startCharge() {
    if (orderType === 'dine_in' && !tableId) { setPendingAction('charge'); setFloorOpen(true); flash('Pick a table first'); return; }
    setCharging(true);
  }

  async function submit(
    withPayment: null | { method: 'cash' | 'upi' | 'card'; tipPaise: number },
    opts?: { customer?: { name: string; phone: string } | null; print?: boolean },
  ) {
    if (!cart.length) return;
    if (isOffline()) { flash(withPayment ? OFFLINE_PAY_MSG : OFFLINE_ORDER_MSG); return; }
    if (orderType === 'dine_in' && !tableId) { setCharging(false); setPendingAction('kot'); setFloorOpen(true); flash('Pick a table first'); return; }
    // customer: the charge modal passes an explicit value (may be null); a plain
    // Send-to-KOT (no opts) falls back to whatever was attached on the ticket panel.
    const customer = opts ? (opts.customer ?? null) : (orderCustName.trim() || orderCustPhone.trim() ? { name: orderCustName.trim(), phone: orderCustPhone.trim() } : null);
    setBusy(true);
    try {
      const body = {
        clientUuid: generateClientUuid(),
        outletId: outlet.id,
        staffId: staff.id,
        type: orderType,
        tableId: orderType === 'dine_in' ? tableId : null,
        // walk-in captured on the ticket / charge modal → server creates/links the CRM customer
        ...(customer ? { customer } : {}),
        lines: cart.map((l) => ({
          itemId: l.itemId,
          nameSnapshot: l.name,
          qty: l.qty,
          unitPricePaise: l.pricePaise,
          gstRate: l.gstRate,
          station: l.station,
          modifiers: [],
          notes: l.notes || undefined,
        })),
        discountPct,
        discountFlatPaise,
        serviceChargePct: scPct,
        interState: false,
        ...(withPayment ? { payment: { method: withPayment.method, amountPaise: bill.totalPaise + withPayment.tipPaise, tipPaise: withPayment.tipPaise } } : {}),
      };
      const geo = locationGate ? await getGeoHeaders() : {};
      const res = await fetch('/api/orders', { method: 'POST', headers: { 'content-type': 'application/json', ...geo }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) {
        if (data?.error === 'out_of_range') { flash('Too far from the cafe to place this order'); return; }
        if (data?.error === 'slot_exceeded') { flash('Monthly order limit reached'); return; }
        if (data?.issues) { console.error('Order validation issues:', data.issues); flash('Invalid order data'); return; }
        flash(data?.message || (data?.error ? `Error: ${data.error}` : 'Cannot reach Main PC — verify Wi-Fi is connected (disable 5G)'));
        return;
      }
      flash(withPayment ? `Paid ${formatINR(bill.totalPaise + withPayment.tipPaise)} · #${data.order.number}` : `KOT #${data.order.number} sent to kitchen`);
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('pos-entry-sync'));
      // print the receipt before clearing the cart (cart/bill are read inside printReceipt)
      if (withPayment && opts?.print) printReceipt(data.order.number, withPayment.method, withPayment.tipPaise, customer);
      // start tracking it on the live rail (idempotent replays return the same order)
      const where = orderType === 'takeaway' ? '🥡 Takeaway' : selectedTable ? `Table ${selectedTable.label}` : 'Dine-in';
      setLive((prev) => (prev.some((t) => t.id === data.order.id) ? prev : [{ id: data.order.id, number: data.order.number, where, status: data.order.status ?? 'in_kitchen', placedAt: Date.now() }, ...prev]));
      // Printed / Hybrid workflow: auto-print the paper KOT (reads cart, so before clear())
      if (!data.idempotent && outlet.kitchenWorkflow.autoPrintKot && outlet.kitchenWorkflow.mode !== 'digital') printKotFromCart(data.order.number, where);
      clear(); setCharging(false);
      // reset the table so the next order must pick one (don't silently reuse the last table)
      if (orderType === 'dine_in') setTableId(null);
    } catch (e: any) {
      console.error('Order submission error:', e);
      flash(e?.message ? `Order failed: ${e.message}` : 'Cannot reach Main PC — check Wi-Fi connection (disable 5G)');
    } finally {
      setBusy(false);
    }
  }

  // After a Send/Charge tap opened the floor map to pick a table, resume that action
  // once a table is chosen (runs on the next render, so tableId is already set).
  useEffect(() => {
    if (!tableId || !pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);
    if (action === 'charge') setCharging(true);
    else void submit(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, pendingAction]);

  return (
    <>
      <div className="md:hidden sticky top-0 z-30" style={{ paddingTop: 'env(safe-area-inset-top)', background: 'color-mix(in srgb, var(--paper) 90%, transparent)', backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--line)' }}>
        <div className="flex items-center gap-2 px-3 py-2 pr-14">
          <StaffBell role={currentStaff.role} staffId={currentStaff.id} triggerClassName="btn btn-icon btn-sm btn-ghost shrink-0" />
          <div className="flex rounded-full p-[3px] border flex-1 min-w-0" style={{ background: 'var(--paper-2)', borderColor: 'var(--line)' }}>
            {(['dine_in', 'takeaway'] as const).map((t) => (
              <button key={t} onClick={() => { setOrderType(t); if (t === 'takeaway') setTableId(null); }}
                className="flex-1 py-2 rounded-full font-bold text-[12.5px] transition"
                style={orderType === t ? { background: 'var(--ink)', color: 'var(--paper-2)' } : { color: 'var(--ink-2)' }}>
                {t === 'dine_in' ? 'Dine-in' : 'Takeaway'}
              </button>
            ))}
          </div>
          {orderType === 'dine_in' && (
            <button onClick={() => setFloorOpen(true)} aria-label={selectedTable ? `Table ${selectedTable.label}` : 'Pick a table'}
              className="flex items-center gap-1.5 h-10 px-3 rounded-full border-[1.5px] font-bold text-[12.5px] shrink-0 whitespace-nowrap"
              style={{ borderColor: !tableId ? 'var(--clay)' : 'var(--line)', color: !tableId ? 'var(--clay)' : 'var(--ink-2)', background: 'var(--paper-2)' }}>
              <Table2 size={14} aria-hidden />{selectedTable ? `T${selectedTable.label}` : 'Table'}
            </button>
          )}
        </div>
        <div className="px-3 pb-2">
          <div className="relative">
            <Search size={16} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ink-3)' }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search menu…" aria-label="Search menu" type="search"
              className="w-full pl-9 pr-9 py-2.5 rounded-full border text-sm outline-none" style={{ background: 'var(--paper-2)', borderColor: 'var(--line)' }} />
            {search && <button onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 grid place-items-center" style={{ color: 'var(--ink-3)' }}><X size={16} aria-hidden /></button>}
          </div>
        </div>
        <div className="subtabs px-3 pb-2">
          {menu.map((c) => {
            const Ic = CAT_ICON[c.name] ?? Coffee;
            const on = c.id === activeCat && !q;
            return (
              <button key={c.id} onClick={() => { setActiveCat(c.id); setSearch(''); }} aria-pressed={on}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border font-bold text-[13px] whitespace-nowrap transition"
                style={on ? { background: 'var(--ink)', color: 'var(--paper-3)', borderColor: 'var(--ink)' } : { background: 'var(--paper-2)', borderColor: 'var(--line)', color: 'var(--ink-2)' }}>
                <Ic size={15} aria-hidden />{c.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[180px_1fr_300px] lg:grid-cols-[232px_1fr_360px] gap-4 h-auto md:h-screen p-4 pt-3 md:pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        <aside className="hidden md:flex flex-col gap-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <img
                src="/logo chaya one.png"
                alt="ChayaOne"
                className="brand-logo h-8 lg:h-9 w-auto object-contain shrink-0"
              />
            </div>
            <div className="flex items-center gap-1">
              {canAccess(currentStaff, 'dashboard') && (
                <a
                  href="/dashboard"
                  onClick={handleDashboardClick}
                  title="Go to Dashboard"
                  className="btn btn-icon btn-sm btn-ghost"
                  style={{ color: 'var(--ink-2)' }}
                >
                  <LayoutDashboard size={18} aria-hidden />
                </a>
              )}
              <StaffBell role={currentStaff.role} staffId={currentStaff.id} triggerClassName="btn btn-icon btn-sm btn-ghost" />
              <ThemeToggle />
            </div>
          </div>
          <div className="flex items-center gap-2 px-1 -mt-1">
            <span className="w-6 h-6 rounded-full grid place-items-center text-[11px] font-extrabold text-white" style={{ background: 'linear-gradient(135deg, var(--turmeric), var(--clay))' }}>{currentStaff.name[0]}</span>
            <span className="text-[12.5px] font-bold">{currentStaff.name}</span>
            <span className="pill" style={{ padding: '2px 8px', fontSize: '10px', textTransform: 'capitalize' }}>
              {currentStaff.roles && currentStaff.roles.length > 1 ? currentStaff.roles.join(' + ') : currentStaff.role}
            </span>
          </div>
          <div className="px-1 flex flex-col gap-1.5">
            <ShiftStatus />
            <BusinessDayHeaderBadge />
          </div>
          <div className="flex rounded-full p-[3px] border" style={{ background: 'var(--paper-2)', borderColor: 'var(--line)' }}>
            {(['dine_in', 'takeaway'] as const).map((t) => (
              <button key={t} onClick={() => { setOrderType(t); if (t === 'takeaway') setTableId(null); }}
                className="flex-1 py-2 rounded-full font-bold text-[13px] transition"
                style={orderType === t ? { background: 'var(--ink)', color: 'var(--paper-2)' } : { color: 'var(--ink-2)' }}>
                {t === 'dine_in' ? 'Dine-in' : 'Takeaway'}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-1.5 overflow-auto flex-1">
            {menu.map((c) => {
              const Ic = CAT_ICON[c.name] ?? Coffee;
              const on = c.id === activeCat && !q;
              return (
                <button key={c.id} onClick={() => { setActiveCat(c.id); setSearch(''); }} aria-pressed={on}
                  className="flex items-center gap-3 px-3 py-3 rounded-[14px] border font-bold text-sm transition text-left"
                  style={on ? { background: 'var(--ink)', color: 'var(--paper-3)', borderColor: 'var(--ink)' } : { background: 'var(--paper-2)', borderColor: 'var(--line)', color: 'var(--ink-2)' }}>
                  <Ic size={18} aria-hidden className="shrink-0" />{c.name}
                  <span className="ml-auto text-[11px] opacity-60 tnum">{c.items.length}</span>
                </button>
              );
            })}
          </div>
          <button onClick={() => setFloorOpen(true)} className="flex items-center justify-center gap-2 py-3 rounded-[14px] border-[1.5px] border-dashed font-bold text-[13.5px]" style={{ borderColor: 'var(--line-2)', color: 'var(--ink-2)' }}>
            <Table2 size={17} aria-hidden /> Floor map &amp; tables
          </button>
          <button
            type="button"
            disabled
            title="QR Approvals is currently disabled"
            className="relative flex items-center justify-center gap-2 py-3 rounded-[14px] font-bold text-[13.5px] opacity-40 cursor-not-allowed select-none"
            style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', color: 'var(--ink-3)' }}
          >
            <ClipboardList size={17} aria-hidden /> QR Approvals
            {pendingApprovals > 0 && (
              <span className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1.5 grid place-items-center rounded-full text-[11px] font-extrabold text-white tnum opacity-60" style={{ background: 'var(--ink-3)' }} aria-label={`${pendingApprovals} pending`}>{pendingApprovals}</span>
            )}
          </button>
          {showInstallApp && (
            <button onClick={() => staffInstall.promptInstall()} className="flex items-center justify-center gap-2 py-3 rounded-[14px] font-bold text-[13.5px] transition" style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}>
              <Download size={17} aria-hidden /> {staffInstall.iosHint ? 'Add app to Home Screen' : 'Install the Staff App'}
            </button>
          )}
          <a href="/api/auth/logout" className="flex items-center justify-center gap-2 py-2.5 rounded-[14px] font-bold text-[13px] transition hover:bg-[var(--paper-3)] mt-auto" style={{ color: 'var(--ink-3)' }}>
            <LogOut size={16} aria-hidden /> Logout
          </a>
        </aside>

        <section className="flex flex-col min-w-0 pb-[calc(120px_+_env(safe-area-inset-bottom))] md:pb-0">
          <div className="flex items-center gap-3 mb-3.5">
            <h2 className="text-2xl md:text-[28px] shrink-0">{q ? `“${search.trim()}”` : cat?.name}</h2>
            <div className="relative ml-auto hidden md:block w-full max-w-[240px]">
              <Search size={16} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ink-3)' }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search menu…" aria-label="Search menu" type="search"
                className="w-full pl-9 pr-9 py-2 rounded-full border text-sm outline-none" style={{ background: 'var(--paper-2)', borderColor: 'var(--line)' }} />
              {search && <button onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 grid place-items-center" style={{ color: 'var(--ink-3)' }}><X size={15} aria-hidden /></button>}
            </div>
            <span className="pill shrink-0 hidden lg:inline-flex">{outlet.stateCode} · GST intra-state</span>

            {/* Small Sync Button in Top Bar */}
            <div className="relative shrink-0 hidden md:block">
              <button
                id="topbar-sync-btn"
                data-testid="topbar-sync-btn"
                type="button"
                onClick={() => setSyncOpen((o) => !o)}
                title="Server Connection & Sync Settings"
                className="pill flex items-center gap-1.5 cursor-pointer font-bold text-xs hover:opacity-85 transition"
                style={{
                  background: syncOpen ? 'var(--paper-3)' : 'var(--paper-2)',
                  border: '1px solid var(--line)',
                  color: 'var(--ink-2)',
                }}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <RefreshCw size={13} className={syncOpen ? 'text-emerald-500' : ''} />
                <span>Sync</span>
              </button>

              {syncOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setSyncOpen(false)} />
                  <div
                    className="absolute right-0 mt-2 w-[340px] z-50 rounded-2xl p-2.5 shadow-2xl"
                    style={{
                      background: 'var(--paper)',
                      border: '1px solid var(--line-2)',
                      boxShadow: 'var(--sh-3)',
                    }}
                  >
                    <div className="flex items-center justify-between px-2.5 py-1.5 border-b mb-2" style={{ borderColor: 'var(--line)' }}>
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>Server &amp; Sync Control</span>
                      <button
                        type="button"
                        onClick={() => setSyncOpen(false)}
                        className="btn btn-ghost btn-xs w-6 h-6 p-0 grid place-items-center rounded-lg cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <ServerSyncCard onManualSync={refreshTables} compact />
                  </div>
                </>
              )}
            </div>
          </div>

          {live.length > 0 && <LiveOrders tickets={live} now={now} />}

          <div className="grid gap-3 overflow-visible md:overflow-auto content-start pr-1" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px,1fr))' }}>
            {shownItems.length === 0 ? (
              <div className="col-span-full grid place-content-center text-center gap-2 py-12" style={{ color: 'var(--ink-3)' }}>
                <Search size={34} className="mx-auto opacity-40" aria-hidden />
                <p>{q ? `No items match “${search.trim()}”.` : 'No items in this category.'}</p>
              </div>
            ) : shownItems.map((m) => (
              <button key={m.id} onClick={() => add(m)}
                className="relative text-left p-3.5 rounded-[14px] border flex flex-col gap-2 transition hover:-translate-y-0.5"
                style={{ background: 'var(--paper-2)', borderColor: 'var(--line)', boxShadow: 'var(--sh-1)' }}>
                {m.tags.includes('bestseller') && <span className="absolute top-0 left-0 text-[9.5px] font-extrabold text-white px-2 py-0.5" style={{ background: 'var(--turmeric-d)', borderRadius: '14px 0 14px 0' }}>★ Bestseller</span>}
                {(() => {
                  const limitTag = m.tags.find((t) => t.startsWith('limit:'));
                  const limitVal = limitTag ? parseInt(limitTag.split(':')[1] ?? '0') : null;
                  if (limitVal !== null) {
                    return (
                      <span className="absolute top-0 right-0 text-[9.5px] font-extrabold text-white px-2 py-0.5" style={{ background: 'var(--clay)', borderRadius: '0 14px 0 14px' }}>
                        {limitVal} left
                      </span>
                    );
                  }
                  return null;
                })()}
                <div className="text-3xl" aria-hidden>{EMOJI[m.catName] ?? '🍽'}</div>
                <div className="font-bold text-sm leading-tight">{m.name}</div>
                {q && <div className="text-[10.5px] font-bold" style={{ color: 'var(--ink-3)' }}>{m.catName}</div>}
                <div className="flex items-center justify-between mt-auto">
                  <span className="tnum text-sm" style={{ fontFamily: 'var(--font-mono)' }}>{formatINR(m.pricePaise)}</span>
                  <span className="text-[10px] font-bold" style={{ color: 'var(--ink-3)' }}>GST {m.gstRate}%</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <aside className="card hidden md:flex flex-col p-[18px] min-h-0">
          <div className="flex justify-between items-start mb-3.5">
            <div>
              <h3 className="text-[19px]">Current ticket</h3>
              {orderType === 'dine_in' ? (
                <div className="flex items-center gap-2">
                  <button onClick={() => setFloorOpen(true)} title="Change table" className="text-[12.5px] font-bold underline-offset-2 hover:underline" style={{ color: !tableId ? 'var(--clay)' : 'var(--cardamom-d)' }}>
                    {selectedTable ? `Table ${selectedTable.label}` : 'Pick a table'}
                  </button>
                  {selectedTable && occupied[selectedTable.id] && (
                    <button
                      onClick={() => openTableActions(selectedTable, true)}
                      title="Transfer this table"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[7px] border text-[11px] font-bold transition hover:opacity-90"
                      style={{ background: 'color-mix(in srgb, var(--turmeric) 22%, var(--paper))', borderColor: 'var(--turmeric)', color: 'var(--turmeric-d, #b45309)' }}
                    >
                      <ArrowLeftRight size={11} aria-hidden /> Transfer
                    </button>
                  )}
                </div>
              ) : (
                <span className="text-[12.5px] font-bold" style={{ color: 'var(--cardamom-d)' }}>Takeaway</span>
              )}
            </div>
            <button onClick={clear} disabled={!cart.length} title="Clear ticket" aria-label="Clear ticket" className="btn btn-icon btn-sm btn-ghost"><RefreshCw size={16} aria-hidden /></button>
          </div>

          <CartBody
            cart={cart}
            bill={bill}
            outlet={outlet}
            discountPct={discountPct}
            discountFlatPaise={discountFlatPaise}
            scPct={scPct}
            setDiscountPct={setDiscountPct}
            setDiscountFlatPaise={setDiscountFlatPaise}
            setScPct={setScPct}
            bump={bump}
            editingNoteKey={editingNoteKey}
            noteDraft={noteDraft}
            setNoteDraft={setNoteDraft}
            openNoteEdit={openNoteEdit}
            saveNote={saveNote}
            removeNote={removeNote}
            quickNotes={QUICK_ITEM_NOTES}
          />

          {cart.length > 0 && (
            <CustomerField name={orderCustName} phone={orderCustPhone} open={showOrderCust}
              setName={setOrderCustName} setPhone={setOrderCustPhone} setOpen={setShowOrderCust} />
          )}

          <div className="grid grid-cols-[1fr_1.2fr] gap-2.5 mt-3.5">
            <button disabled={!cart.length || busy} onClick={() => submit(null)} className="btn btn-dark">Send to KOT</button>
            <button disabled={!cart.length || busy} onClick={startCharge} className="btn btn-primary">Charge →</button>
          </div>
        </aside>

        {/* floor modal */}
        {floorOpen && (() => {
          // group tables under their floor; a missing/stale floorId falls under "Unassigned"
          const floorIds = new Set(floors.map((f) => f.id));
          const hasUnassigned = tables.some((t) => !t.floorId || !floorIds.has(t.floorId));
          const groups: { key: string; name: string; tables: TableDto[] }[] = [
            ...floors.map((f) => ({ key: f.id, name: f.name, tables: tables.filter((t) => t.floorId === f.id) })),
            { key: 'unassigned', name: 'Unassigned', tables: tables.filter((t) => !t.floorId || !floorIds.has(t.floorId)) },
          ].filter((g) => g.tables.length > 0);

          const renderTableButton = (t: TableDto) => {
            const occ = occupied[t.id];
            const stage = tableStage(occ?.status);
            const s = TABLE_STAGES[stage];
            const mins = occ ? Math.floor((now - occ.sinceMs) / 60000) : 0;
            const selected = tableId === t.id;
            return (
              <button key={t.id} onClick={() => { if (occ) { openTableActions(t); } else { setTableId(t.id); setOrderType('dine_in'); setFloorOpen(false); } }}
                className="aspect-square rounded-[14px] border-[1.5px] flex flex-col items-center justify-center gap-1 transition"
                style={{
                  borderColor: selected ? 'var(--turmeric-d)' : s.color,
                  borderTopWidth: 4, borderTopColor: s.color,
                  background: occ ? `color-mix(in srgb, ${s.color} 10%, var(--paper-3))` : 'var(--paper-3)',
                  boxShadow: selected ? 'var(--sh-glow)' : undefined,
                }}>
                <span className="font-display font-bold text-[22px]">{t.label}</span>
                {occ ? (
                  <>
                    <span className="text-[11px] font-bold tnum" style={{ color: 'var(--ink-2)' }}>#{occ.number} · {formatINR(occ.billPaise)}</span>
                    <span className="text-[10px] font-bold uppercase" style={{ color: s.color }}>{s.label} · {mins}m</span>
                  </>
                ) : (
                  <>
                    <span className="tracking-widest" style={{ color: 'var(--ink-3)' }}>{'•'.repeat(t.seats)}</span>
                    <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--ink-3)' }}>Free</span>
                  </>
                )}
              </button>
            );
          };

          const showAll = floorFilter === 'all';
          const shownGroups = showAll ? groups : groups.filter((g) => g.key === floorFilter);

          return (
            <Modal onClose={() => { setFloorOpen(false); setPendingAction(null); }} title="Floor map">
              {/* status legend — by order stage */}
              <div className="flex flex-wrap gap-4 px-5 pt-4">
                {TABLE_STAGE_ORDER.map((k) => (
                  <span key={k} className="inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: 'var(--ink-2)' }}>
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: TABLE_STAGES[k].color }} />{TABLE_STAGES[k].label}
                  </span>
                ))}
              </div>

              {/* floor filter chips — only when floors are configured */}
              {floors.length > 0 && (
                <div className="flex flex-wrap gap-2 px-5 pt-4">
                  <Chip on={floorFilter === 'all'} onClick={() => setFloorFilter('all')}>All</Chip>
                  {floors.map((f) => (
                    <Chip key={f.id} on={floorFilter === f.id} onClick={() => setFloorFilter(f.id)}>{f.name}</Chip>
                  ))}
                  {hasUnassigned && (
                    <Chip on={floorFilter === 'unassigned'} onClick={() => setFloorFilter('unassigned')}>Unassigned</Chip>
                  )}
                </div>
              )}

              {/* grouped (All) vs single-floor grid */}
              {showAll && floors.length > 0 ? (
                <div className="p-5 flex flex-col gap-5">
                  {shownGroups.map((g) => (
                    <div key={g.key}>
                      <div className="text-[11px] font-bold uppercase tracking-wide mb-2.5" style={{ color: 'var(--ink-3)' }}>{g.name}</div>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">{g.tables.map(renderTableButton)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 p-5">
                  {(shownGroups.flatMap((g) => g.tables)).map(renderTableButton)}
                </div>
              )}
            </Modal>
          );
        })()}

        {/* table actions — opens when an occupied table is tapped */}
        {tableAction && (
          <Modal
            onClose={closeTableActions}
            title={`Table ${tableAction.label}`}
            headerAction={
              !transferMode ? (
                <button
                  onClick={() => {
                    setTransferMode(true);
                    setSelectedDestTable(null);
                    setTransferOccupiedError(null);
                    setTransferSuccess(null);
                  }}
                  title="Transfer table"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] border text-xs font-bold transition hover:opacity-90 shadow-sm"
                  style={{
                    background: 'color-mix(in srgb, var(--turmeric) 22%, var(--paper))',
                    borderColor: 'var(--turmeric)',
                    color: 'var(--turmeric-d, #b45309)',
                  }}
                >
                  <ArrowLeftRight size={14} aria-hidden />
                  <span>Transfer</span>
                </button>
              ) : undefined
            }
          >
            {!tableOrder ? (
              <p className="p-6 text-center" style={{ color: 'var(--ink-3)' }}>Loading order…</p>
            ) : transferMode ? (
              /* ── Table Transfer Flow ── */
              transferSuccess ? (
                <div className="p-6 text-center flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-full grid place-items-center text-2xl font-bold" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#16a34a' }}>
                    ✓
                  </div>
                  <h3 className="text-lg font-display font-bold">Order #{transferSuccess.orderNumber} Transferred</h3>
                  <div className="p-3.5 rounded-xl border w-full flex flex-col gap-1.5 text-xs text-left" style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }}>
                    <div className="flex items-center justify-between">
                      <span style={{ color: 'var(--ink-3)' }}>Source:</span>
                      <b style={{ color: 'var(--cardamom-d, #16a34a)' }}>Table {transferSuccess.fromLabel} is now AVAILABLE</b>
                    </div>
                    <div className="flex items-center justify-between">
                      <span style={{ color: 'var(--ink-3)' }}>Destination:</span>
                      <b style={{ color: 'var(--turmeric-d)' }}>Table {transferSuccess.toLabel} is now OCCUPIED</b>
                    </div>
                  </div>
                  <button onClick={closeTableActions} className="btn btn-primary w-full mt-2">Done</button>
                </div>
              ) : selectedDestTable ? (
                transferOccupiedError || occupied[selectedDestTable.id] ? (
                  <div className="p-5 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <button onClick={() => { setSelectedDestTable(null); setTransferOccupiedError(null); }} className="text-xs font-bold" style={{ color: 'var(--ink-3)' }}>← Back</button>
                      <span className="font-bold text-[13px]" style={{ color: 'var(--clay, #dc2626)' }}>Destination Occupied</span>
                    </div>
                    <div className="p-4 rounded-xl border flex flex-col gap-2" style={{ background: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                      <div className="flex items-center gap-2 font-bold text-sm" style={{ color: 'var(--clay, #dc2626)' }}>
                        <CircleAlert size={18} /> Table {selectedDestTable.label} is already occupied.
                      </div>
                      <p className="text-xs" style={{ color: 'var(--ink-2)' }}>
                        An active order is currently running on Table {selectedDestTable.label}. Normal transfer cannot overwrite an existing order.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 mt-2">
                      <button
                        onClick={() => {
                          flash(`To merge into Table ${selectedDestTable.label}, add items directly or settle via POS.`);
                        }}
                        className="btn btn-dark w-full"
                        style={{ background: 'var(--paper-3)', color: 'var(--ink-2)' }}
                      >
                        MERGE ORDERS
                      </button>
                      <button onClick={() => { setSelectedDestTable(null); setTransferOccupiedError(null); }} className="btn w-full">
                        CANCEL
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 flex flex-col gap-3.5">
                    <div className="flex items-center justify-between">
                      <button onClick={() => setSelectedDestTable(null)} className="text-xs font-bold" style={{ color: 'var(--ink-3)' }}>← Back</button>
                      <span className="font-bold text-[13px]" style={{ color: 'var(--ink-2)' }}>Confirm Transfer</span>
                    </div>

                    <div className="p-4 rounded-2xl border flex items-center justify-between text-center" style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }}>
                      <div className="flex-1">
                        <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>From</div>
                        <div className="font-display font-black text-2xl" style={{ color: 'var(--clay, #dc2626)' }}>Table {tableAction.label}</div>
                      </div>
                      <div className="px-2" style={{ color: 'var(--turmeric-d)' }}>
                        <ArrowRight size={22} />
                      </div>
                      <div className="flex-1">
                        <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>To</div>
                        <div className="font-display font-black text-2xl" style={{ color: 'var(--cardamom-d, #16a34a)' }}>Table {selectedDestTable.label}</div>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl border flex flex-col gap-1 text-xs" style={{ background: 'var(--paper)', borderColor: 'var(--line)' }}>
                      <div className="flex justify-between">
                        <span style={{ color: 'var(--ink-3)' }}>Order:</span>
                        <b>#{tableOrder.orders.map((o: any) => o.number).join(', ')}</b>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color: 'var(--ink-3)' }}>Total:</span>
                        <b className="tnum">{formatINR(tableOrder.totals.totalPaise)}</b>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color: 'var(--ink-3)' }}>Items:</span>
                        <span>{tableOrder.lines.reduce((s: number, l: any) => s + l.qty, 0)} items ({tableOrder.lines.length} lines)</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold mb-1" style={{ color: 'var(--ink-3)' }}>Reason (optional)</label>
                      <input
                        type="text"
                        value={transferReason}
                        onChange={(e) => setTransferReason(e.target.value)}
                        placeholder="e.g. Guest moved outdoor, joined table..."
                        className="w-full p-2.5 rounded-xl border text-sm outline-none"
                        style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                      <button onClick={() => setSelectedDestTable(null)} disabled={transferBusy} className="btn">
                        Cancel
                      </button>
                      <button onClick={executeTableTransfer} disabled={transferBusy} className="btn btn-primary">
                        {transferBusy ? 'Transferring…' : 'Confirm Transfer'}
                      </button>
                    </div>
                  </div>
                )
              ) : (
                /* Destination Table Picker */
                (() => {
                  const floorIds = new Set(floors.map((f) => f.id));
                  const hasUnassigned = tables.some((t) => !t.floorId || !floorIds.has(t.floorId));
                  const availableTables = transferFloorFilter === 'all'
                    ? tables
                    : transferFloorFilter === 'unassigned'
                      ? tables.filter((t) => !t.floorId || !floorIds.has(t.floorId))
                      : tables.filter((t) => t.floorId === transferFloorFilter);

                  return (
                    <div className="p-5 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <button onClick={() => setTransferMode(false)} className="text-xs font-bold" style={{ color: 'var(--ink-3)' }}>← Back</button>
                        <span className="font-bold text-[13px]" style={{ color: 'var(--ink-2)' }}>Select Destination Table</span>
                      </div>

                      {floors.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pb-1">
                          <Chip on={transferFloorFilter === 'all'} onClick={() => setTransferFloorFilter('all')}>All</Chip>
                          {floors.map((f) => (
                            <Chip key={f.id} on={transferFloorFilter === f.id} onClick={() => setTransferFloorFilter(f.id)}>{f.name}</Chip>
                          ))}
                          {hasUnassigned && (
                            <Chip on={transferFloorFilter === 'unassigned'} onClick={() => setTransferFloorFilter('unassigned')}>Unassigned</Chip>
                          )}
                        </div>
                      )}

                      <div className="max-h-[280px] overflow-auto grid grid-cols-3 sm:grid-cols-4 gap-2.5 pt-1">
                        {availableTables.map((t) => {
                          const isCurrent = t.id === tableAction.id;
                          const occ = occupied[t.id];
                          return (
                            <button
                              key={t.id}
                              disabled={isCurrent}
                              onClick={() => {
                                if (isCurrent) return;
                                setSelectedDestTable(t);
                                if (occ) {
                                  setTransferOccupiedError(`Table ${t.label} is already occupied.`);
                                } else {
                                  setTransferOccupiedError(null);
                                }
                              }}
                              className="aspect-square rounded-[14px] border-[1.5px] flex flex-col items-center justify-center gap-1 transition relative"
                              style={{
                                opacity: isCurrent ? 0.35 : 1,
                                borderColor: occ ? 'rgba(239, 68, 68, 0.4)' : 'rgba(34, 197, 94, 0.5)',
                                background: occ ? 'color-mix(in srgb, var(--clay, #dc2626) 8%, var(--paper-3))' : 'color-mix(in srgb, var(--cardamom-d, #16a34a) 8%, var(--paper-3))',
                              }}
                            >
                              {isCurrent && (
                                <span className="absolute top-1 right-1 text-[8.5px] font-bold px-1 rounded bg-black/40 text-white">Current</span>
                              )}
                              <span className="font-display font-bold text-[20px]">{t.label}</span>
                              {occ ? (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#dc2626' }}>
                                  Occupied
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#16a34a' }}>
                                  Free · {t.seats}s
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()
              )
            ) : addMode ? (
              /* ── inline add-items panel ── */
              (() => {
                const q = addSearch.trim().toLowerCase();
                const items = menu.flatMap((c) => c.items).filter((it) => !q || it.name.toLowerCase().includes(q));
                const cartTotal = tableCart.reduce((s, l) => s + l.pricePaise * l.qty, 0);
                return (
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <button onClick={() => { setAddMode(false); setAddSearch(''); }} className="text-xs font-bold" style={{ color: 'var(--ink-3)' }}>← Back</button>
                      <span className="font-bold text-[13px]" style={{ color: 'var(--ink-2)' }}>Add to Table {tableAction.label}</span>
                    </div>

                    <input
                      value={addSearch}
                      onChange={(e) => setAddSearch(e.target.value)}
                      placeholder="Search menu…"
                      className="w-full p-2.5 rounded-xl border text-sm outline-none mb-3"
                      style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }}
                    />

                    <div className="max-h-[230px] overflow-auto flex flex-col gap-1 mb-3">
                      {items.length === 0 ? (
                        <p className="text-sm text-center py-4" style={{ color: 'var(--ink-3)' }}>No items match.</p>
                      ) : items.map((it) => (
                        <button key={it.id} onClick={() => addToTable(it)} className="flex justify-between items-center gap-2 text-sm p-2.5 rounded-xl text-left" style={{ background: 'var(--paper-3)' }}>
                          <span className="min-w-0"><b className="block truncate">{it.name}</b><span className="text-xs" style={{ color: 'var(--ink-3)' }}>{formatINR(it.pricePaise)}{it.station ? ` · ${it.station}` : ''}</span></span>
                          <span className="shrink-0 w-7 h-7 grid place-items-center rounded-lg" style={{ background: 'var(--turmeric)', color: '#2A1607' }} aria-hidden><Plus size={16} /></span>
                        </button>
                      ))}
                    </div>

                    {tableCart.length > 0 && (
                      <div className="flex flex-col gap-1.5 border-t py-3 mb-3" style={{ borderColor: 'var(--line)' }}>
                        {tableCart.map((l) => (
                          <div key={l.key} className="flex items-center justify-between text-sm">
                            <span className="min-w-0 truncate">{l.name}</span>
                            <span className="flex items-center gap-2 shrink-0">
                              <button onClick={() => bumpTable(l.key, -1)} className="w-6 h-6 rounded-[7px] border font-extrabold" style={{ borderColor: 'var(--line)' }}>−</button>
                              <b className="w-5 text-center tnum">{l.qty}</b>
                              <button onClick={() => bumpTable(l.key, 1)} className="w-6 h-6 rounded-[7px] border font-extrabold" style={{ borderColor: 'var(--line)' }}>+</button>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <button onClick={sendTableCart} disabled={tableCart.length === 0 || sendBusy} className="btn btn-primary w-full" style={tableCart.length === 0 ? { opacity: 0.5 } : undefined}>
                      {sendBusy ? 'Sending…' : `Send to kitchen${cartTotal > 0 ? ` · ${formatINR(cartTotal)}` : ''}`}
                    </button>
                  </div>
                );
              })()
            ) : (
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-[13px]" style={{ color: 'var(--ink-2)' }}>
                    {tableOrder.count} order{tableOrder.count > 1 ? 's' : ''} · #{tableOrder.orders.map((o: any) => o.number).join(', ')}
                  </span>
                  <span className="font-display font-extrabold text-2xl tnum">{formatINR(tableOrder.totals.totalPaise)}</span>
                </div>

                <div className="max-h-[240px] overflow-auto flex flex-col gap-1.5 border-t border-b py-3 mb-4" style={{ borderColor: 'var(--line)' }}>
                  {tableOrder.lines.length === 0 ? (
                    <p className="text-sm text-center py-2" style={{ color: 'var(--ink-3)' }}>No items yet.</p>
                  ) : tableOrder.lines.map((l: any) => (
                    <div key={l.id} className="flex justify-between items-center gap-2 text-sm">
                      <span className="min-w-0"><b className="mr-1.5" style={{ color: 'var(--turmeric-d)' }}>{l.qty}×</b>{l.name}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="tnum" style={{ fontFamily: 'var(--font-mono)' }}>{formatINR(l.linePaise)}</span>
                        {canSettleBill && (
                          <button onClick={() => voidLine(l)} disabled={voidBusyId === l.id} title="Remove item" aria-label={`Remove ${l.name}`} className="w-7 h-7 grid place-items-center rounded-lg" style={{ background: 'var(--paper-3)', color: 'var(--clay, #c0392b)', opacity: voidBusyId === l.id ? 0.5 : 1 }}><X size={15} aria-hidden /></button>
                        )}
                      </span>
                    </div>
                  ))}
                </div>

                {/* customer on the bill — optional, defaults to "Customer" */}
                <div className="mb-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold" style={{ color: custName.trim() ? 'var(--ink-2)' : 'var(--ink-3)' }}>
                      <User size={14} aria-hidden /> {billCustomer}{custPhone.trim() ? ` · ${custPhone.trim()}` : ''}
                    </span>
                    <button onClick={() => setShowCust((v) => !v)} className="ml-auto text-xs font-bold" style={{ color: 'var(--turmeric-d)' }}>
                      {showCust ? 'Done' : custName.trim() ? 'Edit' : '＋ Add customer'}
                    </button>
                  </div>
                  {showCust && (
                    <CustomerField name={custName} phone={custPhone} open={showCust}
                      setName={setCustName} setPhone={setCustPhone} setOpen={setShowCust} compact />
                  )}
                </div>

                {(
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      onClick={() => { setAddMode(true); setTableCart([]); setAddSearch(''); }}
                      disabled={billPrinted}
                      className="btn btn-dark"
                      style={billPrinted ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                    >
                      <Plus size={16} aria-hidden /> Add items
                    </button>
                    <button
                      onClick={printKOT}
                      disabled={billPrinted}
                      className="btn"
                      style={billPrinted ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                    >
                      <Receipt size={16} aria-hidden /> Print KOT
                    </button>
                    {canPrintBill && (
                      <button
                        onClick={printBill}
                        disabled={billPrinted}
                        className="btn col-span-2"
                        title={billPrinted ? 'Bill already printed — table freed' : 'Print bill for this table'}
                        style={billPrinted
                          ? { opacity: 0.38, cursor: 'not-allowed', background: 'var(--paper-3)', border: '1px solid var(--line)' }
                          : {}}
                      >
                        <Printer size={16} aria-hidden />
                        {billPrinted ? '✓ Bill Printed — Table Freed' : 'Print bill'}
                      </button>
                    )}
                  </div>
                )}
                {billPrinted && (
                  <p className="text-[11px] mt-2 text-center font-semibold" style={{ color: 'var(--turmeric-d)' }}>
                    💳 Collect payment at the billing counter — use T-Billing to settle.
                  </p>
                )}
                {!canPrintBill && !billPrinted && <p className="text-[11px] mt-3 text-center" style={{ color: 'var(--ink-3)' }}>Bill printing requires staff access.</p>}
              </div>
            )}
          </Modal>
        )}

        {/* charge modal */}
        {charging && (
          <ChargeModal total={bill.totalPaise} busy={busy}
            initialName={orderCustName} initialPhone={orderCustPhone}
            upiConfig={outlet.upiConfig}
            onClose={() => setCharging(false)}
            onConfirm={(method, tipPaise, opts) => submit({ method, tipPaise }, opts)} />
        )}

        {toast && (
          <div role="status" aria-live="polite" className="anim-slide-in fixed left-1/2 -translate-x-1/2 bottom-[calc(76px_+_env(safe-area-inset-bottom))] md:bottom-7 z-[9000] px-5 py-3 rounded-full font-bold text-sm shadow-3" style={{ background: 'var(--ink)', color: 'var(--paper-2)' }}>
            {toast}
          </div>
        )}
      </div>

      {/* ── Mobile sticky cart bar — taps open the bottom-sheet (phones only) ── */}
      {!cartSheetOpen && cartCount > 0 && (
        <button onClick={() => setCartSheetOpen(true)} aria-haspopup="dialog" aria-label={`View ticket · ${cartCount} items · ${formatINR(bill.totalPaise)}`}
          className="md:hidden fixed inset-x-0 z-40 flex items-center gap-3 px-5 anim-slide-in"
          style={{ bottom: 'calc(58px + env(safe-area-inset-bottom))', paddingTop: '0.85rem', paddingBottom: '0.85rem', background: 'var(--ink)', color: 'var(--paper-2)', boxShadow: 'var(--sh-3)' }}>
          <span className="relative grid place-items-center w-9 h-9 rounded-full shrink-0" style={{ background: 'color-mix(in srgb, var(--paper-2) 16%, transparent)' }}>
            <ShoppingCart size={18} aria-hidden />
          </span>
          <span className="font-bold text-[13.5px]">{cartCount} item{cartCount > 1 ? 's' : ''}</span>
          <span className="ml-auto font-display font-extrabold text-[18px] tnum">{formatINR(bill.totalPaise)}</span>
          <ChevronUp size={18} aria-hidden />
        </button>
      )}

      {/* ── Mobile cart bottom-sheet — full ticket + Send to Kitchen / Charge ── */}
      {cartSheetOpen && (
        <div className="md:hidden fixed inset-0 z-[700] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Current ticket">
          <div className="absolute inset-0 anim-fade" style={{ background: 'var(--scrim)' }} onClick={() => setCartSheetOpen(false)} />
          <div className="relative anim-sheet flex flex-col max-h-[88vh] rounded-t-[26px] border-t" style={{ background: 'var(--paper-2)', borderColor: 'var(--line)' }}>
            <div className="relative pt-3">
              <span className="absolute left-1/2 -translate-x-1/2 top-2 w-10 h-1.5 rounded-full" style={{ background: 'var(--line-2)' }} aria-hidden />
              <div className="flex items-start gap-2 px-5 pt-2 pb-1">
                <div>
                  <h3 className="text-[18px] font-display font-bold">Current ticket</h3>
                  {orderType === 'dine_in' ? (
                    <button onClick={() => { setCartSheetOpen(false); setFloorOpen(true); }} className="text-[12.5px] font-bold" style={{ color: !tableId ? 'var(--clay)' : 'var(--cardamom-d)' }}>
                      {selectedTable ? `Table ${selectedTable.label}` : 'Pick a table'}
                    </button>
                  ) : (
                    <span className="text-[12.5px] font-bold" style={{ color: 'var(--cardamom-d)' }}>Takeaway</span>
                  )}
                </div>
                <button onClick={clear} disabled={!cart.length} title="Clear ticket" aria-label="Clear ticket" className="btn btn-icon btn-sm btn-ghost ml-auto"><RefreshCw size={16} aria-hidden /></button>
                <button onClick={() => setCartSheetOpen(false)} aria-label="Close" className="w-9 h-9 grid place-items-center rounded-[10px] border text-xl shrink-0" style={{ background: 'var(--paper)', borderColor: 'var(--line)' }}>×</button>
              </div>
            </div>
            <div className="flex flex-col flex-1 min-h-0 px-5 pb-[max(1.1rem,env(safe-area-inset-bottom))]">
              <CartBody
                cart={cart}
                bill={bill}
                outlet={outlet}
                discountPct={discountPct}
                discountFlatPaise={discountFlatPaise}
                scPct={scPct}
                setDiscountPct={setDiscountPct}
                setDiscountFlatPaise={setDiscountFlatPaise}
                setScPct={setScPct}
                bump={bump}
                editingNoteKey={editingNoteKey}
                noteDraft={noteDraft}
                setNoteDraft={setNoteDraft}
                openNoteEdit={openNoteEdit}
                saveNote={saveNote}
                removeNote={removeNote}
                quickNotes={QUICK_ITEM_NOTES}
              />
              {cart.length > 0 && (
                <CustomerField name={orderCustName} phone={orderCustPhone} open={showOrderCust}
                  setName={setOrderCustName} setPhone={setOrderCustPhone} setOpen={setShowOrderCust} />
              )}
              <div className="flex flex-col gap-2.5 mt-3.5">
                <button disabled={!cart.length || busy} onClick={() => { setCartSheetOpen(false); submit(null); }} className="btn btn-primary btn-lg w-full">Send to Kitchen</button>
                <button disabled={!cart.length || busy} onClick={() => { setCartSheetOpen(false); startCharge(); }} className="btn btn-dark w-full">Charge · {formatINR(bill.totalPaise)} →</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile bottom navigation bar (phones only) ── */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 grid md:hidden"
        style={{
          gridTemplateColumns: 'repeat(4, 1fr)',
          background: 'color-mix(in srgb, var(--paper-2) 92%, transparent)',
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid var(--line)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        aria-label="Mobile navigation"
      >
        <button
          onClick={() => { setFloorOpen(false); setMoreOpen(false); }}
          className="relative flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-bold transition"
          style={{ minHeight: 58, color: (!floorOpen && !moreOpen) ? 'var(--turmeric-d)' : 'var(--ink-2)' }}
        >
          <ShoppingCart size={20} aria-hidden />
          <span className="leading-none">Billing</span>
          {(!floorOpen && !moreOpen) && (
            <span className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-8 rounded-full" style={{ background: 'var(--turmeric)' }} />
          )}
        </button>

        <button
          onClick={() => { setFloorOpen(true); setMoreOpen(false); }}
          className="relative flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-bold transition"
          style={{ minHeight: 58, color: floorOpen ? 'var(--turmeric-d)' : 'var(--ink-2)' }}
        >
          <Table2 size={20} aria-hidden />
          <span className="leading-none">Floor Map</span>
          {floorOpen && (
            <span className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-8 rounded-full" style={{ background: 'var(--turmeric)' }} />
          )}
        </button>

        <button
          type="button"
          disabled
          title="QR Approvals is currently disabled"
          className="relative flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-bold opacity-40 cursor-not-allowed select-none"
          style={{ minHeight: 58, color: 'var(--ink-3)' }}
        >
          <span className="relative">
            <ClipboardList size={20} aria-hidden />
            {pendingApprovals > 0 && (
              <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 grid place-items-center rounded-full text-[9px] font-extrabold text-white opacity-60" style={{ background: 'var(--ink-3)' }}>
                {pendingApprovals}
              </span>
            )}
          </span>
          <span className="leading-none">Approvals</span>
        </button>

        <button
          onClick={() => setMoreOpen(true)}
          className="relative flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-bold transition"
          style={{ minHeight: 58, color: moreOpen ? 'var(--turmeric-d)' : 'var(--ink-2)' }}
        >
          <Menu size={20} aria-hidden />
          <span className="leading-none">More</span>
          {moreOpen && (
            <span className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-8 rounded-full" style={{ background: 'var(--turmeric)' }} />
          )}
        </button>
      </nav>

      {/* ── Mobile "More" drawer — staff, shift, floor map, approvals, dashboard ── */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-[700]" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 anim-fade" style={{ background: 'var(--scrim)' }} onClick={() => setMoreOpen(false)} />
          <aside className="anim-drawer-l absolute left-0 top-0 h-full w-[82%] max-w-[285px] flex flex-col gap-2 p-3 overflow-y-auto no-scrollbar"
            style={{ background: 'var(--paper-2)', borderRight: '1px solid var(--line)', paddingTop: 'calc(0.75rem + env(safe-area-inset-top))', paddingLeft: 'calc(0.75rem + env(safe-area-inset-left))' }}>
            <div className="flex items-center justify-between gap-2 pb-0.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-10 h-6 shrink-0 overflow-hidden flex items-center justify-center">
                  <img src="/logo chaya one.png" alt="ChayaOne" className="brand-logo w-full h-full object-contain" />
                </div>
                <span className="font-display font-bold text-[15px] truncate">{(outlet.name.split('—')[0] ?? '').trim()}</span>
              </div>
              <ThemeToggle />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full grid place-items-center text-[10px] font-extrabold text-white" style={{ background: 'linear-gradient(135deg, var(--turmeric), var(--clay))' }}>{currentStaff.name[0]}</span>
              <span className="text-[12px] font-bold">{currentStaff.name}</span>
              <span className="pill" style={{ padding: '1px 6px', fontSize: '9.5px', textTransform: 'capitalize' }}>
                {currentStaff.roles && currentStaff.roles.length > 1 ? currentStaff.roles.join(' + ') : currentStaff.role}
              </span>
            </div>
            <ShiftStatus />
            <div className="flex flex-col gap-1">
              <BusinessDayHeaderBadge />
              <ServerSyncCard onManualSync={refreshTables} compact />
            </div>
            <div className="flex flex-col gap-1 pt-0.5">
              {canAccess(currentStaff, 'dashboard') && (
                <a href="/dashboard" onClick={handleDashboardClick} className="flex items-center gap-2 px-2.5 py-2 rounded-xl font-bold text-[13px]" style={{ background: 'var(--paper-3)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}>
                  <LayoutDashboard size={16} aria-hidden /> Dashboard
                </a>
              )}
              <button onClick={() => { setMoreOpen(false); setFloorOpen(true); }} className="flex items-center gap-2 px-2.5 py-2 rounded-xl border-[1.5px] border-dashed font-bold text-[13px]" style={{ borderColor: 'var(--line-2)', color: 'var(--ink-2)' }}>
                <Table2 size={16} aria-hidden /> Floor map &amp; tables
              </button>
              <button
                type="button"
                disabled
                title="QR Approvals is currently disabled"
                className="relative flex items-center gap-2 px-2.5 py-2 rounded-xl font-bold text-[13px] opacity-40 cursor-not-allowed select-none text-left"
                style={{ background: 'var(--paper-3)', border: '1px solid var(--line)', color: 'var(--ink-3)' }}
              >
                <ClipboardList size={16} aria-hidden /> QR Approvals
                {pendingApprovals > 0 && (
                  <span className="ml-auto min-w-[20px] h-[20px] px-1.5 grid place-items-center rounded-full text-[10px] font-extrabold text-white tnum opacity-60" style={{ background: 'var(--ink-3)' }} aria-label={`${pendingApprovals} pending`}>{pendingApprovals}</span>
                )}
              </button>
              {showInstallApp && (
                <button onClick={() => { setMoreOpen(false); staffInstall.promptInstall(); }} className="flex items-center gap-2 px-2.5 py-2 rounded-xl font-bold text-[13px]" style={{ background: 'var(--paper-3)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}>
                  <Download size={16} aria-hidden /> {staffInstall.iosHint ? 'Add app to Home Screen' : 'Install the Staff App'}
                </button>
              )}
            </div>
            <a href="/api/auth/logout" className="flex items-center gap-2 px-2.5 py-2 rounded-xl font-bold text-[13px] mt-auto" style={{ background: 'var(--paper-3)', border: '1px solid var(--line)', color: 'var(--ink-3)' }}>
              <LogOut size={16} aria-hidden /> Log out
            </a>
          </aside>
        </div>
      )}

      {/* T-Billing Terminal Modal — pre-warmed & kept mounted for instant 0ms latency */}
      {tBillingMounted && (
        <div
          className={`fixed inset-0 z-[9500] flex flex-col bg-black transition-opacity duration-150 ${
            showTBilling ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none -z-50'
          }`}
          style={{
            visibility: showTBilling ? 'visible' : 'hidden',
          }}
        >
          <div className="flex items-center justify-between p-3 border-b border-white/10 shrink-0">
            <h2 className="text-white font-bold text-sm flex items-center gap-2"><Table2 size={16} /> T-Billing Terminal</h2>
            <button onClick={() => setShowTBilling(false)} className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center font-bold cursor-pointer">
              <X size={16} />
            </button>
          </div>
          <div className="relative flex-1 w-full h-full bg-[var(--paper)] rounded-t-lg overflow-hidden">
            {!tBillingLoaded && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-paper">
                <div className="w-9 h-9 border-3 border-turmeric/30 border-t-turmeric rounded-full animate-spin mb-2.5" />
                <span className="text-xs font-bold text-ink">Opening T-Billing Terminal…</span>
                <span className="text-[10px] text-ink-3">Preparing tables & orders</span>
              </div>
            )}
            <iframe
              ref={tBillingIframeRef}
              src="/t-billing"
              onLoad={() => setTBillingLoaded(true)}
              className="absolute inset-0 w-full h-full border-none"
              title="T-Billing Terminal"
            />
          </div>
        </div>
      )}

      {/* Midnight / Business Day Extension Prompt */}
      <BusinessDayPrompt currentStaff={currentStaff} />
    </>
  );
}

/**
 * Cart contents shared by the desktop right rail and the mobile bottom-sheet:
 * the scrollable line list (with empty state) + the totals / discount / SC block.
 * The action buttons (Send to KOT / Charge) stay with each caller so desktop and
 * mobile can emphasise them differently. Qty steppers are 44px on phones, 32px at md+.
 */
function CartBody({
  cart, bill, outlet, discountPct, discountFlatPaise, scPct,
  setDiscountPct, setDiscountFlatPaise, setScPct, bump,
  editingNoteKey, noteDraft, setNoteDraft, openNoteEdit, saveNote, removeNote, quickNotes,
}: {
  cart: Line[];
  bill: ReturnType<typeof computeBill>;
  outlet: Outlet;
  discountPct: number;
  discountFlatPaise: number;
  scPct: number;
  setDiscountPct: (n: number) => void;
  setDiscountFlatPaise: (n: number) => void;
  setScPct: (n: number) => void;
  bump: (key: string, d: number) => void;
  editingNoteKey: string | null;
  noteDraft: string;
  setNoteDraft: (s: string) => void;
  openNoteEdit: (line: Line) => void;
  saveNote: (key: string) => void;
  removeNote: (key: string) => void;
  quickNotes: string[];
}) {
  const DISC_PRESETS = [0, 10];
  // discount-entry unit: percentage vs a flat ₹ amount (selector sits by the field)
  const [discMode, setDiscMode] = useState<'pct' | 'amt'>(discountFlatPaise > 0 ? 'amt' : 'pct');
  // presets are % → clear any flat amount; % clamps 0–100, flat clamps 0–subtotal
  const applyPreset = (d: number) => { setDiscMode('pct'); setDiscountFlatPaise(0); setDiscountPct(d); };
  const clampPct = (v: string) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0; };
  const clampFlat = (v: string) => { const p = Math.round(Number(v) * 100); return Number.isFinite(p) ? Math.min(bill.subtotalPaise, Math.max(0, p)) : 0; };
  function pickMode(m: 'pct' | 'amt') {
    // switching unit clears the other so only one discount kind is ever live
    if (m === 'pct') setDiscountFlatPaise(0); else setDiscountPct(0);
    setDiscMode(m);
  }
  return (
    <>
      <div className="flex-1 overflow-auto flex flex-col gap-2 min-h-0">
        {!cart.length ? (
          <div className="grid place-content-center text-center h-full gap-2 py-8" style={{ color: 'var(--ink-3)' }}>
            <Coffee size={40} className="mx-auto opacity-40" aria-hidden /><p>Tap items to build the ticket.</p>
          </div>
        ) : cart.map((l) => (
          <div key={l.key} className="flex flex-col gap-1.5 p-2.5 rounded-[14px] border" style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }}>
            <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
              <div className="min-w-0 pr-1">
                <div className="font-bold text-[13.5px] leading-tight truncate">{l.name}</div>
                {l.notes && editingNoteKey !== l.key && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md text-left leading-snug" style={{ background: 'color-mix(in srgb, var(--turmeric) 18%, var(--paper))', color: 'var(--turmeric-d)' }}>
                      ↳ {l.notes}
                    </span>
                    <button type="button" onClick={() => openNoteEdit(l)} className="text-[10px] font-bold underline hover:opacity-80" style={{ color: 'var(--ink-3)' }}>Edit</button>
                    <button type="button" onClick={() => removeNote(l.key)} className="text-[11px] font-bold leading-none px-1 hover:text-red-500" style={{ color: 'var(--ink-3)' }} title="Remove note">×</button>
                  </div>
                )}
                {!l.notes && editingNoteKey !== l.key && (
                  <button type="button" onClick={() => openNoteEdit(l)} className="inline-flex items-center gap-1 text-[11px] font-semibold mt-1 transition hover:opacity-80" style={{ color: 'var(--turmeric-d)' }}>
                    <Plus size={11} /> <span>Add note (e.g. without sugar)</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => bump(l.key, -1)} aria-label={`Decrease ${l.name}`} className="w-11 h-11 md:w-8 md:h-8 grid place-items-center rounded-[9px] border" style={{ background: 'var(--paper)', borderColor: 'var(--line-2)' }}><Minus size={15} aria-hidden /></button>
                <span className="font-bold w-6 text-center tnum">{l.qty}</span>
                <button onClick={() => bump(l.key, 1)} aria-label={`Increase ${l.name}`} className="w-11 h-11 md:w-8 md:h-8 grid place-items-center rounded-[9px] border" style={{ background: 'var(--paper)', borderColor: 'var(--line-2)' }}><Plus size={15} aria-hidden /></button>
              </div>
              <span className="text-[13.5px] tnum" style={{ fontFamily: 'var(--font-mono)' }}>{formatINR(l.pricePaise * l.qty)}</span>
            </div>

            {editingNoteKey === l.key && (
              <div className="mt-1 pt-1.5 border-t flex flex-col gap-1.5 anim-fade" style={{ borderColor: 'var(--line-2)' }}>
                <div className="flex flex-wrap gap-1">
                  {quickNotes.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setNoteDraft(preset)}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full border transition"
                      style={{
                        background: noteDraft === preset ? 'var(--turmeric)' : 'var(--paper)',
                        color: noteDraft === preset ? '#2A1607' : 'var(--ink-2)',
                        borderColor: 'var(--line-2)',
                      }}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="e.g. without sugar, extra hot..."
                    className="flex-1 px-2.5 py-1 text-xs rounded-lg border outline-none"
                    style={{ background: 'var(--paper)', borderColor: 'var(--line-2)' }}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveNote(l.key);
                      if (e.key === 'Escape') removeNote(l.key);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => saveNote(l.key)}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg text-white shrink-0"
                    style={{ background: 'var(--turmeric-d)' }}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!l.notes) removeNote(l.key);
                      else openNoteEdit({ ...l, notes: l.notes });
                    }}
                    className="px-2 py-1 text-xs font-medium rounded-lg shrink-0"
                    style={{ color: 'var(--ink-3)' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {cart.length > 0 && (
        <div className="border-t border-dashed mt-3 pt-3" style={{ borderColor: 'var(--line-2)' }}>
          <Row label={outlet.gstEnabled && outlet.gstInclusive ? 'Taxable value' : 'Subtotal'} val={formatINR(bill.subtotalPaise)} />
          {bill.discountPaise > 0 && <Row label={discountPct > 0 ? `Discount (${discountPct}%)` : 'Discount'} val={`− ${formatINR(bill.discountPaise)}`} accent />}
          {outlet.gstEnabled && <Row label="CGST" val={formatINR(bill.cgstPaise)} sub />}
          {outlet.gstEnabled && <Row label="SGST" val={formatINR(bill.sgstPaise)} sub />}
          {outlet.gstEnabled && outlet.gstInclusive && <div className="text-[10px] mt-0.5" style={{ color: 'var(--ink-3)' }}>Menu prices include GST</div>}
          {scPct > 0 && <Row label="Service charge" val={formatINR(bill.serviceChargePaise)} />}
          <Row label="Round-off" val={`${bill.roundOffPaise >= 0 ? '+' : '−'} ${formatINR(Math.abs(bill.roundOffPaise))}`} sub />
          <div className="flex justify-between font-extrabold font-display text-[19px] mt-2 pt-2 border-t" style={{ borderColor: 'var(--line)' }}>
            <span>Total</span><span className="tnum" style={{ fontFamily: 'var(--font-mono)' }}>{formatINR(bill.totalPaise)}</span>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {/* quick presets + service charge */}
            <div className="flex flex-wrap gap-1.5 items-center">
              {DISC_PRESETS.map((d) => <Chip key={d} on={d === discountPct && discountFlatPaise === 0} onClick={() => applyPreset(d)}>{d ? `${d}% off` : 'No disc.'}</Chip>)}
              <Chip on={scPct > 0} onClick={() => setScPct(scPct ? 0 : 5)}>+SC 5%</Chip>
            </div>
            {/* discount entry — label left, compact field + %/₹ selector aligned right */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13.5px]" style={{ color: 'var(--ink-2)' }}>Discount</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="relative w-[88px]">
                  {discMode === 'amt' && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] font-bold" style={{ color: 'var(--ink-3)' }}>₹</span>}
                  {discMode === 'pct' ? (
                    <input key="pct" type="number" min={0} max={100} step={1} inputMode="numeric"
                      value={discountPct || ''} onChange={(e) => setDiscountPct(clampPct(e.target.value))}
                      placeholder="0" aria-label="Discount percent"
                      className="w-full pl-2.5 pr-2.5 py-1.5 rounded-[9px] border text-[13.5px] outline-none tnum text-right"
                      style={{ background: 'var(--paper)', borderColor: 'var(--line-2)' }} />
                  ) : (
                    <input key="amt" type="number" min={0} step="0.01" inputMode="decimal"
                      value={discountFlatPaise ? discountFlatPaise / 100 : ''} onChange={(e) => setDiscountFlatPaise(clampFlat(e.target.value))}
                      placeholder="0" aria-label="Discount amount in rupees"
                      className="w-full pl-6 pr-2.5 py-1.5 rounded-[9px] border text-[13.5px] outline-none tnum text-right"
                      style={{ background: 'var(--paper)', borderColor: 'var(--line-2)' }} />
                  )}
                </div>
                {/* %/₹ unit selector */}
                <div className="flex rounded-[9px] p-[2px] border" style={{ background: 'var(--paper)', borderColor: 'var(--line-2)' }}>
                  {(['pct', 'amt'] as const).map((m) => (
                    <button key={m} onClick={() => pickMode(m)} aria-pressed={discMode === m} aria-label={m === 'pct' ? 'Discount by percent' : 'Discount by amount'}
                      className="w-7 py-1 rounded-[6px] text-xs font-extrabold transition"
                      style={discMode === m ? { background: 'var(--turmeric)', color: '#2a1607' } : { color: 'var(--ink-3)' }}>
                      {m === 'pct' ? '%' : '₹'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Petpooja-style live order rail: every fired ticket, colour-coded by stage. */
function LiveOrders({ tickets, now }: { tickets: LiveTicket[]; now: number }) {
  return (
    <div className="mb-3.5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[12px] font-extrabold uppercase tracking-wide" style={{ color: 'var(--ink-3)' }}>Live orders</span>
        <span className="text-[11px] font-bold" style={{ color: 'var(--ink-3)' }}>· {tickets.length} running</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tickets.map((t) => {
          const stage = posStageOf(t.status, now - t.placedAt);
          const st = STAGES[stage];
          const secs = Math.floor((now - t.placedAt) / 1000);
          return (
            <div key={t.id} className="shrink-0 rounded-[12px] border px-3 py-2 flex flex-col gap-1.5"
              style={{ background: 'var(--paper-2)', borderColor: 'var(--line)', borderLeft: `4px solid ${st.color}`, minWidth: 134 }}>
              <div className="flex items-center justify-between gap-3">
                <span className="font-display font-extrabold text-[15px]">#{t.number}</span>
                <span className="text-[11px] font-bold tnum" style={{ color: 'var(--ink-3)' }}>{fmtClock(secs)}</span>
              </div>
              <span className="text-[11px] font-bold" style={{ color: 'var(--ink-2)' }}>{t.where}</span>
              <span className="inline-flex items-center gap-1.5 self-start text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full"
                style={{ background: st.bg, color: st.color }}>
                <span className="w-[6px] h-[6px] rounded-full" style={{ background: st.color }} />
                {st.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function fmtClock(secs: number) {
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function Row({ label, val, sub, accent }: { label: string; val: string; sub?: boolean; accent?: boolean }) {
  return (
    <div className="flex justify-between py-0.5" style={{ fontSize: sub ? '12.5px' : '13.5px', color: accent ? 'var(--cardamom-d)' : sub ? 'var(--ink-3)' : 'var(--ink-2)', fontWeight: accent ? 700 : 400 }}>
      <span>{label}</span><span className="tnum" style={{ fontFamily: 'var(--font-mono)' }}>{val}</span>
    </div>
  );
}

function Chip({ children, on, onClick }: { children: React.ReactNode; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="px-3 py-1.5 rounded-full text-xs font-bold border transition"
      style={on ? { background: 'var(--turmeric)', color: '#2a1607', borderColor: 'var(--turmeric-d)' } : { background: 'var(--paper)', borderColor: 'var(--line)', color: 'var(--ink-2)' }}>
      {children}
    </button>
  );
}

function Modal({ children, title, onClose, headerAction }: { children: React.ReactNode; title: string; onClose: () => void; headerAction?: React.ReactNode }) {
  return (
    <div onClick={onClose} className="fixed inset-0 z-[800] grid place-items-center p-5" style={{ background: 'rgba(30,18,10,.5)', backdropFilter: 'blur(6px)' }}>
      <div onClick={(e) => e.stopPropagation()} className="w-[min(560px,100%)] max-h-[90vh] overflow-auto" style={{ background: 'var(--paper-2)', borderRadius: '30px', boxShadow: 'var(--sh-3)', border: '1px solid var(--line)' }}>
        <div className="flex items-center gap-3 px-5 py-[18px] border-b" style={{ borderColor: 'var(--line)' }}>
          <h3 className="text-[19px]">{title}</h3>
          {headerAction && <div className="ml-auto mr-2">{headerAction}</div>}
          <button onClick={onClose} className={`${headerAction ? '' : 'ml-auto '}w-[34px] h-[34px] rounded-[10px] border text-xl shrink-0`} style={{ background: 'var(--paper)', borderColor: 'var(--line)' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * Optional customer (name + phone) attached to the current ticket, shared by the
 * desktop rail and the mobile sheet. Collapsed to a single "＋ Add customer" button
 * until opened; a phone reaches the CRM (order history + loyalty), name-only just
 * prints on the receipt. Removing clears both fields.
 */
function CustomerField({ name, phone, open, setName, setPhone, setOpen, compact = false }: {
  name: string; phone: string; open: boolean;
  setName: (v: string) => void; setPhone: (v: string) => void; setOpen: (v: boolean) => void;
  compact?: boolean;
}) {
  const has = !!(name.trim() || phone.trim());
  const digits = phone.replace(/\D/g, '');
  const [matches, setMatches] = useState<{ id: string; name: string | null; phone: string | null; points: number; visitCount: number }[]>([]);

  useEffect(() => {
    if (!open || digits.length < 3) { setMatches([]); return; }
    const ac = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        const r = await fetch(`/api/pos/customer/lookup?phone=${encodeURIComponent(phone)}`, { signal: ac.signal });
        if (!r.ok) return;
        const d = await r.json();
        const found = typeof d?.customer?.name === 'string' ? d.customer.name.trim() : '';
        if (found && (!name.trim() || name.trim().toLowerCase() === 'customer' || name.trim().toLowerCase() === 'guest')) setName(found);
        setMatches(Array.isArray(d?.customers) ? d.customers : []);
      } catch { }
    }, 250);
    return () => { ac.abort(); window.clearTimeout(t); };
  }, [digits, name, open, phone, setName]);

  return (
    <div className={compact ? 'mt-2' : 'mt-3.5'}>
      {!open && !has ? (
        <button onClick={() => setOpen(true)}
          className="w-full py-2.5 rounded-[12px] border border-dashed font-bold text-[13px] inline-flex items-center justify-center gap-1.5"
          style={{ borderColor: 'var(--line)', color: 'var(--ink-2)', background: 'var(--paper)' }}>
          <User size={15} aria-hidden /> ＋ Add customer <span style={{ color: 'var(--ink-3)' }}>(optional)</span>
        </button>
      ) : (
        <div className="rounded-[14px] border p-3" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
          <div className="flex items-center mb-2">
            <span className="inline-flex items-center gap-1.5 font-bold text-[13px]" style={{ color: 'var(--ink-2)' }}><User size={14} aria-hidden /> Customer</span>
            <button onClick={() => { setName(''); setPhone(''); setOpen(false); }} className="ml-auto text-xs font-bold" style={{ color: 'var(--ink-3)' }}>Remove</button>
          </div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name"
            className="w-full mb-2 px-3 py-2 rounded-[10px] border text-sm outline-none" style={{ borderColor: 'var(--line)', background: 'var(--paper-2)' }} />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (for loyalty & history)" inputMode="tel"
            className="w-full px-3 py-2 rounded-[10px] border text-sm outline-none" style={{ borderColor: 'var(--line)', background: 'var(--paper-2)' }} />
          {matches.length > 0 && (
            <div className="mt-2 rounded-[10px] border overflow-hidden" style={{ borderColor: 'var(--line)', background: 'var(--paper-2)' }}>
              {matches.map((m) => (
                <button key={m.id} type="button" onClick={() => { setName(m.name ?? ''); setPhone(m.phone ?? phone); setMatches([]); }}
                  className="w-full px-3 py-2 text-left text-[12.5px] font-bold border-b last:border-b-0"
                  style={{ borderColor: 'var(--line)', color: 'var(--ink-2)' }}>
                  <span>{m.name ?? 'Guest'}</span>
                  <span className="ml-2 tnum" style={{ color: 'var(--ink-3)' }}>{m.phone}</span>
                  <span className="ml-2" style={{ color: 'var(--cardamom-d)' }}>{m.points} pts · {m.visitCount} visits</span>
                </button>
              ))}
            </div>
          )}
          {digits.length >= 8 && !name.trim() && (
            <p className="mt-1.5 text-[11px] font-bold" style={{ color: 'var(--ink-3)' }}>New customer name will be saved with this phone.</p>
          )}
        </div>
      )}
    </div>
  );
}

function ChargeModal({
  total,
  busy,
  initialName = '',
  initialPhone = '',
  upiConfig,
  onClose,
  onConfirm,
}: {
  total: number;
  busy: boolean;
  initialName?: string;
  initialPhone?: string;
  upiConfig?: any;
  onClose: () => void;
  onConfirm: (m: 'cash' | 'upi' | 'card', tip: number, opts: { customer: { name: string; phone: string } | null; print: boolean }) => void;
}) {
  const [method, setMethod] = useState<'cash' | 'upi' | 'card'>('upi');
  const [tip, setTip] = useState(0);
  const [print, setPrint] = useState(true);
  const [upiQrUrl, setUpiQrUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (method !== 'upi' || !upiConfig?.upiId) {
      setUpiQrUrl(null);
      return;
    }
    const finalAmountPaise = total + tip;
    if (finalAmountPaise <= 0) {
      setUpiQrUrl(null);
      return;
    }
    try {
      const res = generateAuthoritativeUpiUri({
        upiId: upiConfig.upiId,
        payeeName: upiConfig.payeeName,
        amountPaise: finalAmountPaise,
        merchantCode: upiConfig.merchantCode,
        transactionRef: `CHAYA-${Date.now().toString(36).toUpperCase()}`,
        notes: 'Order payment',
      });
      if (res.valid && res.uri) {
        generateQrDataUrl(res.uri, { scale: 4, margin: 2 })
          .then((url) => {
            if (active) setUpiQrUrl(url);
          })
          .catch(() => {
            if (active) setUpiQrUrl(null);
          });
      } else {
        if (active) setUpiQrUrl(null);
      }
    } catch {
      if (active) setUpiQrUrl(null);
    }

    return () => {
      active = false;
    };
  }, [method, total, tip, upiConfig]);

  // seed from any customer attached on the ticket panel (so charge reflects it, editable here)
  const [showCust, setShowCust] = useState(!!(initialName || initialPhone));
  const [custName, setCustName] = useState(initialName);
  const [custPhone, setCustPhone] = useState(initialPhone);
  const customer = custName.trim() || custPhone.trim() ? { name: custName.trim(), phone: custPhone.trim() } : null;
  const custDigits = custPhone.replace(/\D/g, '');
  const [custMatches, setCustMatches] = useState<{ id: string; name: string | null; phone: string | null; points: number; visitCount: number }[]>([]);

  useEffect(() => {
    if (!showCust || custDigits.length < 3) { setCustMatches([]); return; }
    const ac = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        const r = await fetch(`/api/pos/customer/lookup?phone=${encodeURIComponent(custPhone)}`, { signal: ac.signal });
        if (!r.ok) return;
        const d = await r.json();
        const found = typeof d?.customer?.name === 'string' ? d.customer.name.trim() : '';
        if (found && (!custName.trim() || custName.trim().toLowerCase() === 'customer' || custName.trim().toLowerCase() === 'guest')) setCustName(found);
        setCustMatches(Array.isArray(d?.customers) ? d.customers : []);
      } catch { }
    }, 250);
    return () => { ac.abort(); window.clearTimeout(t); };
  }, [custDigits, custName, custPhone, showCust]);

  return (
    <Modal title="Charge" onClose={onClose}>
      <div className="flex justify-between items-baseline px-[22px] py-[18px]">
        <span className="font-semibold" style={{ color: 'var(--ink-2)' }}>Amount due</span>
        <span className="font-display font-extrabold text-[34px] tnum">{formatINR(total + tip)}</span>
      </div>
      <div className="flex items-center gap-2 px-[22px] pb-4 flex-wrap">
        <span className="font-bold text-[13px] mr-1" style={{ color: 'var(--ink-2)' }}>Tip</span>
        {[0, 2000, 5000, 10000].map((t) => (
          <Chip key={t} on={t === tip} onClick={() => setTip(t)}>{t ? formatINR(t) : 'No tip'}</Chip>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 px-[22px]">
        {(['upi', 'cash', 'card'] as const).map((m) => {
          const PI = PAY_ICON[m];
          return (
            <button key={m} onClick={() => setMethod(m)} aria-pressed={method === m} className="flex flex-col items-center gap-1.5 py-3.5 rounded-[14px] border-[1.5px] font-bold text-[12.5px]"
              style={method === m ? { background: 'color-mix(in srgb, var(--turmeric) 14%, var(--paper-3))', borderColor: 'var(--turmeric)', color: 'var(--turmeric-d)' } : { background: 'var(--paper)', borderColor: 'var(--line)', color: 'var(--ink-2)' }}>
              <PI size={22} aria-hidden />{m.toUpperCase()}
            </button>
          );
        })}
      </div>
      <div className="grid place-items-center py-[22px] min-h-[120px]">
        {method === 'upi' && (
          <div className="text-center flex flex-col items-center">
            <div className="w-[140px] h-[140px] rounded-[14px] p-2 flex items-center justify-center bg-white" style={{ boxShadow: 'var(--sh-2)' }}>
              {upiQrUrl ? (
                <img src={upiQrUrl} alt="Scan to pay" className="w-full h-full object-contain" />
              ) : (
                <QrCode size={86} color="#111" aria-hidden />
              )}
            </div>
            <p className="mt-2 text-sm font-bold">Scan &amp; Pay {formatINR(total + tip)}</p>
            {upiConfig?.upiId ? (
              <p className="text-[11px] font-mono mt-0.5" style={{ color: 'var(--ink-3)' }}>{upiConfig.upiId}</p>
            ) : (
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-3)' }}>Configure UPI ID in Dashboard Settings</p>
            )}
          </div>
        )}
        {method === 'cash' && <p className="font-bold">Collect {formatINR(total + tip)} in cash</p>}
        {method === 'card' && <p className="font-bold">Tap / insert card on terminal…</p>}
      </div>

      {/* customer details (optional) */}
      <div className="px-[22px] pb-1">
        {!showCust ? (
          <button onClick={() => setShowCust(true)} className="w-full py-2.5 rounded-[12px] border border-dashed font-bold text-[13px]"
            style={{ borderColor: 'var(--line)', color: 'var(--ink-2)', background: 'var(--paper)' }}>
            ＋ Add customer details (optional)
          </button>
        ) : (
          <div className="rounded-[14px] border p-3" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
            <div className="flex items-center mb-2">
              <span className="font-bold text-[13px]" style={{ color: 'var(--ink-2)' }}>Customer details</span>
              <button onClick={() => { setShowCust(false); setCustName(''); setCustPhone(''); }} className="ml-auto text-xs font-bold" style={{ color: 'var(--ink-3)' }}>Remove</button>
            </div>
            <input value={custName} onChange={(e) => setCustName(e.target.value)} placeholder="Name"
              className="w-full mb-2 px-3 py-2 rounded-[10px] border text-sm" style={{ borderColor: 'var(--line)', background: 'var(--paper-2)' }} />
            <input value={custPhone} onChange={(e) => setCustPhone(e.target.value)} placeholder="Phone" inputMode="tel"
              className="w-full px-3 py-2 rounded-[10px] border text-sm" style={{ borderColor: 'var(--line)', background: 'var(--paper-2)' }} />
            {custMatches.length > 0 && (
              <div className="mt-2 rounded-[10px] border overflow-hidden" style={{ borderColor: 'var(--line)', background: 'var(--paper-2)' }}>
                {custMatches.map((m) => (
                  <button key={m.id} type="button" onClick={() => { setCustName(m.name ?? ''); setCustPhone(m.phone ?? custPhone); setCustMatches([]); }}
                    className="w-full px-3 py-2 text-left text-[12.5px] font-bold border-b last:border-b-0"
                    style={{ borderColor: 'var(--line)', color: 'var(--ink-2)' }}>
                    <span>{m.name ?? 'Guest'}</span>
                    <span className="ml-2 tnum" style={{ color: 'var(--ink-3)' }}>{m.phone}</span>
                    <span className="ml-2" style={{ color: 'var(--cardamom-d)' }}>{m.points} pts · {m.visitCount} visits</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* print receipt toggle */}
      <label className="flex items-center gap-2.5 px-[22px] py-3 cursor-pointer select-none">
        <input type="checkbox" checked={print} onChange={(e) => setPrint(e.target.checked)} className="w-[18px] h-[18px] accent-[var(--turmeric)]" />
        <span className="inline-flex items-center gap-1.5 font-bold text-[13px]" style={{ color: 'var(--ink-2)' }}><Printer size={15} aria-hidden /> Print receipt after payment</span>
      </label>

      <button disabled={busy} onClick={() => onConfirm(method, tip, { customer, print })} className="btn btn-primary block m-[22px]" style={{ width: 'calc(100% - 44px)' }}>
        {busy ? 'Saving…' : `Confirm payment · ${formatINR(total + tip)}`}
      </button>
    </Modal>
  );
}
