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
  Lock, DollarSign, History, HelpCircle, CheckCircle2,
  Banknote, SplitSquareVertical, ChevronRight, Clock, ShoppingBag,
  Zap, Calendar, ArrowUpDown, Filter,
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
  const [view, setView] = useState<'queue' | 'workspace' | 'completed' | 'history'>('queue');

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'unpaid' | 'ready' | 'takeaway' | 'completed'>('ready');
  const [orders, setOrders] = useState<any[]>(initialOrders);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  const [discountType, setDiscountType] = useState<'pct' | 'flat'>('pct');
  const [discountVal, setDiscountVal] = useState<string>('0');

  const [custName, setCustName] = useState<string>('');
  const [custPhone, setCustPhone] = useState<string>('');
  const [custGstin, setCustGstin] = useState<string>('');
  const [custMatches, setCustMatches] = useState<{ id: string; name: string | null; phone: string | null; points: number; visitCount: number }[]>([]);
  const [printReceipt, setPrintReceipt] = useState<boolean>(true);

  const [payTab, setPayTab] = useState<'cash' | 'upi' | 'card' | 'split'>('cash');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [upiRef, setUpiRef] = useState<string>('');
  const [cardRef, setCardRef] = useState<string>('');

  const [splitCash, setSplitCash] = useState<string>('0');
  const [splitUpi, setSplitUpi] = useState<string>('0');
  const [splitCard, setSplitCard] = useState<string>('0');

  const [settledResult, setSettledResult] = useState<any | null>(null);
  const [settleBusy, setSettleBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [previewOrderOverride, setPreviewOrderOverride] = useState<any | null>(null);

  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const [historyList, setHistoryList] = useState<any[]>([]);
  const [historySearch, setHistorySearch] = useState('');
  const [historyRange, setHistoryRange] = useState('today');
  const [historyLoading, setHistoryLoading] = useState(false);

  // ── Date helper functions
  const getTodayDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getYesterdayDateString = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatHumanDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const target = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const todayStr = getTodayDateString();
    const yestStr = getYesterdayDateString();
    if (dateStr === todayStr) return 'Today';
    if (dateStr === yestStr) return 'Yesterday';
    return target.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // ── Completed tab sorting & calendar date state
  const [completedDate, setCompletedDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [completedRange, setCompletedRange] = useState<'today' | 'yesterday' | '7days' | 'custom' | 'all'>('today');
  const [completedSort, setCompletedSort] = useState<'desc' | 'asc'>('desc');
  const [completedMethod, setCompletedMethod] = useState<'all' | 'cash' | 'upi' | 'card'>('all');
  const [completedOrders, setCompletedOrders] = useState<any[]>([]);
  const [completedSummary, setCompletedSummary] = useState<{
    count: number;
    totalPaise: number;
    cashPaise: number;
    upiPaise: number;
    cardPaise: number;
  }>({ count: 0, totalPaise: 0, cashPaise: 0, upiPaise: 0, cardPaise: 0 });
  const [completedLoading, setCompletedLoading] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selectedOrderIndex, setSelectedOrderIndex] = useState<number>(0);
  const orderCardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [currentStaff, setCurrentStaff] = useState(staff);
  useEffect(() => {
    setCurrentStaff(staff);
  }, [staff]);

  const isManagerOrOwner = hasRole(currentStaff, ['owner', 'manager']);
  const canApplyDiscount = canDiscount(currentStaff);

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

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

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

  const loadCompletedOrders = useCallback(async () => {
    setCompletedLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      if (completedRange === 'custom') {
        if (completedDate) params.set('date', completedDate);
      } else {
        params.set('range', completedRange);
      }
      params.set('sort', completedSort);
      if (completedMethod !== 'all') params.set('method', completedMethod);

      const res = await fetch(`/api/t-billing/history?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCompletedOrders(data.items || []);
        if (data.summary) setCompletedSummary(data.summary);
      }
    } catch (err) {
      console.error('Failed to load completed orders:', err);
    } finally {
      setCompletedLoading(false);
    }
  }, [search, completedRange, completedDate, completedSort, completedMethod]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams();
      if (historySearch.trim()) params.set('q', historySearch.trim());
      if (historyRange === 'custom') {
        if (completedDate) params.set('date', completedDate);
      } else {
        params.set('range', historyRange);
      }
      params.set('sort', completedSort);
      const res = await fetch(`/api/t-billing/history?${params.toString()}`);
      if (res.ok) {
        const d = await res.json();
        setHistoryList(d.items || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  }, [historySearch, historyRange, completedDate, completedSort]);

  const openReprintModal = useCallback((order: any) => {
    if (!order) return;
    const year = new Date(order.settledAt || order.placedAt || new Date()).getFullYear();
    const invoiceNo =
      order.invoiceNo ||
      (order.payments?.[0]?.meta as any)?.invoiceNo ||
      `INV-${year}-${String(order.number).padStart(6, '0')}`;
    const paymentMethod =
      order.paymentMethods ||
      Array.from(new Set((order.payments || []).map((p: any) => String(p.method).toUpperCase()))).join(' + ') ||
      'CASH';

    const reprintData = {
      orderId: order.id,
      storeName: outlet.name,
      logoUrl: outlet.receipt.logoUrl,
      address: outlet.address,
      phone: outlet.receipt.phone,
      gstin: outlet.gstin,
      timezone: outlet.timezone || 'Asia/Kolkata',
      orderNumber: order.number,
      tableLabel: order.tableLabel ?? order.tableName ?? order.table?.label ?? null,
      orderType: order.type || 'dine_in',
      placedAt: order.placedAt || new Date(),
      settledAt: order.settledAt || new Date(),
      items: (order.items || []).map((i: any) => ({
        name: i.nameSnapshot || i.name,
        qty: i.qty,
        unitPricePaise: i.unitPricePaise || 0,
        totalPaise: i.linePaise || ((i.unitPricePaise || 0) * i.qty),
        modifiers: Array.isArray(i.modifiers) ? i.modifiers : [],
        notes: i.notes ?? null,
      })),
      subtotalPaise: order.subtotalPaise || order.totalPaise,
      discountPaise: order.discountPaise || 0,
      cgstPaise: order.cgstPaise || 0,
      sgstPaise: order.sgstPaise || 0,
      roundOffPaise: order.roundOffPaise || 0,
      totalPaise: order.totalPaise,
      paymentMethod,
      invoiceNo,
      isReprint: true,
      gstEnabled: (order.cgstPaise || 0) + (order.sgstPaise || 0) > 0,
      receiptConfig: outlet.receipt,
      upiConfig: outlet.upiConfig,
    };
    setPreviewOrderOverride(reprintData as any);
    setReceiptModalOpen(true);
  }, [outlet]);

  useEffect(() => {
    loadOrders();
    return subscribeStaff((msg) => {
      if (msg.type === 'order.new' || msg.type === 'order.updated' || msg.type === 'order.pending' || msg.type === 'table.transferred') {
        loadOrders();
        if (filter === 'completed') loadCompletedOrders();
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
  }, [loadOrders, loadCompletedOrders, filter, currentStaff.id]);

  useEffect(() => {
    const handleParentMsg = (e: MessageEvent) => {
      if (e.data && e.data.type === 't-billing-opened') {
        loadOrders();
      }
    };
    window.addEventListener('message', handleParentMsg);
    return () => window.removeEventListener('message', handleParentMsg);
  }, [loadOrders]);

  useEffect(() => {
    if (view === 'history') loadHistory();
  }, [view, loadHistory]);

  useEffect(() => {
    if (view === 'queue' && filter === 'completed') {
      loadCompletedOrders();
    }
  }, [view, filter, loadCompletedOrders]);

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

  const displayOrders = useMemo(() => {
    if (filter === 'completed') return completedOrders;
    return filteredOrders;
  }, [filter, completedOrders, filteredOrders]);

  const startBilling = (order: any) => {
    if (order.status === 'cancelled') {
      flash('Cancelled orders cannot be billed.');
      return;
    }
    if (order.status === 'settled') {
      openReprintModal(order);
      return;
    }
    setSelectedOrder(order);
    setDiscountType('pct');
    setDiscountVal('0');
    setCustName(order.customer?.name || '');
    setCustPhone(order.customer?.phone || '');
    setCustMatches([]);
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

  useEffect(() => {
    const rawDigits = custPhone.replace(/\D/g, '');
    if (rawDigits.length < 3) {
      setCustMatches([]);
      return;
    }
    const ac = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        const r = await fetch(`/api/pos/customer/lookup?phone=${encodeURIComponent(custPhone)}`, { signal: ac.signal });
        if (!r.ok) return;
        const d = await r.json();
        const found = typeof d?.customer?.name === 'string' ? d.customer.name.trim() : '';
        if (found && (!custName.trim() || custName.trim().toLowerCase() === 'walk-in customer' || custName.trim().toLowerCase() === 'customer' || custName.trim().toLowerCase() === 'guest')) {
          setCustName(found);
        }
        setCustMatches(Array.isArray(d?.customers) ? d.customers : []);
      } catch {}
    }, 250);
    return () => {
      ac.abort();
      window.clearTimeout(t);
    };
  }, [custPhone]);

  useEffect(() => {
    if (displayOrders.length === 0) {
      setSelectedOrderIndex(-1);
    } else if (selectedOrderIndex < 0 || selectedOrderIndex >= displayOrders.length) {
      setSelectedOrderIndex(0);
    }
  }, [displayOrders.length, selectedOrderIndex]);

  useEffect(() => {
    if (view === 'queue' && selectedOrderIndex >= 0 && orderCardRefs.current[selectedOrderIndex]) {
      orderCardRefs.current[selectedOrderIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    }
  }, [selectedOrderIndex, view]);

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

      if (receiptModalOpen || shortcutsOpen) return;

      if (view === 'queue') {
        const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
        const isSearchFocused = activeEl === searchInputRef.current;
        const isOtherInputFocused = activeEl && activeEl !== searchInputRef.current && (
          activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT'
        );

        if (isOtherInputFocused) return;

        if (isSearchFocused) {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            searchInputRef.current?.blur();
            if (displayOrders.length > 0) {
              setSelectedOrderIndex(0);
              orderCardRefs.current[0]?.focus();
            }
            return;
          }
          if (e.key === 'Enter') {
            if (displayOrders.length > 0 && selectedOrderIndex >= 0 && selectedOrderIndex < displayOrders.length) {
              e.preventDefault();
              const target = displayOrders[selectedOrderIndex];
              if (filter === 'completed' || target.status === 'settled') {
                openReprintModal(target);
              } else {
                startBilling(target);
              }
            }
            return;
          }
          return;
        }

        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
          if (displayOrders.length > 0) {
            e.preventDefault();
            setSelectedOrderIndex((prev) => {
              const next = prev < 0 ? 0 : Math.min(prev + 1, displayOrders.length - 1);
              orderCardRefs.current[next]?.focus();
              return next;
            });
          }
          return;
        }

        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
          if (displayOrders.length > 0) {
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
          if (displayOrders.length > 0 && selectedOrderIndex >= 0 && selectedOrderIndex < displayOrders.length) {
            e.preventDefault();
            const target = displayOrders[selectedOrderIndex];
            if (filter === 'completed' || target.status === 'settled') {
              openReprintModal(target);
            } else {
              startBilling(target);
            }
          }
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, receiptModalOpen, shortcutsOpen, selectedOrder, settleBusy, displayOrders, selectedOrderIndex, filter, openReprintModal, handleExit]);

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

  const cashReceivedPaise = Math.round((parseFloat(cashReceived) || 0) * 100);
  const cashChangePaise = Math.max(0, cashReceivedPaise - calculatedBill.totalPaise);

  const splitTotalPaise =
    Math.round((parseFloat(splitCash) || 0) * 100) +
    Math.round((parseFloat(splitUpi) || 0) * 100) +
    Math.round((parseFloat(splitCard) || 0) * 100);
  const splitRemainingPaise = Math.max(0, calculatedBill.totalPaise - splitTotalPaise);

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
          customerName: custName.trim() || 'Walk-in Customer',
          customerPhone: custPhone.trim(),
          customerGstin: custGstin.trim(),
          printReceipt,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        flash(data.error === 'discount_permission_denied' ? 'Custom discounts require Manager or Owner role.' : 'Failed to complete bill.');
        return;
      }

      setSettledResult(data);
      flash(printReceipt ? 'Bill settled & sent to printer! 🎉' : 'Bill settled & confirmed! 🎉');
      setCustName('');
      setCustPhone('');
      setCustMatches([]);
      setView('completed');
      loadOrders();
      loadCompletedOrders();
    } catch (err) {
      console.error(err);
      flash('Network error settling bill.');
    } finally {
      setSettleBusy(false);
    }
  };

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
        gstEnabled: r.gstEnabled !== undefined ? r.gstEnabled : ((r.cgstPaise || 0) + (r.sgstPaise || 0) > 0),
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
      gstEnabled: outlet.gstEnabled,
      receiptConfig: outlet.receipt,
      upiConfig: outlet.upiConfig,
    };
  }, [previewOrderOverride, settledResult, selectedOrder, calculatedBill, outlet, payTab]);

  // Deduplication guard for T-Billing print jobs
  const tbPrintInFlight = useRef<boolean>(false);

  const handlePrintReceipt = async (receiptDataOverride?: any, widthOverride?: ReceiptPaperWidth) => {
    // Deduplication: block if a print is already in flight
    if (tbPrintInFlight.current) {
      console.warn('[PRINT] T-Billing: Duplicate print blocked — already printing');
      return;
    }
    tbPrintInFlight.current = true;

    const activeData = receiptDataOverride || previewData;
    const targetOrderId = previewOrderOverride ? (previewOrderOverride as any).orderId : (selectedOrder?.id || settledResult?.order?.id);
    const paper = widthOverride || outlet.receipt.paperWidth || '80mm';
    const jobId = `tbilling-${targetOrderId || 'unknown'}-${Date.now()}`;

    console.log(`[PRINT] ── T-Billing handlePrintReceipt ──`);
    console.log(`[PRINT] Job ID   : ${jobId}`);
    console.log(`[PRINT] Order ID : ${targetOrderId || 'N/A'}`);
    console.log(`[PRINT] Paper    : ${paper}`);
    console.log(`[PRINT] Printer  : TVSE RP3200 Lite (configured receipt printer)`);
    console.log(`[PRINT] Status   : QUEUED`);

    try {
      // Path 1: Desktop App ESC/POS direct print (preferred — no Windows dialog)
      const desktopOk = await LocalPrinterClient.requestPrint({
        ...(activeData || {}),
        paperWidth: paper,
        printerName: 'TVSE RP3200 Lite',
      });

      // Path 2: LAN print queue via API (server-side ESC/POS → network printer)
      let queueOk = false;
      if (targetOrderId) {
        try {
          console.log(`[PRINT] Dispatching LAN print queue job for order: ${targetOrderId}`);
          const res = await fetch('/api/print/reprint', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ orderId: targetOrderId, type: 'RECEIPT' }),
          });
          queueOk = res.ok;
          if (queueOk) {
            console.log(`[PRINT] LAN print queue accepted job for order: ${targetOrderId}`);
          } else {
            console.warn(`[PRINT] LAN print queue returned HTTP ${res.status}`);
          }
        } catch (err) {
          console.warn('[PRINT] LAN print dispatch failed:', err);
        }
      }

      if (desktopOk || queueOk) {
        console.log(`[PRINT] Status   : PRINTING — Receipt sent to TVSE RP3200 Lite`);
        console.log(`[PRINT] Method   : ${desktopOk ? 'Desktop App ESC/POS' : 'LAN queue'}`);
        flash('Receipt sent to thermal printer 🖨️');
      } else {
        // Path 3: Fallback to OS print dialog (window.print)
        console.warn(`[PRINT] Desktop App and LAN queue both unavailable — using OS print dialog`);
        console.warn(`[PRINT] Job ID: ${jobId}`);
        console.warn(`[PRINT] Please ensure TVSE RP3200 Lite is selected in the print dialog.`);
        window.print();
      }
    } catch (err: any) {
      // Show user-friendly message, log technical detail to console
      console.error(`[PRINT ERROR] T-Billing print failed — Job ID: ${jobId}`);
      console.error(`[PRINT ERROR] Error:`, err);
      flash('Printer unavailable. Check TVSE RP3200 Lite connection and try again.');
    } finally {
      // Release dedup lock after a short delay (allow dialog to open)
      setTimeout(() => { tbPrintInFlight.current = false; }, 2000);
    }
  };


  // ── Payment method icons & labels
  const payMethods = [
    { key: 'cash', label: 'Cash', icon: Banknote },
    { key: 'upi', label: 'UPI', icon: Smartphone },
    { key: 'card', label: 'Card', icon: CreditCard },
    { key: 'split', label: 'Split', icon: SplitSquareVertical },
  ] as const;

  return (
    <div
      className="min-h-screen flex flex-col font-sans"
      style={{ background: 'var(--paper)', color: 'var(--ink)' }}
    >
      {/* ════════════════════ TOP HEADER BAR ════════════════════ */}
      <header
        className="flex items-center justify-between px-4 sm:px-6 py-3 border-b sticky top-0 z-40 backdrop-blur-md"
        style={{
          borderColor: 'var(--line)',
          background: 'color-mix(in srgb, var(--paper-2) 92%, transparent)',
          boxShadow: '0 1px 24px color-mix(in srgb, var(--espresso) 8%, transparent)',
        }}
      >
        {/* Left: Brand */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-2xl grid place-items-center shrink-0 shadow-md"
            style={{
              background: 'linear-gradient(135deg, var(--gold) 0%, var(--espresso) 120%)',
            }}
          >
            <Table2 size={20} className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display font-bold text-lg leading-tight flex flex-wrap items-center gap-1.5">
              <span style={{ color: 'var(--ink)' }}>T-Billing</span>
              <span style={{ color: 'var(--gold-d)' }}>Terminal</span>
              <span
                className="text-[10px] font-mono px-2 py-0.5 rounded-full uppercase tracking-wider"
                style={{
                  background: 'color-mix(in srgb, var(--gold) 15%, var(--paper-3))',
                  color: 'var(--gold-d)',
                  border: '1px solid color-mix(in srgb, var(--gold) 30%, transparent)',
                }}
              >
                {currentStaff.roles && currentStaff.roles.length > 1
                  ? currentStaff.roles.join(' + ')
                  : currentStaff.role}
              </span>
            </h1>
            <p className="text-[11px] font-medium truncate" style={{ color: 'var(--ink-3)' }}>
              Instant Billing · {outlet.name}
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {view === 'queue' && (
            <button
              onClick={() => setView('history')}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition hover:opacity-80 active:scale-95"
              style={{
                background: 'var(--paper-3)',
                border: '1px solid var(--line)',
                color: 'var(--ink-2)',
              }}
            >
              <History size={14} /> History
            </button>
          )}
          {view !== 'queue' && (
            <button
              onClick={() => setView('queue')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition hover:opacity-80 active:scale-95"
              style={{
                background: 'var(--paper-3)',
                border: '1px solid var(--line)',
                color: 'var(--ink-2)',
              }}
            >
              <ArrowLeft size={14} /> Queue
            </button>
          )}
          <button
            onClick={() => {
              if (filter === 'completed') loadCompletedOrders();
              else loadOrders();
            }}
            disabled={filter === 'completed' ? completedLoading : ordersLoading}
            className="w-8 h-8 rounded-xl grid place-items-center transition hover:opacity-80 active:scale-95"
            style={{ background: 'var(--paper-3)', border: '1px solid var(--line)' }}
            title="Refresh orders"
          >
            <RefreshCw size={14} className={(filter === 'completed' ? completedLoading : ordersLoading) ? 'animate-spin' : ''} style={{ color: 'var(--ink-2)' }} />
          </button>
          <button
            onClick={() => setShortcutsOpen(true)}
            className="w-8 h-8 rounded-xl grid place-items-center transition hover:opacity-80 active:scale-95"
            style={{ background: 'var(--paper-3)', border: '1px solid var(--line)' }}
            title="Keyboard shortcuts"
          >
            <HelpCircle size={14} style={{ color: 'var(--ink-2)' }} />
          </button>
          <button
            onClick={handleExit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition hover:opacity-80 active:scale-95"
            style={{
              background: 'color-mix(in srgb, var(--clay) 12%, var(--paper-3))',
              border: '1px solid color-mix(in srgb, var(--clay) 25%, transparent)',
              color: 'var(--clay)',
            }}
            title="Exit T-Billing (Esc)"
          >
            <X size={14} /> Exit
          </button>
        </div>
      </header>

      {/* ════════════════════ MAIN CONTENT ════════════════════ */}
      <main className="flex-1 p-3 sm:p-5 max-w-[1600px] w-full mx-auto flex flex-col gap-4">

        {/* ── 1. READY TO BILL QUEUE VIEW ── */}
        {view === 'queue' && (
          <div className="flex flex-col gap-4 flex-1">

            {/* Search & Filter Bar */}
            <div
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 rounded-2xl border"
              style={{
                background: 'var(--paper-2)',
                borderColor: 'var(--line)',
                boxShadow: '0 1px 8px color-mix(in srgb, var(--espresso) 4%, transparent)',
              }}
            >
              {/* Search */}
              <div className="relative flex-1">
                <Search
                  className="absolute left-3.5 top-1/2 -translate-y-1/2"
                  size={16}
                  style={{ color: 'var(--ink-3)' }}
                />
                <input
                  ref={searchInputRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search order #, table, customer... (F2)"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none transition"
                  style={{
                    background: 'var(--paper-3)',
                    border: '1px solid var(--line)',
                    color: 'var(--ink)',
                  }}
                />
              </div>

              {/* Filter chips */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { key: 'ready', label: '⚡ Ready to Bill' },
                  { key: 'all', label: '📋 All Open' },
                  { key: 'takeaway', label: '🥡 Takeaway' },
                  { key: 'completed', label: '✅ Completed' },
                ].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key as any)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95"
                    style={
                      filter === f.key
                        ? {
                            background: 'var(--gold)',
                            color: '#2A1607',
                            boxShadow: '0 2px 8px color-mix(in srgb, var(--gold) 35%, transparent)',
                          }
                        : {
                            background: 'var(--paper-3)',
                            color: 'var(--ink-2)',
                            border: '1px solid var(--line)',
                          }
                    }
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Completed Tab: Calendar Date Picker & Sorting Controls Bar ── */}
            {filter === 'completed' && (
              <div
                className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-3.5 rounded-2xl border"
                style={{
                  background: 'var(--paper-2)',
                  borderColor: 'color-mix(in srgb, var(--gold) 25%, var(--line))',
                  boxShadow: '0 2px 12px color-mix(in srgb, var(--gold) 6%, transparent)',
                }}
              >
                {/* Left: Calendar Picker & Date presets */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Calendar Date Picker Input */}
                  <label
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition hover:opacity-90 relative cursor-pointer"
                    style={{
                      background: completedRange === 'custom' ? 'color-mix(in srgb, var(--gold) 15%, var(--paper-3))' : 'var(--paper-3)',
                      borderColor: completedRange === 'custom' ? 'var(--gold)' : 'var(--line)',
                      color: 'var(--ink)',
                    }}
                    title="Click to select a date from calendar"
                  >
                    <Calendar size={14} style={{ color: 'var(--gold-d)' }} />
                    <span className="font-semibold">
                      {completedRange === 'custom'
                        ? formatHumanDate(completedDate)
                        : completedRange === 'today'
                        ? 'Today'
                        : completedRange === 'yesterday'
                        ? 'Yesterday'
                        : completedRange === '7days'
                        ? 'Last 7 Days'
                        : 'All Time'}
                    </span>
                    <input
                      type="date"
                      value={completedDate}
                      max={getTodayDateString()}
                      onChange={(e) => {
                        if (e.target.value) {
                          setCompletedDate(e.target.value);
                          setCompletedRange('custom');
                        }
                      }}
                      className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                    />
                  </label>

                  {/* Date Quick Presets */}
                  <div
                    className="flex items-center gap-1 p-1 rounded-xl border"
                    style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }}
                  >
                    {[
                      { key: 'today', label: 'Today', onClick: () => { setCompletedRange('today'); setCompletedDate(getTodayDateString()); } },
                      { key: 'yesterday', label: 'Yesterday', onClick: () => { setCompletedRange('yesterday'); setCompletedDate(getYesterdayDateString()); } },
                      { key: '7days', label: '7 Days', onClick: () => { setCompletedRange('7days'); } },
                      { key: 'all', label: 'All Time', onClick: () => { setCompletedRange('all'); } },
                    ].map((p) => {
                      const isActive = completedRange === p.key;
                      return (
                        <button
                          key={p.key}
                          onClick={p.onClick}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold transition active:scale-95"
                          style={
                            isActive
                              ? {
                                  background: 'var(--gold)',
                                  color: '#2A1607',
                                  boxShadow: '0 1px 4px color-mix(in srgb, var(--gold) 30%, transparent)',
                                }
                              : {
                                  background: 'transparent',
                                  color: 'var(--ink-2)',
                                }
                          }
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Sort Order Toggle */}
                  <button
                    onClick={() => setCompletedSort((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition hover:opacity-80 active:scale-95"
                    style={{
                      background: 'var(--paper-3)',
                      borderColor: 'var(--line)',
                      color: 'var(--ink-2)',
                    }}
                    title="Toggle sort order (Newest first / Oldest first)"
                  >
                    <ArrowUpDown size={13} style={{ color: 'var(--gold-d)' }} />
                    <span style={{ color: 'var(--ink-3)' }}>Sort:</span>
                    <span style={{ color: 'var(--ink)' }}>
                      {completedSort === 'desc' ? 'Newest First ↓' : 'Oldest First ↑'}
                    </span>
                  </button>

                  {/* Payment Method Filter Pills */}
                  <div className="hidden sm:flex items-center gap-1">
                    {[
                      { key: 'all', label: 'All' },
                      { key: 'cash', label: 'Cash' },
                      { key: 'upi', label: 'UPI' },
                      { key: 'card', label: 'Card' },
                    ].map((m) => {
                      const isActive = completedMethod === m.key;
                      return (
                        <button
                          key={m.key}
                          onClick={() => setCompletedMethod(m.key as any)}
                          className="px-2 py-1 rounded-lg text-xs font-bold transition active:scale-95"
                          style={
                            isActive
                              ? {
                                  background: 'color-mix(in srgb, var(--gold) 18%, var(--paper-3))',
                                  color: 'var(--gold-d)',
                                  border: '1px solid color-mix(in srgb, var(--gold) 35%, transparent)',
                                }
                              : {
                                  background: 'var(--paper-3)',
                                  color: 'var(--ink-3)',
                                  border: '1px solid var(--line)',
                                }
                          }
                        >
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Right: Summary Metrics for the date */}
                <div className="flex items-center gap-2 shrink-0 text-xs">
                  <div
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl border"
                    style={{
                      background: 'color-mix(in srgb, var(--cardamom) 10%, var(--paper-3))',
                      borderColor: 'color-mix(in srgb, var(--cardamom) 25%, transparent)',
                    }}
                  >
                    <CheckCircle2 size={14} style={{ color: 'var(--cardamom-d, #34d399)' }} />
                    <span className="font-semibold" style={{ color: 'var(--ink-2)' }}>Settled:</span>
                    <span className="font-extrabold font-mono" style={{ color: 'var(--ink)' }}>
                      {completedSummary.count} bills
                    </span>
                    <span style={{ color: 'var(--line)' }}>|</span>
                    <span className="font-extrabold font-mono" style={{ color: 'var(--cardamom-d, #34d399)' }}>
                      {formatINR(completedSummary.totalPaise)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Queue Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-base" style={{ color: 'var(--ink)' }}>
                  {filter === 'completed'
                    ? 'Completed Bills'
                    : filter === 'takeaway'
                    ? 'Takeaway Orders'
                    : filter === 'all'
                    ? 'All Open Orders'
                    : 'Ready to Bill'}
                </h2>
                <span
                  className="px-2.5 py-0.5 rounded-full text-xs font-extrabold"
                  style={{
                    background: displayOrders.length > 0
                      ? 'color-mix(in srgb, var(--gold) 18%, var(--paper-3))'
                      : 'var(--paper-3)',
                    color: displayOrders.length > 0 ? 'var(--gold-d)' : 'var(--ink-3)',
                    border: '1px solid color-mix(in srgb, var(--gold) 25%, transparent)',
                  }}
                >
                  {displayOrders.length} {filter === 'completed' ? 'bills' : 'orders'}
                </span>

                {filter === 'completed' && (
                  <span
                    className="text-xs px-2.5 py-0.5 rounded-full font-medium"
                    style={{
                      background: 'var(--paper-3)',
                      color: 'var(--ink-2)',
                      border: '1px solid var(--line)',
                    }}
                  >
                    📅 {completedRange === 'custom' ? formatHumanDate(completedDate) : completedRange === 'today' ? 'Today' : completedRange === 'yesterday' ? 'Yesterday' : completedRange === '7days' ? 'Last 7 Days' : 'All Time'}
                    {' · '}
                    {completedSort === 'desc' ? 'Latest first ↓' : 'Earliest first ↑'}
                  </span>
                )}
              </div>
              <span className="text-xs hidden sm:flex items-center gap-1.5 font-medium" style={{ color: 'var(--ink-3)' }}>
                <kbd
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono"
                  style={{ background: 'var(--paper-3)', border: '1px solid var(--line)' }}
                >↑↓</kbd>
                navigate ·
                <kbd
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono"
                  style={{ background: 'var(--gold)', color: '#2A1607', border: 'none' }}
                >
                  Enter
                </kbd>
                {filter === 'completed' ? 'to reprint / view' : 'to settle'}
              </span>
            </div>

            {/* Order Cards Grid */}
            {displayOrders.length === 0 ? (
              <div
                className="flex-1 rounded-2xl border flex flex-col items-center justify-center py-20 gap-4"
                style={{ background: 'var(--paper-2)', borderColor: 'var(--line)' }}
              >
                <div
                  className="w-16 h-16 rounded-2xl grid place-items-center"
                  style={{ background: 'color-mix(in srgb, var(--gold) 10%, var(--paper-3))' }}
                >
                  {filter === 'completed' ? (
                    <Calendar size={30} style={{ color: 'var(--gold-d)', opacity: 0.6 }} />
                  ) : (
                    <Receipt size={30} style={{ color: 'var(--gold-d)', opacity: 0.6 }} />
                  )}
                </div>
                <div className="text-center">
                  <p className="font-bold text-base" style={{ color: 'var(--ink-2)' }}>
                    {filter === 'completed'
                      ? `No completed bills found for ${completedRange === 'custom' ? formatHumanDate(completedDate) : completedRange}`
                      : 'No orders ready for billing'}
                  </p>
                  <p className="text-xs mt-1 max-w-xs" style={{ color: 'var(--ink-3)' }}>
                    {filter === 'completed'
                      ? 'Try selecting a different date from the calendar or choose "Today" or "7 Days".'
                      : 'Orders from POS and waiter app appear here instantly for billing.'}
                  </p>
                  {filter === 'completed' && completedRange !== 'today' && (
                    <button
                      onClick={() => {
                        setCompletedRange('today');
                        setCompletedDate(getTodayDateString());
                      }}
                      className="mt-3 px-4 py-2 rounded-xl text-xs font-bold transition active:scale-95"
                      style={{
                        background: 'var(--gold)',
                        color: '#2A1607',
                        boxShadow: '0 2px 8px color-mix(in srgb, var(--gold) 30%, transparent)',
                      }}
                    >
                      View Today's Bills
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {displayOrders.map((o, index) => {
                  const isSelected = selectedOrderIndex === index;
                  const isCancelled = o.status === 'cancelled';
                  const isSettled = o.status === 'settled' || filter === 'completed';
                  const itemCount = (o.items || []).reduce((sum: number, i: any) => sum + (i.qty || 1), 0);
                  const isTakeaway = o.type === 'takeaway';
                  const year = new Date(o.settledAt || o.placedAt || new Date()).getFullYear();
                  const invoiceNo = o.invoiceNo || (o.payments?.[0]?.meta as any)?.invoiceNo || `INV-${year}-${String(o.number).padStart(6, '0')}`;
                  const methods = o.paymentMethods || Array.from(new Set((o.payments || []).map((p: any) => String(p.method).toUpperCase()))).join(' + ') || 'CASH';

                  return (
                    <div
                      key={o.id}
                      ref={(el) => { orderCardRefs.current[index] = el; }}
                      tabIndex={0}
                      role="button"
                      aria-pressed={isSelected}
                      onClick={() => setSelectedOrderIndex(index)}
                      onDoubleClick={() => {
                        if (filter === 'completed' || isSettled) openReprintModal(o);
                        else startBilling(o);
                      }}
                      onFocus={() => setSelectedOrderIndex(index)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (filter === 'completed' || isSettled) openReprintModal(o);
                          else startBilling(o);
                        }
                      }}
                      className="flex flex-col justify-between outline-none cursor-pointer transition-all duration-150 rounded-2xl border"
                      style={{
                        background: isSelected
                          ? 'color-mix(in srgb, var(--gold) 6%, var(--paper-2))'
                          : 'var(--paper-2)',
                        borderColor: isSelected
                          ? 'var(--gold)'
                          : isCancelled
                          ? 'color-mix(in srgb, var(--clay) 30%, var(--line))'
                          : 'var(--line)',
                        boxShadow: isSelected
                          ? '0 4px 24px color-mix(in srgb, var(--gold) 18%, transparent), 0 0 0 2px color-mix(in srgb, var(--gold) 40%, transparent)'
                          : '0 1px 4px color-mix(in srgb, var(--espresso) 5%, transparent)',
                        transform: isSelected ? 'translateY(-2px)' : 'none',
                        opacity: isCancelled ? 0.55 : 1,
                      }}
                    >
                      {/* Card Top: Order meta */}
                      <div className="p-4">
                        {/* Header row */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-display font-extrabold text-2xl leading-none" style={{ color: 'var(--ink)' }}>
                              #{o.number}
                            </span>
                            {isSelected && (
                              <span
                                className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold flex items-center gap-0.5"
                                style={{ background: 'var(--gold)', color: '#2A1607' }}
                              >
                                ↵ Enter
                              </span>
                            )}
                          </div>
                          {/* Status badge */}
                          <span
                            className="shrink-0 px-2.5 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wider"
                            style={
                              isSettled
                                ? { background: 'color-mix(in srgb, var(--cardamom) 15%, var(--paper-3))', color: 'var(--cardamom-d, #34d399)' }
                                : isCancelled
                                ? { background: 'color-mix(in srgb, var(--clay) 15%, var(--paper-3))', color: 'var(--clay)' }
                                : { background: 'color-mix(in srgb, var(--gold) 15%, var(--paper-3))', color: 'var(--gold-d)' }
                            }
                          >
                            {isSettled ? '✓ Paid' : isCancelled ? 'Cancelled' : '● Ready'}
                          </span>
                        </div>

                        {/* Invoice pill if settled */}
                        {isSettled && (
                          <div className="mb-2">
                            <span
                              className="text-[10px] font-mono px-2 py-0.5 rounded-md font-bold"
                              style={{
                                background: 'var(--paper-3)',
                                color: 'var(--gold-d)',
                                border: '1px solid var(--line)',
                              }}
                            >
                              {invoiceNo}
                            </span>
                          </div>
                        )}

                        {/* Table / Type label */}
                        <p className="text-xs font-extrabold mb-2.5 flex items-center gap-1.5" style={{ color: 'var(--gold-d)' }}>
                          {isTakeaway
                            ? <><ShoppingBag size={12} /> Takeaway</>
                            : (o.table?.label || o.tableLabel || o.tableName)
                            ? <><Table2 size={12} /> Table {o.table?.label || o.tableLabel || o.tableName}</>
                            : '📍 Direct'}
                        </p>

                        {/* Order details */}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--ink-2)' }}>
                            <User size={11} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
                            <span className="truncate font-medium">{o.customer?.name || o.customerName || 'Walk-in Customer'}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--ink-2)' }}>
                            <Receipt size={11} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
                            <span>{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--ink-3)' }} suppressHydrationWarning>
                            <Clock size={11} style={{ flexShrink: 0 }} />
                            <span>
                              {isSettled && o.settledAt
                                ? `Settled ${new Date(o.settledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
                                : new Date(o.placedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              {filter === 'completed' && completedRange !== 'today' && o.settledAt && (
                                ` · ${new Date(o.settledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
                              )}
                            </span>
                          </div>
                          {isSettled && (
                            <div className="pt-0.5">
                              <span
                                className="inline-block px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide"
                                style={{
                                  background: 'color-mix(in srgb, var(--gold) 12%, var(--paper-3))',
                                  color: 'var(--gold-d)',
                                  border: '1px solid color-mix(in srgb, var(--gold) 20%, transparent)',
                                }}
                              >
                                {methods}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Bottom: Amount + CTA */}
                      <div
                        className="px-4 py-3 flex items-center justify-between gap-2 border-t rounded-b-2xl"
                        style={{
                          borderColor: isSelected
                            ? 'color-mix(in srgb, var(--gold) 30%, var(--line))'
                            : 'var(--line)',
                          background: isSelected
                            ? 'color-mix(in srgb, var(--gold) 5%, var(--paper-3))'
                            : 'var(--paper-3)',
                        }}
                      >
                        <span className="font-display font-extrabold text-lg tnum" style={{ color: 'var(--ink)' }}>
                          {formatINR(o.totalPaise)}
                        </span>
                        {isSettled ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openReprintModal(o);
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition hover:opacity-85 active:scale-95"
                              style={{
                                background: 'var(--paper-2)',
                                border: '1px solid var(--line)',
                                color: 'var(--ink-2)',
                              }}
                              title="Reprint receipt"
                            >
                              <Printer size={12} /> Reprint
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openReprintModal(o);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-extrabold transition active:scale-95"
                              style={{
                                background: 'color-mix(in srgb, var(--gold) 18%, var(--paper-2))',
                                color: 'var(--gold-d)',
                                border: '1px solid color-mix(in srgb, var(--gold) 30%, var(--line))',
                              }}
                            >
                              Details <ChevronRight size={12} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startBilling(o);
                            }}
                            disabled={isCancelled}
                            className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition active:scale-95 disabled:opacity-40"
                            style={
                              isSelected
                                ? {
                                    background: 'var(--gold)',
                                    color: '#2A1607',
                                    boxShadow: '0 2px 8px color-mix(in srgb, var(--gold) 40%, transparent)',
                                  }
                                : {
                                    background: 'color-mix(in srgb, var(--gold) 18%, var(--paper-2))',
                                    color: 'var(--gold-d)',
                                    border: '1px solid color-mix(in srgb, var(--gold) 30%, var(--line))',
                                  }
                            }
                          >
                            Settle Now <ChevronRight size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── 2. BILLING WORKSPACE VIEW ── */}
        {view === 'workspace' && selectedOrder && (
          <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">

            {/* LEFT PANEL: Bill Details */}
            <div className="flex-1 flex flex-col gap-4 min-w-0">
              <div
                className="rounded-2xl border p-5 flex-1 flex flex-col min-w-0 overflow-hidden"
                style={{
                  background: 'var(--paper-2)',
                  borderColor: 'var(--line)',
                  boxShadow: '0 2px 16px color-mix(in srgb, var(--espresso) 5%, transparent)',
                }}
              >
                {/* Invoice Header */}
                <div className="flex flex-wrap items-start justify-between gap-3 pb-4 mb-4 border-b" style={{ borderColor: 'var(--line)' }}>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: 'var(--gold-d)' }} suppressHydrationWarning>
                      Invoice Preview — INV-{new Date().getFullYear()}-{String(selectedOrder.number).padStart(6, '0')}
                    </span>
                    <h2 className="font-display text-2xl font-extrabold mt-0.5" style={{ color: 'var(--ink)' }}>
                      Order #{selectedOrder.number}
                      <span className="text-base font-semibold ml-2" style={{ color: 'var(--gold-d)' }}>
                        · {selectedOrder.table?.label ? `Table ${selectedOrder.table.label}` : 'Takeaway'}
                      </span>
                    </h2>
                  </div>
                  <div className="text-right text-xs" style={{ color: 'var(--ink-3)' }}>
                    <p className="font-bold" style={{ color: 'var(--ink-2)' }}>{staff.name}</p>
                    <p suppressHydrationWarning>
                      {new Date().toLocaleDateString('en-IN')} · {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>

                {/* Items Table */}
                <div className="flex-1 overflow-y-auto -mx-1 px-1">
                  <table className="w-full text-sm">
                    <thead>
                      <tr
                        style={{
                          background: 'var(--paper-3)',
                          color: 'var(--ink-3)',
                        }}
                      >
                        <th className="px-3 py-2.5 text-left text-[11px] font-extrabold uppercase tracking-wider rounded-l-xl">Item</th>
                        <th className="px-3 py-2.5 text-center text-[11px] font-extrabold uppercase tracking-wider">Qty</th>
                        <th className="px-3 py-2.5 text-right text-[11px] font-extrabold uppercase tracking-wider">Rate</th>
                        <th className="px-3 py-2.5 text-right text-[11px] font-extrabold uppercase tracking-wider">Tax</th>
                        <th className="px-3 py-2.5 text-right text-[11px] font-extrabold uppercase tracking-wider rounded-r-xl">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedOrder.items || []).map((i: any, idx: number) => {
                        const gstRate = Number(i.item?.gstRate ?? 5);
                        const lineTotal = i.unitPricePaise * i.qty;
                        return (
                          <tr
                            key={i.id}
                            className="transition-colors"
                            style={{ borderBottom: '1px solid var(--line)' }}
                          >
                            <td className="px-3 py-3 font-semibold" style={{ color: 'var(--ink)' }}>
                              {i.nameSnapshot}
                              {i.notes && (
                                <p className="text-[11px] italic mt-0.5" style={{ color: 'var(--ink-3)' }}>{i.notes}</p>
                              )}
                            </td>
                            <td className="px-3 py-3 text-center font-bold tnum">{i.qty}</td>
                            <td className="px-3 py-3 text-right font-medium tnum">{formatINR(i.unitPricePaise)}</td>
                            <td className="px-3 py-3 text-right text-xs tnum" style={{ color: 'var(--ink-3)' }}>{gstRate}%</td>
                            <td className="px-3 py-3 text-right font-bold tnum">{formatINR(lineTotal)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Discount Row */}
                <div className="pt-4 mt-2 border-t" style={{ borderColor: 'var(--line)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--ink-2)' }}>
                      <DollarSign size={13} /> Discount
                    </span>
                    {!canApplyDiscount && (
                      <span className="text-[11px] font-bold flex items-center gap-1" style={{ color: 'var(--gold-d)' }}>
                        <Lock size={11} /> Requires Permission
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 items-center">
                    <div
                      className="flex rounded-xl p-0.5"
                      style={{ background: 'var(--paper-3)', border: '1px solid var(--line)' }}
                    >
                      {(['pct', 'flat'] as const).map((t) => (
                        <button
                          key={t}
                          disabled={!canApplyDiscount}
                          onClick={() => setDiscountType(t)}
                          className="px-3 py-1.5 text-xs font-bold rounded-lg transition disabled:opacity-50"
                          style={
                            discountType === t
                              ? { background: 'var(--gold)', color: '#2A1607' }
                              : { color: 'var(--ink-3)' }
                          }
                        >
                          {t === 'pct' ? '% Off' : 'Flat ₹'}
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      disabled={!canApplyDiscount}
                      value={discountVal}
                      onChange={(e) => setDiscountVal(e.target.value)}
                      placeholder={discountType === 'pct' ? '0' : '0.00'}
                      className="w-28 px-3.5 py-2 rounded-xl border text-sm outline-none font-bold tnum disabled:opacity-50 transition"
                      style={{
                        background: 'var(--paper-3)',
                        borderColor: 'var(--line)',
                        color: 'var(--ink)',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT PANEL: Bill Summary + Payment */}
            <div className="w-full lg:w-[440px] flex flex-col gap-3 shrink-0">
              <div
                className="rounded-2xl border p-5 flex flex-col gap-4"
                style={{
                  background: 'var(--paper-2)',
                  borderColor: 'var(--line)',
                  boxShadow: '0 2px 16px color-mix(in srgb, var(--espresso) 5%, transparent)',
                }}
              >
                {/* Bill Summary */}
                <div>
                  <h3
                    className="text-[11px] font-extrabold uppercase tracking-widest pb-3 mb-3 border-b"
                    style={{ color: 'var(--ink-3)', borderColor: 'var(--line)' }}
                  >
                    Bill Summary
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between" style={{ color: 'var(--ink-2)' }}>
                      <span>Subtotal</span>
                      <span className="font-mono font-semibold">{formatINR(calculatedBill.subtotalPaise)}</span>
                    </div>
                    {calculatedBill.discountPaise > 0 && (
                      <div className="flex justify-between font-bold" style={{ color: 'var(--cardamom-d, #34d399)' }}>
                        <span>Discount Applied</span>
                        <span className="font-mono">− {formatINR(calculatedBill.discountPaise)}</span>
                      </div>
                    )}
                    {outlet.gstEnabled && (
                      <>
                        <div className="flex justify-between text-xs" style={{ color: 'var(--ink-3)' }}>
                          <span>CGST</span>
                          <span className="font-mono">{formatINR(calculatedBill.cgstPaise)}</span>
                        </div>
                        <div className="flex justify-between text-xs" style={{ color: 'var(--ink-3)' }}>
                          <span>SGST</span>
                          <span className="font-mono">{formatINR(calculatedBill.sgstPaise)}</span>
                        </div>
                      </>
                    )}
                    {calculatedBill.roundOffPaise !== 0 && (
                      <div className="flex justify-between text-xs" style={{ color: 'var(--ink-3)' }}>
                        <span>Round Off</span>
                        <span className="font-mono">{formatINR(calculatedBill.roundOffPaise)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Grand Total */}
                <div
                  className="p-4 rounded-2xl text-center"
                  style={{
                    background: 'linear-gradient(135deg, color-mix(in srgb, var(--gold) 12%, var(--paper-3)) 0%, color-mix(in srgb, var(--espresso) 8%, var(--paper-3)) 100%)',
                    border: '1.5px solid color-mix(in srgb, var(--gold) 35%, var(--line))',
                  }}
                >
                  <span className="text-[10px] font-extrabold uppercase tracking-widest block mb-1" style={{ color: 'var(--gold-d)' }}>
                    Grand Total Payable
                  </span>
                  <div className="font-display text-4xl font-extrabold tracking-tight tnum" style={{ color: 'var(--gold-d)' }}>
                    {formatINR(calculatedBill.totalPaise)}
                  </div>
                </div>

                {/* Customer Info */}
                <div className="border-t pt-3 relative" style={{ borderColor: 'var(--line)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--ink-3)' }}>
                      <User size={12} /> Customer
                    </span>
                    {(custName.trim() || custPhone.trim()) && (
                      <button
                        type="button"
                        onClick={() => {
                          setCustName('');
                          setCustPhone('');
                          setCustMatches([]);
                        }}
                        className="text-[11px] font-bold transition hover:opacity-80"
                        style={{ color: 'var(--ink-3)' }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={custName}
                      onChange={(e) => setCustName(e.target.value)}
                      placeholder="Customer name"
                      className="w-full px-3 py-2 rounded-xl border text-xs outline-none transition"
                      style={{ background: 'var(--paper-3)', borderColor: 'var(--line)', color: 'var(--ink)' }}
                    />
                    <input
                      value={custPhone}
                      onChange={(e) => setCustPhone(e.target.value)}
                      placeholder="Phone (CRM & loyalty)"
                      inputMode="tel"
                      className="w-full px-3 py-2 rounded-xl border text-xs outline-none transition"
                      style={{ background: 'var(--paper-3)', borderColor: 'var(--line)', color: 'var(--ink)' }}
                    />
                  </div>
                  {custMatches.length > 0 && (
                    <div
                      className="mt-2 rounded-xl border overflow-hidden shadow-lg"
                      style={{ borderColor: 'var(--line)', background: 'var(--paper-2)' }}
                    >
                      {custMatches.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setCustName(m.name || '');
                            setCustPhone(m.phone || custPhone);
                            setCustMatches([]);
                          }}
                          className="w-full px-3 py-2 text-left text-[11px] font-bold border-b last:border-b-0 flex items-center justify-between transition hover:opacity-80 cursor-pointer"
                          style={{ borderColor: 'var(--line)', color: 'var(--ink-2)' }}
                        >
                          <div>
                            <span>{m.name || 'Guest'}</span>
                            <span className="ml-2 font-mono text-[10px]" style={{ color: 'var(--ink-3)' }}>
                              {m.phone}
                            </span>
                          </div>
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full"
                            style={{
                              background: 'color-mix(in srgb, var(--gold) 20%, transparent)',
                              color: 'var(--gold-d)',
                            }}
                          >
                            {m.points} pts · {m.visitCount} visits
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Payment Methods */}
                <div className="border-t pt-3" style={{ borderColor: 'var(--line)' }}>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest mb-2 block" style={{ color: 'var(--ink-3)' }}>
                    Payment Method
                  </span>

                  {/* Method Tabs */}
                  <div
                    className="grid grid-cols-4 gap-1 p-1 rounded-xl mb-3"
                    style={{ background: 'var(--paper-3)', border: '1px solid var(--line)' }}
                  >
                    {payMethods.map(({ key, label, icon: Icon }) => (
                      <button
                        key={key}
                        onClick={() => setPayTab(key)}
                        className="py-2 rounded-lg text-[11px] font-bold flex flex-col items-center gap-0.5 transition active:scale-95"
                        style={
                          payTab === key
                            ? { background: 'var(--gold)', color: '#2A1607', boxShadow: '0 2px 6px color-mix(in srgb, var(--gold) 30%, transparent)' }
                            : { color: 'var(--ink-3)' }
                        }
                      >
                        <Icon size={14} />
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* CASH */}
                  {payTab === 'cash' && (
                    <div className="space-y-3 p-3.5 rounded-xl border" style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }}>
                      <div>
                        <label className="text-[10px] font-extrabold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--ink-3)' }}>
                          Amount Received (₹)
                        </label>
                        <input
                          id="cash-received-input"
                          type="number"
                          value={cashReceived}
                          onChange={(e) => setCashReceived(e.target.value)}
                          placeholder={(calculatedBill.totalPaise / 100).toFixed(0)}
                          className="w-full px-3.5 py-3 rounded-xl border text-xl font-extrabold outline-none tnum transition"
                          style={{ background: 'var(--paper-2)', borderColor: 'color-mix(in srgb, var(--gold) 40%, var(--line))', color: 'var(--ink)' }}
                        />
                      </div>
                      {/* Quick amounts */}
                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          Math.ceil(calculatedBill.totalPaise / 100),
                          Math.ceil(calculatedBill.totalPaise / 10000) * 100 + 100,
                          500,
                          2000,
                        ].map((amt, idx) => (
                          <button
                            key={idx}
                            onClick={() => setCashReceived(amt.toString())}
                            className="py-2 rounded-lg text-xs font-bold border transition hover:border-[var(--gold)] active:scale-95"
                            style={{ background: 'var(--paper-2)', borderColor: 'var(--line)', color: 'var(--ink-2)' }}
                          >
                            ₹{amt}
                          </button>
                        ))}
                      </div>
                      {/* Change */}
                      <div
                        className="flex justify-between items-center px-3.5 py-2.5 rounded-xl border"
                        style={{
                          background: cashChangePaise > 0 ? 'color-mix(in srgb, var(--cardamom) 8%, var(--paper-2))' : 'var(--paper-2)',
                          borderColor: cashChangePaise > 0 ? 'color-mix(in srgb, var(--cardamom) 25%, var(--line))' : 'var(--line)',
                        }}
                      >
                        <span className="text-xs font-bold" style={{ color: 'var(--ink-3)' }}>Return Change</span>
                        <span className="font-display font-extrabold text-xl tnum" style={{ color: 'var(--cardamom-d, #34d399)' }}>
                          {formatINR(cashChangePaise)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* UPI */}
                  {payTab === 'upi' && (
                    <div className="p-4 rounded-xl border text-center space-y-3" style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }}>
                      <div
                        className="w-12 h-12 rounded-2xl mx-auto grid place-items-center"
                        style={{ background: 'color-mix(in srgb, var(--gold) 15%, var(--paper-2))' }}
                      >
                        <Smartphone size={24} style={{ color: 'var(--gold-d)' }} />
                      </div>
                      <div>
                        <p className="text-sm font-bold" style={{ color: 'var(--ink)' }}>UPI / QR Payment</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--ink-3)' }}>
                          Collect {formatINR(calculatedBill.totalPaise)} via UPI
                        </p>
                      </div>
                      <input
                        value={upiRef}
                        onChange={(e) => setUpiRef(e.target.value)}
                        placeholder="UTR / Txn ID (optional)"
                        className="w-full px-3.5 py-2 rounded-xl border text-xs outline-none transition"
                        style={{ background: 'var(--paper-2)', borderColor: 'var(--line)', color: 'var(--ink)' }}
                      />
                    </div>
                  )}

                  {/* CARD */}
                  {payTab === 'card' && (
                    <div className="p-4 rounded-xl border text-center space-y-3" style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }}>
                      <div
                        className="w-12 h-12 rounded-2xl mx-auto grid place-items-center"
                        style={{ background: 'color-mix(in srgb, var(--gold) 15%, var(--paper-2))' }}
                      >
                        <CreditCard size={24} style={{ color: 'var(--gold-d)' }} />
                      </div>
                      <div>
                        <p className="text-sm font-bold" style={{ color: 'var(--ink)' }}>Card POS Machine</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--ink-3)' }}>
                          Swipe / Tap for {formatINR(calculatedBill.totalPaise)}
                        </p>
                      </div>
                      <input
                        value={cardRef}
                        onChange={(e) => setCardRef(e.target.value)}
                        placeholder="Auth / Approval Code (optional)"
                        className="w-full px-3.5 py-2 rounded-xl border text-xs outline-none transition"
                        style={{ background: 'var(--paper-2)', borderColor: 'var(--line)', color: 'var(--ink)' }}
                      />
                    </div>
                  )}

                  {/* SPLIT */}
                  {payTab === 'split' && (
                    <div className="p-3.5 rounded-xl border space-y-3" style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }}>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: 'Cash (₹)', val: splitCash, set: setSplitCash },
                          { label: 'UPI (₹)', val: splitUpi, set: setSplitUpi },
                          { label: 'Card (₹)', val: splitCard, set: setSplitCard },
                        ].map(({ label, val, set }) => (
                          <div key={label}>
                            <label className="text-[10px] font-extrabold uppercase tracking-wider block mb-1" style={{ color: 'var(--ink-3)' }}>
                              {label}
                            </label>
                            <input
                              type="number"
                              value={val}
                              onChange={(e) => set(e.target.value)}
                              className="w-full px-2.5 py-2 rounded-lg border text-sm font-bold tnum outline-none transition"
                              style={{ background: 'var(--paper-2)', borderColor: 'var(--line)', color: 'var(--ink)' }}
                            />
                          </div>
                        ))}
                      </div>
                      <div
                        className="flex justify-between items-center text-xs font-bold pt-2.5 border-t"
                        style={{ borderColor: 'var(--line)' }}
                      >
                        <span style={{ color: 'var(--ink-2)' }}>Remaining:</span>
                        <span style={{ color: splitRemainingPaise > 0 ? 'var(--clay)' : 'var(--cardamom-d, #34d399)' }}>
                          {formatINR(splitRemainingPaise)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Print Option Checkbox */}
                <div
                  className="flex items-center justify-between px-3 py-2 rounded-xl border select-none transition"
                  style={{
                    background: 'var(--paper-3)',
                    borderColor: printReceipt ? 'color-mix(in srgb, var(--gold) 35%, var(--line))' : 'var(--line)',
                  }}
                >
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold" style={{ color: 'var(--ink)' }}>
                    <input
                      type="checkbox"
                      checked={printReceipt}
                      onChange={(e) => setPrintReceipt(e.target.checked)}
                      className="w-4 h-4 rounded accent-[var(--gold)] cursor-pointer"
                    />
                    <span className="flex items-center gap-1.5">
                      <Printer size={13} style={{ color: printReceipt ? 'var(--gold-d)' : 'var(--ink-3)' }} /> Print
                    </span>
                  </label>
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: printReceipt ? 'var(--gold-d)' : 'var(--ink-3)' }}
                  >
                    {printReceipt ? 'To printer' : 'Skip print'}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => setReceiptModalOpen(true)}
                    className="py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition hover:opacity-80 active:scale-95"
                    style={{
                      background: 'var(--paper-3)',
                      border: '1px solid var(--line)',
                      color: 'var(--ink-2)',
                    }}
                  >
                    <Receipt size={15} /> Preview (F6)
                  </button>
                  <button
                    disabled={settleBusy}
                    onClick={handleSettleOrder}
                    className="py-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-60"
                    style={{
                      background: settleBusy
                        ? 'var(--paper-3)'
                        : 'linear-gradient(135deg, var(--gold) 0%, color-mix(in srgb, var(--gold) 60%, var(--espresso)) 100%)',
                      color: settleBusy ? 'var(--ink-3)' : '#2A1607',
                      boxShadow: settleBusy ? 'none' : '0 3px 12px color-mix(in srgb, var(--gold) 35%, transparent)',
                    }}
                  >
                    {printReceipt ? <Printer size={15} /> : <CheckCircle2 size={15} />}
                    {settleBusy ? 'Processing…' : 'Settle and Confirm (F8)'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── 3. PAYMENT COMPLETED SCREEN ── */}
        {view === 'completed' && settledResult && (
          <div className="flex-1 flex items-center justify-center py-8">
            <div
              className="max-w-md w-full rounded-3xl border p-8 text-center space-y-6"
              style={{
                background: 'var(--paper-2)',
                borderColor: 'color-mix(in srgb, var(--cardamom) 30%, var(--line))',
                boxShadow: '0 8px 48px color-mix(in srgb, var(--cardamom) 12%, transparent)',
              }}
            >
              {/* Success Icon */}
              <div
                className="w-20 h-20 rounded-full mx-auto grid place-items-center text-4xl"
                style={{
                  background: 'linear-gradient(135deg, color-mix(in srgb, var(--cardamom) 20%, var(--paper-3)) 0%, color-mix(in srgb, var(--cardamom) 10%, var(--paper-3)) 100%)',
                  border: '2px solid color-mix(in srgb, var(--cardamom) 35%, transparent)',
                }}
              >
                <CheckCircle2 size={40} style={{ color: 'var(--cardamom-d, #34d399)' }} />
              </div>

              <div>
                <h2 className="font-display text-3xl font-extrabold" style={{ color: 'var(--ink)' }}>
                  Payment Done! 🎉
                </h2>
                <p className="text-sm font-bold mt-1" style={{ color: 'var(--gold-d)' }}>
                  {settledResult.invoiceNo}
                </p>
              </div>

              {/* Summary */}
              <div
                className="p-4 rounded-2xl border space-y-2.5 text-sm text-left"
                style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }}
              >
                <div className="flex justify-between">
                  <span style={{ color: 'var(--ink-3)' }}>Order</span>
                  <span className="font-bold">#{settledResult.order.number}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--ink-3)' }}>Total Paid</span>
                  <span className="font-bold font-mono">{formatINR(settledResult.bill.totalPaise)}</span>
                </div>
                {settledResult.changePaise > 0 && (
                  <div className="flex justify-between font-bold" style={{ color: 'var(--cardamom-d, #34d399)' }}>
                    <span>Return Change</span>
                    <span className="font-mono">{formatINR(settledResult.changePaise)}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => handlePrintReceipt(settledResult.receipt)}
                  className="py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition hover:opacity-80 active:scale-95"
                  style={{
                    background: 'var(--paper-3)',
                    border: '1px solid var(--line)',
                    color: 'var(--ink-2)',
                  }}
                >
                  <Printer size={14} /> Reprint
                </button>
                <button
                  onClick={() => setView('queue')}
                  className="py-3 rounded-xl text-xs font-extrabold col-span-2 flex items-center justify-center gap-1.5 transition active:scale-95"
                  style={{
                    background: 'linear-gradient(135deg, var(--gold) 0%, color-mix(in srgb, var(--gold) 60%, var(--espresso)) 100%)',
                    color: '#2A1607',
                    boxShadow: '0 3px 12px color-mix(in srgb, var(--gold) 30%, transparent)',
                  }}
                >
                  <Zap size={14} /> New Bill
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── 4. BILLING HISTORY VIEW ── */}
        {view === 'history' && (
          <div
            className="rounded-2xl border flex-1 flex flex-col overflow-hidden"
            style={{
              background: 'var(--paper-2)',
              borderColor: 'var(--line)',
              boxShadow: '0 2px 16px color-mix(in srgb, var(--espresso) 5%, transparent)',
            }}
          >
            {/* History Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b" style={{ borderColor: 'var(--line)' }}>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="font-display font-bold text-xl flex items-center gap-2 mr-1" style={{ color: 'var(--ink)' }}>
                  <History size={20} style={{ color: 'var(--gold-d)' }} />
                  Billing History
                </h2>
                {/* Calendar Date Picker */}
                <label
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer relative"
                  style={{
                    background: historyRange === 'custom' ? 'color-mix(in srgb, var(--gold) 15%, var(--paper-3))' : 'var(--paper-3)',
                    borderColor: historyRange === 'custom' ? 'var(--gold)' : 'var(--line)',
                    color: 'var(--ink)',
                  }}
                  title="Filter by calendar date"
                >
                  <Calendar size={13} style={{ color: 'var(--gold-d)' }} />
                  <span>
                    {historyRange === 'custom' ? formatHumanDate(completedDate) : historyRange === 'today' ? 'Today' : historyRange === 'yesterday' ? 'Yesterday' : historyRange === '7days' ? '7 Days' : 'All Time'}
                  </span>
                  <input
                    type="date"
                    value={completedDate}
                    max={getTodayDateString()}
                    onChange={(e) => {
                      if (e.target.value) {
                        setCompletedDate(e.target.value);
                        setHistoryRange('custom');
                      }
                    }}
                    className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                  />
                </label>
                {/* Range presets */}
                <div className="hidden sm:flex items-center gap-1 p-0.5 rounded-xl border" style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }}>
                  {[
                    { key: 'today', label: 'Today', onClick: () => { setHistoryRange('today'); setCompletedDate(getTodayDateString()); } },
                    { key: 'yesterday', label: 'Yesterday', onClick: () => { setHistoryRange('yesterday'); setCompletedDate(getYesterdayDateString()); } },
                    { key: '7days', label: '7 Days', onClick: () => { setHistoryRange('7days'); } },
                    { key: 'all', label: 'All', onClick: () => { setHistoryRange('all'); } },
                  ].map((p) => (
                    <button
                      key={p.key}
                      onClick={p.onClick}
                      className="px-2 py-1 rounded-lg text-[11px] font-bold transition active:scale-95"
                      style={
                        historyRange === p.key
                          ? { background: 'var(--gold)', color: '#2A1607' }
                          : { background: 'transparent', color: 'var(--ink-2)' }
                      }
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                {/* Sort toggle */}
                <button
                  onClick={() => setCompletedSort((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition active:scale-95"
                  style={{ background: 'var(--paper-3)', borderColor: 'var(--line)', color: 'var(--ink-2)' }}
                  title="Toggle sort order"
                >
                  <ArrowUpDown size={12} style={{ color: 'var(--gold-d)' }} />
                  <span>{completedSort === 'desc' ? 'Latest ↓' : 'Earliest ↑'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={13} style={{ color: 'var(--ink-3)' }} />
                  <input
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="Search invoice, customer..."
                    className="pl-8 pr-3 py-2 rounded-xl border text-xs outline-none transition"
                    style={{ background: 'var(--paper-3)', borderColor: 'var(--line)', color: 'var(--ink)' }}
                  />
                </div>
                <button
                  onClick={loadHistory}
                  disabled={historyLoading}
                  className="w-8 h-8 rounded-xl grid place-items-center transition hover:opacity-80 active:scale-95"
                  style={{ background: 'var(--paper-3)', border: '1px solid var(--line)' }}
                >
                  <RefreshCw size={13} className={historyLoading ? 'animate-spin' : ''} style={{ color: 'var(--ink-3)' }} />
                </button>
              </div>
            </div>

            {/* History Table */}
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-sm">
                <thead
                  className="sticky top-0"
                  style={{ background: 'var(--paper-3)', borderBottom: '1px solid var(--line)' }}
                >
                  <tr>
                    {['Invoice #', 'Order #', 'Table / Type', 'Customer', 'Method', 'Amount', ''].map((h, i) => (
                      <th
                        key={i}
                        className={`px-4 py-3 text-[10px] font-extrabold uppercase tracking-wider ${i === 5 || i === 6 ? 'text-right' : 'text-left'}`}
                        style={{ color: 'var(--ink-3)' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {historyList.map((h) => (
                    <tr
                      key={h.id}
                      className="transition-colors"
                      style={{ borderBottom: '1px solid var(--line)' }}
                    >
                      <td className="px-4 py-3.5 font-mono font-bold text-xs" style={{ color: 'var(--gold-d)' }}>{h.invoiceNo}</td>
                      <td className="px-4 py-3.5 font-bold">#{h.number}</td>
                      <td className="px-4 py-3.5 text-xs" style={{ color: 'var(--ink-2)' }}>{h.tableName}</td>
                      <td className="px-4 py-3.5 font-medium">{h.customerName}</td>
                      <td className="px-4 py-3.5">
                        <span
                          className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase"
                          style={{
                            background: 'color-mix(in srgb, var(--gold) 12%, var(--paper-3))',
                            color: 'var(--gold-d)',
                          }}
                        >
                          {h.paymentMethods}
                        </span>
                      </td>
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
                              roundOffPaise: h.roundOffPaise || 0,
                              totalPaise: h.totalPaise,
                              paymentMethod: h.paymentMethods,
                              isReprint: true,
                              gstEnabled: (h.cgstPaise || 0) + (h.sgstPaise || 0) > 0,
                              receiptConfig: outlet.receipt,
                              upiConfig: outlet.upiConfig,
                            };
                            setPreviewOrderOverride(histData as any);
                            setReceiptModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition hover:opacity-80 active:scale-95"
                          style={{
                            background: 'var(--paper-3)',
                            border: '1px solid var(--line)',
                            color: 'var(--ink-2)',
                          }}
                        >
                          <Printer size={12} /> Reprint
                        </button>
                      </td>
                    </tr>
                  ))}
                  {historyList.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-16 text-center" style={{ color: 'var(--ink-3)' }}>
                        <div className="flex flex-col items-center gap-2">
                          <History size={32} style={{ opacity: 0.3 }} />
                          <span className="text-sm font-medium">No billing history found</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ── RECEIPT PREVIEW MODAL ── */}
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
            const orderId = previewOrderOverride
              ? (previewOrderOverride as any).orderId
              : (selectedOrder?.id || settledResult?.order?.id);
            if (orderId) {
              const res = await fetch('/api/print/reprint', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ orderId, type: 'RECEIPT' }),
              });
              if (!res.ok) throw new Error('Thermal printer is offline or failed to reprint.');
              flash('Reprint dispatched to billing receipt printer 🖨️');
            }
          }}
        />
      )}

      {/* ── KEYBOARD SHORTCUTS MODAL ── */}
      {shortcutsOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center p-4 backdrop-blur-sm"
          style={{ background: 'rgba(0,0,0,0.65)' }}
          onClick={() => setShortcutsOpen(false)}
        >
          <div
            className="rounded-3xl border p-6 max-w-md w-full space-y-4"
            style={{ background: 'var(--paper-2)', borderColor: 'var(--line)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display font-bold text-xl flex items-center gap-2" style={{ color: 'var(--ink)' }}>
              <HelpCircle size={20} style={{ color: 'var(--gold-d)' }} />
              Cashier Shortcuts
            </h3>
            <div className="space-y-1.5 text-xs">
              {[
                ['F2', 'Focus Order Search Bar'],
                ['↑ / ↓ / ← / →', 'Navigate Ready Bills'],
                ['Enter', 'Open Selected Bill for Billing'],
                ['Tab', 'Navigate Between Controls'],
                ['F4', 'Focus Cash Amount Input'],
                ['F6', 'Preview Receipt'],
                ['F8', 'Settle and Confirm'],
                ['Esc', 'Back to Queue / Exit'],
              ].map(([key, desc]) => (
                <div
                  key={key}
                  className="flex items-center justify-between p-2.5 rounded-xl border"
                  style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }}
                >
                  <kbd
                    className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold font-mono shrink-0"
                    style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', color: 'var(--gold-d)' }}
                  >
                    {key}
                  </kbd>
                  <span className="font-semibold ml-3" style={{ color: 'var(--ink-2)' }}>{desc}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShortcutsOpen(false)}
              className="w-full py-2.5 rounded-xl text-xs font-extrabold transition active:scale-95"
              style={{
                background: 'linear-gradient(135deg, var(--gold) 0%, color-mix(in srgb, var(--gold) 60%, var(--espresso)) 100%)',
                color: '#2A1607',
              }}
            >
              Got it ✓
            </button>
          </div>
        </div>
      )}

      {/* ── TOAST ── */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl text-xs font-bold shadow-2xl"
          style={{
            background: 'var(--espresso)',
            color: '#ffffff',
            boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
            animation: 'slideInBottom 0.25s ease-out',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
