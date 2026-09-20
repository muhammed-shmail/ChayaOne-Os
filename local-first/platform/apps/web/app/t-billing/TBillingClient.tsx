'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { formatINR, computeBill } from '@cafeos/core';
import type { ReceiptConfig, ReceiptPaperWidth } from '@/lib/receipt';
import type { KitchenWorkflowConfig } from '@/lib/kitchenWorkflow';
import type { UpiPaymentConfig } from '@/lib/print/upi';
import type { ReceiptInputData } from '@/lib/print/receipt-formatter';
import ReceiptPreviewModal from '@/components/receipt/ReceiptPreviewModal';
import {
  Table2, Search, RefreshCw, Printer, Receipt, ArrowLeft,
  X, User, Smartphone, CreditCard,
  Lock, DollarSign, History, HelpCircle
} from 'lucide-react';
import { LocalPrinterClient } from '@/lib/printer-client';
import { subscribeStaff } from '@/lib/realtime-client';
import { hasRole, hasPermission, canDiscount, canSettle } from '@/lib/rbac';

export type TableDto = { id: string; label: string; seats: number; state: string; floorId: string | null };

interface TBillingProps {
  outlet: {
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
    upiConfig?: UpiPaymentConfig;
    kitchenWorkflow: KitchenWorkflowConfig;
    gstConfig?: any;
  };
  staff: {
    id: string;
    name: string;
    role: string;
    roles?: string[];
    permissions?: any;
    effectivePermissions?: string[];
  };
  tables: TableDto[];
  initialOrders?: any[];
}

export default function TBillingClient({ outlet, staff, tables, initialOrders = [] }: TBillingProps) {
  // Views: 'queue' (Ready to Bill) | 'workspace' (Billing Active Order) | 'completed' (Settled Result) | 'history' (Past Bills)
  const [view, setView] = useState<'queue' | 'workspace' | 'completed' | 'history'>('queue');

  // Search & Filter state for Ready-to-Bill queue
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'unpaid' | 'ready' | 'takeaway' | 'completed'>('ready');
  const [orders, setOrders] = useState<any[]>(initialOrders);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Active Billing Order
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  // Discount state
  const [discountType, setDiscountType] = useState<'pct' | 'flat'>('pct');
  const [discountVal, setDiscountVal] = useState<string>('0');

  // Customer state
  const [custName, setCustName] = useState<string>('Walk-in Customer');
  const [custPhone, setCustPhone] = useState<string>('');
  const [custGstin, setCustGstin] = useState<string>('');

  // Payment state
  const [payTab, setPayTab] = useState<'cash' | 'upi' | 'card' | 'split'>('cash');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [upiRef, setUpiRef] = useState<string>('');
  const [cardRef, setCardRef] = useState<string>('');
  
  // Split payment state
  const [splitCash, setSplitCash] = useState<string>('0');
  const [splitUpi, setSplitUpi] = useState<string>('0');
  const [splitCard, setSplitCard] = useState<string>('0');

  // Settlement Result state
  const [settledResult, setSettledResult] = useState<any | null>(null);
  const [settleBusy, setSettleBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Receipt Modal preview state
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [previewOrderOverride, setPreviewOrderOverride] = useState<any | null>(null);

  // Keyboard shortcut help modal state
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Billing History state
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [historySearch, setHistorySearch] = useState('');
  const [historyRange, setHistoryRange] = useState('today');
  const [historyLoading, setHistoryLoading] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selectedOrderIndex, setSelectedOrderIndex] = useState<number>(0);
  const orderCardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [currentStaff, setCurrentStaff] = useState(staff);
  useEffect(() => {
    setCurrentStaff(staff);
  }, [staff]);

  const isManagerOrOwner = hasRole(currentStaff, ['owner', 'manager']);
  const canApplyDiscount = canDiscount(currentStaff);

  // Exit T-Billing (notifies parent if in iframe or modal, or navigates back)
  const handleExit = useCallback(() => {
    if (typeof window !== 'undefined') {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'close-t-billing' }, '*');
      } else if (window.opener) {
        window.close();
      } else if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = '/dashboard';
      }
    }
  }, []);

  // Toast Helper
  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Load Orders
  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const d = await res.json();
        setOrders(d.orders || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  // Load History
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/t-billing/history?q=${encodeURIComponent(historySearch)}&range=${historyRange}`);
      if (res.ok) {
        const d = await res.json();
        setHistoryList(d.items || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  }, [historySearch, historyRange]);

  // Realtime subscription for instant updates
  useEffect(() => {
    loadOrders();
    return subscribeStaff((msg) => {
      if (msg.type === 'order.new' || msg.type === 'order.updated' || msg.type === 'order.pending' || msg.type === 'table.transferred') {
        loadOrders();
      }
      if (msg.type === 'staff.updated' && (!currentStaff.id || msg.staffId === currentStaff.id)) {
        fetch('/api/auth/me')
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d?.staff) {
              setCurrentStaff((prev) => ({ ...prev, ...d.staff }));
            }
          })
          .catch(() => {});
      }
    });
  }, [loadOrders, currentStaff.id]);

  useEffect(() => {
    if (view === 'history') loadHistory();
  }, [view, loadHistory]);

  // Filtered Orders Queue
  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (filter !== 'completed' && o.status === 'settled') return false;
      if (filter === 'completed' && o.status !== 'settled') return false;
      if (filter === 'unpaid' && o.status === 'settled') return false;
      if (filter === 'ready' && (o.status === 'settled' || o.status === 'cancelled')) return false;
      if (filter === 'takeaway' && o.type !== 'takeaway') return false;

      if (!q) return true;
      const numStr = String(o.number);
      const tableLabel = (o.table?.label || '').toLowerCase();
      const custNameStr = (o.customer?.name || '').toLowerCase();
      const custPhoneStr = o.customer?.phone || '';
      return (
        numStr.includes(q) ||
        tableLabel.includes(q) ||
        custNameStr.includes(q) ||
        custPhoneStr.includes(q)
      );
    });
  }, [orders, search, filter]);

  // Select Order for Billing Workspace
  const startBilling = (order: any) => {
    if (order.status === 'cancelled') {
      flash('Cancelled orders cannot be billed.');
      return;
    }
    setSelectedOrder(order);
    setDiscountType('pct');
    setDiscountVal('0');
    setCustName(order.customer?.name || 'Walk-in Customer');
    setCustPhone(order.customer?.phone || '');
    setCustGstin('');
    setPayTab('cash');
    setCashReceived('');
    setUpiRef('');
    setCardRef('');
    setSplitCash('0');
    setSplitUpi('0');
    setSplitCard('0');
    setView('workspace');
  };

  // Keep selected index valid when filtered orders list changes
  useEffect(() => {
    if (filteredOrders.length === 0) {
      setSelectedOrderIndex(-1);
    } else if (selectedOrderIndex < 0 || selectedOrderIndex >= filteredOrders.length) {
      setSelectedOrderIndex(0);
    }
  }, [filteredOrders.length, selectedOrderIndex]);

  // Smoothly scroll active card into view during keyboard navigation
  useEffect(() => {
    if (view === 'queue' && selectedOrderIndex >= 0 && orderCardRefs.current[selectedOrderIndex]) {
      orderCardRefs.current[selectedOrderIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    }
  }, [selectedOrderIndex, view]);

  // Keyboard Shortcuts (F2: Search, F4: Payment, F6: Print, F8: Settle, Esc: Back/Exit, Arrows & Enter: Bill Navigation)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      
      if (e.key === 'F4') {
        e.preventDefault();
        if (view === 'workspace') {
          const cashEl = document.getElementById('cash-received-input');
          if (cashEl) cashEl.focus();
        }
        return;
      }
      
      if (e.key === 'F6') {
        e.preventDefault();
        if (view === 'workspace' || view === 'completed') {
          handlePrintReceipt();
        }
        return;
      }
      
      if (e.key === 'F8') {
        e.preventDefault();
        if (view === 'workspace' && selectedOrder && !settleBusy) {
          handleSettleOrder();
        }
        return;
      }
      
      if (e.key === 'Escape') {
        if (receiptModalOpen) setReceiptModalOpen(false);
        else if (shortcutsOpen) setShortcutsOpen(false);
        else if (view === 'workspace') setView('queue');
        else if (view === 'completed') setView('queue');
        else if (view === 'history') setView('queue');
        else if (view === 'queue') handleExit();
        return;
      }

      // If a modal is open, don't intercept queue navigation
      if (receiptModalOpen || shortcutsOpen) return;

      // When in Ready-to-Bill queue view:
      if (view === 'queue') {
        const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
        const isSearchFocused = activeEl === searchInputRef.current;
        const isOtherInputFocused = activeEl && activeEl !== searchInputRef.current && (
          activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT'
        );

        if (isOtherInputFocused) return;

        // In search bar:
        if (isSearchFocused) {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            searchInputRef.current?.blur();
            if (filteredOrders.length > 0) {
              setSelectedOrderIndex(0);
              orderCardRefs.current[0]?.focus();
            }
            return;
          }
          if (e.key === 'Enter') {
            if (filteredOrders.length > 0 && selectedOrderIndex >= 0 && selectedOrderIndex < filteredOrders.length) {
              e.preventDefault();
              startBilling(filteredOrders[selectedOrderIndex]);
            }
            return;
          }
          // Note: Tab and standard keys operate as normal inside search input
          return;
        }

        // In queue cards list (Tab key is intentionally NOT intercepted so desktop Tab flows normally):
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
          if (filteredOrders.length > 0) {
            e.preventDefault();
            setSelectedOrderIndex((prev) => {
              const next = prev < 0 ? 0 : Math.min(prev + 1, filteredOrders.length - 1);
              orderCardRefs.current[next]?.focus();
              return next;
            });
          }
          return;
        }

        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
          if (filteredOrders.length > 0) {
            e.preventDefault();
            setSelectedOrderIndex((prev) => {
              const next = Math.max((prev < 0 ? 0 : prev) - 1, 0);
              orderCardRefs.current[next]?.focus();
              return next;
            });
          }
          return;
        }

        if (e.key === 'Enter') {
          if (filteredOrders.length > 0 && selectedOrderIndex >= 0 && selectedOrderIndex < filteredOrders.length) {
            e.preventDefault();
            startBilling(filteredOrders[selectedOrderIndex]);
          }
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, receiptModalOpen, shortcutsOpen, selectedOrder, settleBusy, filteredOrders, selectedOrderIndex, handleExit]);

  // Compute Bill Summary Dynamically
  const calculatedBill = useMemo(() => {
    if (!selectedOrder) return { subtotalPaise: 0, discountPaise: 0, taxablePaise: 0, cgstPaise: 0, sgstPaise: 0, igstPaise: 0, roundOffPaise: 0, totalPaise: 0 };
    
    const lines = (selectedOrder.items || []).map((i: any) => ({
      pricePaise: i.unitPricePaise,
      modPaise: ((i.modifiers as any) || []).reduce((s: number, m: any) => s + (m.pricePaise || 0), 0),
      gstRate: Number(i.item?.gstRate ?? 5.00),
      qty: i.qty,
    }));

    const pct = discountType === 'pct' ? parseFloat(discountVal) || 0 : 0;
    const flatVal = discountType === 'flat' ? parseFloat(discountVal) || 0 : 0;
    const flatPaise = Math.round(flatVal * 100);

    return computeBill(lines, {
      discountPct: pct,
      discountFlatPaise: flatPaise,
      gstEnabled: outlet.gstEnabled,
      gstInclusive: outlet.gstInclusive,
    });
  }, [selectedOrder, discountType, discountVal, outlet]);

  // Cash Change Calculation
  const cashReceivedPaise = Math.round((parseFloat(cashReceived) || 0) * 100);
  const cashChangePaise = Math.max(0, cashReceivedPaise - calculatedBill.totalPaise);

  // Split Payment Total Calculation
  const splitTotalPaise =
    Math.round((parseFloat(splitCash) || 0) * 100) +
    Math.round((parseFloat(splitUpi) || 0) * 100) +
    Math.round((parseFloat(splitCard) || 0) * 100);
  const splitRemainingPaise = Math.max(0, calculatedBill.totalPaise - splitTotalPaise);

  // Settle Order Handler
  const handleSettleOrder = async () => {
    if (!selectedOrder || settleBusy) return;

    let payments: any[] = [];
    if (payTab === 'cash') {
      if (cashReceivedPaise < calculatedBill.totalPaise) {
        flash(`Please enter at least ${formatINR(calculatedBill.totalPaise)} received amount.`);
        return;
      }
      payments = [{ method: 'cash', amountPaise: calculatedBill.totalPaise }];
    } else if (payTab === 'upi') {
      payments = [{ method: 'upi', amountPaise: calculatedBill.totalPaise, providerRef: upiRef || null }];
    } else if (payTab === 'card') {
      payments = [{ method: 'card', amountPaise: calculatedBill.totalPaise, providerRef: cardRef || null }];
    } else if (payTab === 'split') {
      if (splitRemainingPaise > 0) {
        flash(`Split payment total must cover the remaining ${formatINR(splitRemainingPaise)}.`);
        return;
      }
      if (parseFloat(splitCash) > 0) payments.push({ method: 'cash', amountPaise: Math.round(parseFloat(splitCash) * 100) });
      if (parseFloat(splitUpi) > 0) payments.push({ method: 'upi', amountPaise: Math.round(parseFloat(splitUpi) * 100) });
      if (parseFloat(splitCard) > 0) payments.push({ method: 'card', amountPaise: Math.round(parseFloat(splitCard) * 100) });
    }

    setSettleBusy(true);
    try {
      const res = await fetch('/api/t-billing/settle', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          orderId: selectedOrder.id,
          discountPct: discountType === 'pct' ? parseFloat(discountVal) || 0 : undefined,
          discountFlatPaise: discountType === 'flat' ? Math.round((parseFloat(discountVal) || 0) * 100) : undefined,
          payments,
          customerName: custName,
          customerPhone: custPhone,
          customerGstin: custGstin,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        flash(data.error === 'discount_permission_denied' ? 'Custom discounts require Manager or Owner role.' : 'Failed to complete bill.');
        return;
      }

      setSettledResult(data);
      flash('Bill completed & invoice generated! 🎉');
      setView('completed');
      loadOrders();
    } catch (err) {
      console.error(err);
      flash('Network error settling bill.');
    } finally {
      setSettleBusy(false);
    }
  };

  // Unified Receipt Input Data for Preview Modal and Thermal Printing
  const previewData: ReceiptInputData | null = useMemo(() => {
    if (previewOrderOverride) return previewOrderOverride;
    if (settledResult?.receipt) {
      const r = settledResult.receipt;
      return {
        storeName: r.storeName || outlet.name,
        logoUrl: r.logoUrl || outlet.receipt.logoUrl,
        address: r.address || outlet.address,
        phone: r.phone || outlet.receipt.phone,
        gstin: r.gstin || outlet.gstin,
        timezone: r.timezone || outlet.timezone || 'Asia/Kolkata',
        orderNumber: r.orderNumber,
        tableLabel: r.tableLabel || r.tableName,
        orderType: r.orderType,
        placedAt: r.placedAt || new Date(),
        settledAt: r.settledAt,
        items: (r.items || []).map((i: any) => ({
          name: i.name,
          qty: i.qty,
          unitPricePaise: i.unitPricePaise,
          totalPaise: i.totalPaise,
          modifiers: i.modifiers,
          notes: i.notes,
        })),
        subtotalPaise: r.subtotalPaise,
        discountPaise: r.discountPaise,
        cgstPaise: r.cgstPaise,
        sgstPaise: r.sgstPaise,
        roundOffPaise: r.roundOffPaise,
        totalPaise: r.totalPaise,
        paymentMethod: r.paymentMethod,
        receiptConfig: outlet.receipt,
        upiConfig: outlet.upiConfig,
      };
    }
    if (!selectedOrder) return null;
    return {
      storeName: outlet.name,
      logoUrl: outlet.receipt.logoUrl,
      address: outlet.address,
      phone: outlet.receipt.phone,
      gstin: outlet.gstin,
      timezone: outlet.timezone || 'Asia/Kolkata',
      orderNumber: selectedOrder.number,
      tableLabel: selectedOrder.table?.label ?? null,
      orderType: selectedOrder.type,
      placedAt: selectedOrder.placedAt || new Date(),
      items: (selectedOrder.items || []).map((i: any) => ({
        name: i.nameSnapshot,
        qty: i.qty,
        unitPricePaise: i.unitPricePaise,
        totalPaise: i.unitPricePaise * i.qty,
        modifiers: Array.isArray(i.modifiers) ? i.modifiers : [],
        notes: i.notes ?? null,
      })),
      subtotalPaise: calculatedBill.subtotalPaise,
      discountPaise: calculatedBill.discountPaise,
      cgstPaise: calculatedBill.cgstPaise,
      sgstPaise: calculatedBill.sgstPaise,
      roundOffPaise: calculatedBill.roundOffPaise,
      totalPaise: calculatedBill.totalPaise,
      paymentMethod: payTab.toUpperCase(),
      receiptConfig: outlet.receipt,
      upiConfig: outlet.upiConfig,
    };
  }, [previewOrderOverride, settledResult, selectedOrder, calculatedBill, outlet, payTab]);

  // Print Receipt Handler (Dispatches to local desktop client and server-side print queue)
  const handlePrintReceipt = async (receiptDataOverride?: any, widthOverride?: ReceiptPaperWidth) => {
    const activeData = receiptDataOverride || previewData;
    const targetOrderId = previewOrderOverride ? (previewOrderOverride as any).orderId : (selectedOrder?.id || settledResult?.order?.id);

    // 1. Try local desktop thermal printer agent
    const desktopOk = await LocalPrinterClient.requestPrint({
      ...(activeData || {}),
      paperWidth: widthOverride || outlet.receipt.paperWidth || '80mm',
    }).catch(() => false);

    // 2. Queue print job on server for LAN thermal printer
    let queueOk = false;
    if (targetOrderId) {
      try {
        const res = await fetch('/api/print/reprint', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            orderId: targetOrderId,
            type: 'RECEIPT',
          }),
        });
        queueOk = res.ok;
      } catch (err) {
        console.warn('LAN print dispatch failed:', err);
      }
    }

    if (desktopOk || queueOk) {
      flash('Receipt sent to thermal printer 🖨️');
    } else {
      // Fallback to browser print window if no hardware printer reachable
      window.print();
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans" style={{ background: 'var(--paper)', color: 'var(--ink)' }}>
      {/* ── TOP HEADER BAR ── */}
      <header className="flex items-center justify-between px-5 py-3.5 border-b sticky top-0 z-40 backdrop-blur" style={{ borderColor: 'var(--line)', background: 'var(--paper-2)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl grid place-items-center font-bold" style={{ background: 'var(--paper-3)', color: 'var(--gold)' }}>
            <Table2 size={22} />
          </div>
          <div>
            <h1 className="font-display font-bold text-xl leading-none flex items-center gap-2">
              T-Billing Terminal
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full uppercase" style={{ background: 'var(--gold)/10', color: 'var(--gold-d)' }}>
                {currentStaff.roles && currentStaff.roles.length > 1 ? currentStaff.roles.join(' + ') : currentStaff.role}
              </span>
            </h1>
            <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--ink-3)' }}>
              Instant Billing & Customer Receipts · {outlet.name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* View Toggles */}
          {view === 'queue' && (
            <button onClick={() => setView('history')} className="btn btn-sm inline-flex items-center gap-1.5" style={{ background: 'var(--paper-3)', borderColor: 'var(--line)', color: 'var(--ink)' }}>
              <History size={15} /> Billing History
            </button>
          )}
          {view !== 'queue' && (
            <button onClick={() => setView('queue')} className="btn btn-sm inline-flex items-center gap-1.5" style={{ background: 'var(--paper-3)', borderColor: 'var(--line)', color: 'var(--ink)' }}>
              <ArrowLeft size={15} /> Back to Queue
            </button>
          )}

          <button onClick={loadOrders} disabled={ordersLoading} className="btn btn-icon btn-sm btn-ghost" title="Refresh orders">
            <RefreshCw size={16} className={ordersLoading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setShortcutsOpen(true)} className="btn btn-icon btn-sm btn-ghost" title="Keyboard shortcuts (F2, F4, F6, F8)">
            <HelpCircle size={16} />
          </button>
          <button
            type="button"
            onClick={handleExit}
            className="btn btn-sm btn-ghost inline-flex items-center gap-1 cursor-pointer hover:opacity-80"
            title="Exit T-Billing (Esc)"
          >
            <X size={16} /> Exit
          </button>
        </div>
      </header>

      {/* ── MAIN CONTENT WORKSPACE ── */}
      <main className="flex-1 p-4 md:p-6 max-w-[1600px] w-full mx-auto flex flex-col">
        {/* ---------------- 1. READY TO BILL ORDER QUEUE VIEW ---------------- */}
        {view === 'queue' && (
          <div className="flex flex-col gap-5 flex-1">
            {/* Search & Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl border" style={{ background: 'var(--paper-2)', borderColor: 'var(--line)' }}>
              <div className="relative flex-1 min-w-[280px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-3)]" size={18} />
                <input
                  ref={searchInputRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search order #, table, customer, phone (Press F2)..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none transition"
                  style={{ background: 'var(--paper-3)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                />
              </div>

              {/* Quick Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {[
                  { key: 'ready', label: 'Ready to Bill' },
                  { key: 'all', label: 'All Open' },
                  { key: 'takeaway', label: 'Takeaway' },
                  { key: 'completed', label: 'Completed' },
                ].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      filter === f.key ? 'bg-[var(--gold)] text-[#2A1607]' : 'bg-[var(--paper-3)] text-[var(--ink-2)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Ready to Bill Orders Cards Grid */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-sm uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
                  Ready to Bill Orders ({filteredOrders.length})
                </h2>
                <span className="text-xs font-bold flex items-center gap-2" style={{ color: 'var(--ink-3)' }}>
                  <span className="hidden sm:inline">Use <kbd className="px-1.5 py-0.5 rounded bg-[var(--paper-3)] border border-[var(--line)] font-mono text-[10px]">↑</kbd> <kbd className="px-1.5 py-0.5 rounded bg-[var(--paper-3)] border border-[var(--line)] font-mono text-[10px]">↓</kbd> or <kbd className="px-1.5 py-0.5 rounded bg-[var(--paper-3)] border border-[var(--line)] font-mono text-[10px]">Tab</kbd> to navigate, <kbd className="px-1.5 py-0.5 rounded bg-[var(--gold)] text-[#2A1607] font-mono text-[10px] font-bold">Enter</kbd> to bill</span>
                </span>
              </div>

              {filteredOrders.length === 0 ? (
                <div className="lux-card p-12 text-center flex flex-col items-center justify-center gap-3">
                  <Receipt size={48} className="text-[var(--ink-3)] opacity-40" />
                  <p className="font-bold text-lg">No orders ready for billing</p>
                  <p className="text-xs text-[var(--ink-3)] max-w-sm">
                    Orders created in POS or waiter mobile app will appear here automatically for instant billing.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredOrders.map((o, index) => {
                    const isSelected = selectedOrderIndex === index;
                    const isCancelled = o.status === 'cancelled';
                    const isSettled = o.status === 'settled';
                    const itemCount = (o.items || []).reduce((sum: number, i: any) => sum + i.qty, 0);

                    return (
                      <div
                        key={o.id}
                        ref={(el) => { orderCardRefs.current[index] = el; }}
                        tabIndex={0}
                        role="button"
                        aria-pressed={isSelected}
                        onClick={() => setSelectedOrderIndex(index)}
                        onDoubleClick={() => startBilling(o)}
                        onFocus={() => setSelectedOrderIndex(index)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            startBilling(o);
                          }
                        }}
                        className={`lux-card card-glow p-5 flex flex-col justify-between transition-all cursor-pointer outline-none relative ${
                          isSelected
                            ? 'ring-2 ring-[var(--gold)] border-[var(--gold)] shadow-xl shadow-[var(--gold)]/15 -translate-y-1 bg-[var(--paper-2)]'
                            : isCancelled
                            ? 'opacity-50'
                            : 'hover:-translate-y-0.5'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-display font-extrabold text-xl">#{o.number}</span>
                                {isSelected && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--gold)] text-[#2A1607] flex items-center gap-1 shadow-sm">
                                    ↵ Enter
                                  </span>
                                )}
                              </div>
                              <p className="text-xs font-bold" style={{ color: 'var(--gold-d)' }}>
                                {o.table?.label ? `Table ${o.table.label}` : o.type === 'takeaway' ? '🥡 Takeaway' : '📍 Direct'}
                              </p>
                            </div>
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                                isSettled
                                  ? 'bg-[var(--ok-bg)] text-[var(--ok-ink)]'
                                  : isCancelled
                                  ? 'bg-[var(--danger-bg)] text-[var(--danger-ink)]'
                                  : 'bg-[var(--warn-bg)] text-[var(--warn-ink)]'
                              }`}
                            >
                              {isSettled ? 'Paid ✓' : isCancelled ? 'Cancelled' : 'Ready to Bill'}
                            </span>
                          </div>

                          <div className="space-y-1 text-xs mb-4" style={{ color: 'var(--ink-2)' }}>
                            <p className="font-medium truncate">👤 {o.customer?.name || 'Walk-in Customer'}</p>
                            <p className="truncate">🍽️ {itemCount} item{itemCount === 1 ? '' : 's'}</p>
                            <p className="text-[11px]" style={{ color: 'var(--ink-3)' }} suppressHydrationWarning>
                              🕒 {new Date(o.placedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-[var(--line)] flex items-center justify-between gap-2">
                          <span className="font-display font-extrabold text-lg">{formatINR(o.totalPaise)}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startBilling(o);
                            }}
                            disabled={isCancelled}
                            className={`btn text-xs px-3.5 py-2 rounded-xl transition ${
                              isSelected ? 'btn-lux ring-2 ring-[var(--gold)]/50' : 'btn-lux'
                            }`}
                          >
                            {isSettled ? 'View Bill' : 'Bill Now ↵'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---------------- 2. DEDICATED BILLING WORKSPACE VIEW ---------------- */}
        {view === 'workspace' && selectedOrder && (
          <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
            {/* LEFT PANEL: Bill Details & Itemized Table */}
            <div className="flex-1 flex flex-col gap-4 min-w-0">
              <div className="lux-card p-5 flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Bill Header Info */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[var(--line)]">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--gold-d)]" suppressHydrationWarning>
                      Invoice Preview: INV-{new Date().getFullYear()}-{String(selectedOrder.number).padStart(6, '0')}
                    </span>
                    <h2 className="font-display text-2xl font-bold mt-0.5">
                      Order #{selectedOrder.number} · {selectedOrder.table?.label ? `Table ${selectedOrder.table.label}` : 'Takeaway'}
                    </h2>
                  </div>
                  <div className="text-right text-xs text-[var(--ink-3)]">
                    <p className="font-bold text-[var(--ink)]">Staff: {staff.name}</p>
                    <p suppressHydrationWarning>{new Date().toLocaleDateString('en-IN')} · {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>

                {/* Itemized Bill Table */}
                <div className="flex-1 overflow-y-auto my-4 pr-1">
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--paper-3)] text-[var(--ink-3)] text-xs uppercase tracking-wider sticky top-0">
                      <tr>
                        <th className="px-3 py-2.5 text-left font-bold">Item</th>
                        <th className="px-3 py-2.5 text-center font-bold">Qty</th>
                        <th className="px-3 py-2.5 text-right font-bold">Rate</th>
                        <th className="px-3 py-2.5 text-right font-bold">Tax</th>
                        <th className="px-3 py-2.5 text-right font-bold">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--line)]">
                      {(selectedOrder.items || []).map((i: any) => {
                        const gstRate = Number(i.item?.gstRate ?? 5);
                        const lineTotal = i.unitPricePaise * i.qty;
                        return (
                          <tr key={i.id} className="hover:bg-[var(--paper-3)] transition-colors">
                            <td className="px-3 py-3 font-semibold text-[var(--ink)]">
                              {i.nameSnapshot}
                              {i.notes && <p className="text-[11px] text-[var(--ink-3)] italic">{i.notes}</p>}
                            </td>
                            <td className="px-3 py-3 text-center font-bold tnum">{i.qty}</td>
                            <td className="px-3 py-3 text-right font-medium tnum">{formatINR(i.unitPricePaise)}</td>
                            <td className="px-3 py-3 text-right text-xs text-[var(--ink-3)] tnum">{gstRate}% GST</td>
                            <td className="px-3 py-3 text-right font-bold tnum">{formatINR(lineTotal)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Add Discount Control */}
                <div className="pt-3 border-t border-[var(--line)]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--ink-2)' }}>
                      <DollarSign size={14} /> Add Authorized Discount
                    </span>
                    {!canApplyDiscount && (
                      <span className="text-[11px] font-bold text-[var(--warn-ink)] flex items-center gap-1">
                        <Lock size={12} /> Requires Discount Permission
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 items-center">
                    <div className="flex rounded-xl border border-[var(--line)] bg-[var(--paper-3)] p-1">
                      <button
                        disabled={!canApplyDiscount}
                        onClick={() => setDiscountType('pct')}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                          discountType === 'pct' ? 'bg-[var(--gold)] text-[#2A1607]' : 'text-[var(--ink-3)]'
                        }`}
                      >
                        % Off
                      </button>
                      <button
                        disabled={!canApplyDiscount}
                        onClick={() => setDiscountType('flat')}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                          discountType === 'flat' ? 'bg-[var(--gold)] text-[#2A1607]' : 'text-[var(--ink-3)]'
                        }`}
                      >
                        Flat ₹
                      </button>
                    </div>
                    <input
                      type="number"
                      disabled={!canApplyDiscount}
                      value={discountVal}
                      onChange={(e) => setDiscountVal(e.target.value)}
                      placeholder={discountType === 'pct' ? '10' : '50'}
                      className="w-32 px-3.5 py-2 rounded-xl border text-sm outline-none font-bold tnum disabled:opacity-50"
                      style={{ background: 'var(--paper-2)', borderColor: 'var(--line)', color: 'var(--ink)' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT PANEL: Bill Summary & Payment Workspace */}
            <div className="w-full lg:w-[460px] flex flex-col gap-4 shrink-0">
              <div className="lux-card p-5 space-y-4">
                {/* Bill Summary Breakdown */}
                <h3 className="font-display font-bold text-lg border-b border-[var(--line)] pb-2">BILL SUMMARY</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-[var(--ink-2)]">
                    <span>Subtotal</span>
                    <span className="font-mono">{formatINR(calculatedBill.subtotalPaise)}</span>
                  </div>
                  {calculatedBill.discountPaise > 0 && (
                    <div className="flex justify-between font-bold text-[var(--ok-ink)]">
                      <span>Discount</span>
                      <span className="font-mono">- {formatINR(calculatedBill.discountPaise)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[var(--ink-2)]">
                    <span>Taxable Amount</span>
                    <span className="font-mono">{formatINR(calculatedBill.subtotalPaise - calculatedBill.discountPaise)}</span>
                  </div>
                  {outlet.gstEnabled && (
                    <>
                      <div className="flex justify-between text-xs text-[var(--ink-3)]">
                        <span>CGST</span>
                        <span className="font-mono">{formatINR(calculatedBill.cgstPaise)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-[var(--ink-3)]">
                        <span>SGST</span>
                        <span className="font-mono">{formatINR(calculatedBill.sgstPaise)}</span>
                      </div>
                    </>
                  )}
                  {calculatedBill.roundOffPaise !== 0 && (
                    <div className="flex justify-between text-xs text-[var(--ink-3)]">
                      <span>Round Off</span>
                      <span className="font-mono">{formatINR(calculatedBill.roundOffPaise)}</span>
                    </div>
                  )}
                </div>

                {/* Grand Total Callout */}
                <div className="p-4 rounded-2xl text-center bg-[var(--paper-3)] border border-[var(--gold)]">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--gold-d)]">Grand Total Payable</span>
                  <div className="font-display text-4xl font-extrabold mt-1 tracking-tight text-[var(--gold-d)] tnum">
                    {formatINR(calculatedBill.totalPaise)}
                  </div>
                </div>

                {/* Customer Details Input */}
                <div className="space-y-2 pt-2 border-t border-[var(--line)]">
                  <span className="text-xs font-bold text-[var(--ink-2)] flex items-center gap-1.5">
                    <User size={14} /> Customer Information
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={custName}
                      onChange={(e) => setCustName(e.target.value)}
                      placeholder="Walk-in Customer"
                      className="w-full px-3 py-2 rounded-xl border text-xs outline-none"
                      style={{ background: 'var(--paper-2)', borderColor: 'var(--line)' }}
                    />
                    <input
                      value={custPhone}
                      onChange={(e) => setCustPhone(e.target.value)}
                      placeholder="Phone number"
                      className="w-full px-3 py-2 rounded-xl border text-xs outline-none"
                      style={{ background: 'var(--paper-2)', borderColor: 'var(--line)' }}
                    />
                  </div>
                </div>

                {/* Payment Methods */}
                <div className="space-y-3 pt-2 border-t border-[var(--line)]">
                  <span className="text-xs font-bold text-[var(--ink-2)]">SELECT PAYMENT METHOD</span>
                  <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-[var(--paper-3)] border border-[var(--line)]">
                    {(['cash', 'upi', 'card', 'split'] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setPayTab(m)}
                        className={`py-2 rounded-lg text-xs font-bold uppercase transition ${
                          payTab === m ? 'bg-[var(--gold)] text-[#2A1607]' : 'text-[var(--ink-2)]'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>

                  {/* CASH PAYMENT WORKSPACE */}
                  {payTab === 'cash' && (
                    <div className="space-y-3 p-3.5 rounded-xl border bg-[var(--paper-2)]" style={{ borderColor: 'var(--line)' }}>
                      <div>
                        <label className="text-xs font-bold text-[var(--ink-3)] block mb-1">Amount Received (₹)</label>
                        <input
                          id="cash-received-input"
                          type="number"
                          value={cashReceived}
                          onChange={(e) => setCashReceived(e.target.value)}
                          placeholder={(calculatedBill.totalPaise / 100).toString()}
                          className="w-full px-3.5 py-2.5 rounded-xl border text-lg font-bold outline-none tnum"
                          style={{ background: 'var(--paper-3)', borderColor: 'var(--line)', color: 'var(--ink)' }}
                        />
                      </div>

                      {/* Quick Denomination Chips */}
                      <div className="flex gap-2">
                        {[
                          Math.ceil(calculatedBill.totalPaise / 100),
                          Math.ceil(calculatedBill.totalPaise / 100 / 100) * 100 + 100,
                          500,
                          2000,
                        ].map((amt, idx) => (
                          <button
                            key={idx}
                            onClick={() => setCashReceived(amt.toString())}
                            className="flex-1 py-1.5 rounded-lg text-xs font-bold border border-[var(--line)] bg-[var(--paper-3)] hover:border-[var(--gold)]"
                          >
                            ₹{amt}
                          </button>
                        ))}
                      </div>

                      {/* Change Output */}
                      <div className="flex justify-between items-center p-3 rounded-xl bg-[var(--paper-3)] border border-[var(--line)]">
                        <span className="text-xs font-bold text-[var(--ink-3)]">Return Change:</span>
                        <span className="font-display font-extrabold text-xl text-[var(--ok-ink)] tnum">
                          {formatINR(cashChangePaise)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* UPI PAYMENT WORKSPACE */}
                  {payTab === 'upi' && (
                    <div className="space-y-3 p-3.5 rounded-xl border bg-[var(--paper-2)] text-center" style={{ borderColor: 'var(--line)' }}>
                      <Smartphone size={32} className="mx-auto text-[var(--gold)]" />
                      <p className="text-sm font-bold">UPI QR / Mobile Payment</p>
                      <p className="text-xs text-[var(--ink-3)]">Pay {formatINR(calculatedBill.totalPaise)} to outlet QR</p>
                      <input
                        value={upiRef}
                        onChange={(e) => setUpiRef(e.target.value)}
                        placeholder="UPI Ref / Txn ID (optional)"
                        className="w-full px-3.5 py-2 rounded-xl border text-xs outline-none"
                        style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }}
                      />
                    </div>
                  )}

                  {/* CARD PAYMENT WORKSPACE */}
                  {payTab === 'card' && (
                    <div className="space-y-3 p-3.5 rounded-xl border bg-[var(--paper-2)] text-center" style={{ borderColor: 'var(--line)' }}>
                      <CreditCard size={32} className="mx-auto text-[var(--gold)]" />
                      <p className="text-sm font-bold">Card POS Machine</p>
                      <input
                        value={cardRef}
                        onChange={(e) => setCardRef(e.target.value)}
                        placeholder="Card Auth / Txn Ref Number"
                        className="w-full px-3.5 py-2 rounded-xl border text-xs outline-none"
                        style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }}
                      />
                    </div>
                  )}

                  {/* SPLIT PAYMENT WORKSPACE */}
                  {payTab === 'split' && (
                    <div className="space-y-2 p-3.5 rounded-xl border bg-[var(--paper-2)]" style={{ borderColor: 'var(--line)' }}>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-[var(--ink-3)]">Cash (₹)</label>
                          <input type="number" value={splitCash} onChange={(e) => setSplitCash(e.target.value)} className="w-full p-2 rounded-lg border text-xs font-bold tnum" style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }} />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-[var(--ink-3)]">UPI (₹)</label>
                          <input type="number" value={splitUpi} onChange={(e) => setSplitUpi(e.target.value)} className="w-full p-2 rounded-lg border text-xs font-bold tnum" style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }} />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-[var(--ink-3)]">Card (₹)</label>
                          <input type="number" value={splitCard} onChange={(e) => setSplitCard(e.target.value)} className="w-full p-2 rounded-lg border text-xs font-bold tnum" style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }} />
                        </div>
                      </div>
                      <div className="flex justify-between text-xs font-bold pt-2 border-t border-[var(--line)]">
                        <span>Remaining:</span>
                        <span style={{ color: splitRemainingPaise > 0 ? 'var(--warn-ink)' : 'var(--ok-ink)' }}>{formatINR(splitRemainingPaise)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Final Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    onClick={() => setReceiptModalOpen(true)}
                    className="btn btn-ghost text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-1.5"
                  >
                    <Receipt size={16} /> Preview Receipt
                  </button>

                  <button
                    disabled={settleBusy}
                    onClick={handleSettleOrder}
                    className="btn btn-lux text-xs font-extrabold py-3 rounded-xl flex items-center justify-center gap-1.5"
                  >
                    <Printer size={16} /> {settleBusy ? 'Completing…' : 'Complete & Print (F8)'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- 3. PAYMENT COMPLETED SCREEN VIEW ---------------- */}
        {view === 'completed' && settledResult && (
          <div className="lux-card p-8 max-w-xl mx-auto w-full my-auto text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-[var(--ok-bg)] text-[var(--ok-ink)] grid place-items-center mx-auto text-3xl">
              ✓
            </div>
            <div>
              <h2 className="font-display text-3xl font-extrabold">Payment Completed 🎉</h2>
              <p className="text-sm font-bold text-[var(--gold-d)] mt-1">Invoice: {settledResult.invoiceNo}</p>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--paper-3)] border border-[var(--line)] space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--ink-3)]">Order Number:</span>
                <span className="font-bold">#{settledResult.order.number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--ink-3)]">Total Amount Paid:</span>
                <span className="font-bold font-mono">{formatINR(settledResult.bill.totalPaise)}</span>
              </div>
              {settledResult.changePaise > 0 && (
                <div className="flex justify-between font-bold text-[var(--ok-ink)]">
                  <span>Return Change:</span>
                  <span className="font-mono">{formatINR(settledResult.changePaise)}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2">
              <button onClick={() => handlePrintReceipt(settledResult.receipt)} className="btn btn-ghost py-3 text-xs font-bold flex items-center justify-center gap-1">
                <Printer size={15} /> Reprint Receipt
              </button>
              <button onClick={() => setView('queue')} className="btn btn-lux py-3 text-xs font-bold flex items-center justify-center gap-1 col-span-2">
                + New Bill (Queue)
              </button>
            </div>
          </div>
        )}

        {/* ---------------- 4. BILLING HISTORY VIEW ---------------- */}
        {view === 'history' && (
          <div className="lux-card p-6 flex-1 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-4">
              <h2 className="font-display font-bold text-xl flex items-center gap-2">
                <History size={20} className="text-[var(--gold)]" /> Billing History & Invoices
              </h2>
              <div className="flex items-center gap-2">
                <input
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search invoice, customer..."
                  className="px-3.5 py-2 rounded-xl border text-xs outline-none"
                  style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }}
                />
                <button onClick={loadHistory} className="btn btn-sm btn-ghost"><RefreshCw size={15} /></button>
              </div>
            </div>

            <div className="overflow-x-auto flex-1">
              <table className="w-full text-sm">
                <thead className="bg-[var(--paper-3)] text-[var(--ink-3)] text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold">Invoice #</th>
                    <th className="px-4 py-3 text-left font-bold">Order #</th>
                    <th className="px-4 py-3 text-left font-bold">Table / Type</th>
                    <th className="px-4 py-3 text-left font-bold">Customer</th>
                    <th className="px-4 py-3 text-left font-bold">Method</th>
                    <th className="px-4 py-3 text-right font-bold">Amount</th>
                    <th className="px-4 py-3 text-right font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {historyList.map((h) => (
                    <tr key={h.id} className="hover:bg-[var(--paper-3)] transition-colors">
                      <td className="px-4 py-3.5 font-mono font-bold text-[var(--gold-d)]">{h.invoiceNo}</td>
                      <td className="px-4 py-3.5 font-bold">#{h.number}</td>
                      <td className="px-4 py-3.5 text-xs text-[var(--ink-2)]">{h.tableName}</td>
                      <td className="px-4 py-3.5 font-medium">{h.customerName}</td>
                      <td className="px-4 py-3.5 text-xs font-bold">{h.paymentMethods}</td>
                      <td className="px-4 py-3.5 text-right font-bold font-mono">{formatINR(h.totalPaise)}</td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => {
                            const histData = {
                              orderId: h.id,
                              storeName: outlet.name,
                              logoUrl: outlet.receipt.logoUrl,
                              address: outlet.address,
                              phone: outlet.receipt.phone,
                              gstin: outlet.gstin,
                              timezone: outlet.timezone || 'Asia/Kolkata',
                              orderNumber: h.number,
                              tableLabel: h.tableName,
                              orderType: h.orderType || 'dine_in',
                              placedAt: h.placedAt || new Date(),
                              settledAt: h.settledAt,
                              items: (h.items || []).map((i: any) => ({
                                name: i.nameSnapshot || i.name,
                                qty: i.qty,
                                unitPricePaise: i.unitPricePaise || 0,
                                totalPaise: i.totalPaise || ((i.unitPricePaise || 0) * i.qty),
                                modifiers: i.modifiers,
                                notes: i.notes,
                              })),
                              subtotalPaise: h.subtotalPaise || h.totalPaise,
                              discountPaise: h.discountPaise || 0,
                              cgstPaise: h.cgstPaise || 0,
                              sgstPaise: h.sgstPaise || 0,
                              totalPaise: h.totalPaise,
                              paymentMethod: h.paymentMethods,
                              isReprint: true,
                              receiptConfig: outlet.receipt,
                              upiConfig: outlet.upiConfig,
                            };
                            setPreviewOrderOverride(histData as any);
                            setReceiptModalOpen(true);
                          }}
                          className="btn btn-sm btn-ghost text-xs font-bold inline-flex items-center gap-1"
                        >
                          <Printer size={14} /> Preview / Reprint
                        </button>
                      </td>
                    </tr>
                  ))}
                  {historyList.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-[var(--ink-3)]">No billing history found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ── PRODUCTION THERMAL RECEIPT PREVIEW MODAL (58mm / 80mm with dynamic UPI QR) ── */}
      {previewData && (
        <ReceiptPreviewModal
          isOpen={receiptModalOpen}
          onClose={() => {
            setReceiptModalOpen(false);
            setPreviewOrderOverride(null);
          }}
          data={previewData}
          isReprint={Boolean(previewOrderOverride?.isReprint || view === 'completed' || view === 'history')}
          onPrint={async (width) => {
            await handlePrintReceipt(undefined, width);
          }}
          onReprint={async (width) => {
            const orderId = previewOrderOverride ? (previewOrderOverride as any).orderId : (selectedOrder?.id || settledResult?.order?.id);
            if (orderId) {
              const res = await fetch('/api/print/reprint', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ orderId, type: 'RECEIPT' }),
              });
              if (!res.ok) {
                throw new Error('Thermal printer is offline or failed to reprint.');
              }
              flash('Reprint dispatched to billing receipt printer 🖨️');
            }
          }}
        />
      )}

      {/* ── KEYBOARD SHORTCUTS HELP MODAL ── */}
      {shortcutsOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShortcutsOpen(false)}>
          <div className="lux-card p-6 max-w-md w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-bold text-xl flex items-center gap-2">
              <HelpCircle size={20} className="text-[var(--gold)]" /> Cashier Keyboard Shortcuts
            </h3>
            <div className="space-y-2 text-xs">
              {[
                ['F2', 'Focus Order Search Bar'],
                ['↑ / ↓ / ← / →', 'Navigate Ready Bills'],
                ['Enter', 'Open Selected Bill for Cashier Billing'],
                ['Tab', 'Normal Desktop Navigation Between Controls'],
                ['F4', 'Focus Received Cash Input (in Workspace)'],
                ['F6', 'Print Receipt'],
                ['F8', 'Complete Payment & Settle Bill'],
                ['Esc', 'Back to Queue / Exit T-Billing'],
              ].map(([key, desc]) => (
                <div key={key} className="flex justify-between items-center p-2 rounded-xl bg-[var(--paper-3)] border border-[var(--line)]">
                  <kbd className="px-2 py-1 rounded bg-[var(--paper-2)] border border-[var(--line)] font-mono font-bold text-xs">{key}</kbd>
                  <span className="font-semibold text-[var(--ink-2)]">{desc}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setShortcutsOpen(false)} className="btn btn-lux w-full py-2.5 rounded-xl text-xs">Got it</button>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl bg-[var(--espresso)] text-white text-xs font-bold shadow-2xl animate-in slide-in-from-bottom-2">
          {toast}
        </div>
      )}
    </div>
  );
}
