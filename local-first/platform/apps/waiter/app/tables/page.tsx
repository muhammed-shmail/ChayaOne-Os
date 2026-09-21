'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { WaiterBottomNav } from '@/components/WaiterBottomNav';
import {
  Users,
  Clock,
  Receipt,
  PlusCircle,
  ArrowRightLeft,
  Merge,
  Split,
  Utensils,
  RefreshCw,
  LogOut,
  ChevronRight,
  BellRing,
  Check,
  CheckCircle2,
} from 'lucide-react';

interface TableItem {
  id: string;
  label: string;
  seats: number;
  state: 'free' | 'seated' | 'billed';
}

interface OccupancyInfo {
  id?: string;
  orderId?: string;
  number: number;
  sinceMs: number;
  billPaise: number;
  orders: number;
  status: string;
}

interface TableOrderLine {
  id: string;
  orderId: string;
  name: string;
  qty: number;
  unitPricePaise: number;
  linePaise: number;
  station: string | null;
  kotStatus: string;
}

interface TableOrderData {
  orders: Array<{ id: string; number: number; totalPaise: number; placedAt: string }>;
  lines: TableOrderLine[];
  totals: {
    totalPaise: number;
    subtotalPaise: number;
    discountPaise: number;
  };
}

export default function WaiterTablesPage() {
  const router = useRouter();
  const [tables, setTables] = useState<TableItem[]>([]);
  const [occupiedMap, setOccupiedMap] = useState<Record<string, OccupancyInfo>>({});
  const [filter, setFilter] = useState<'all' | 'free' | 'occupied' | 'billed'>('all');
  const [selectedTable, setSelectedTable] = useState<TableItem | null>(null);
  const [tableOrder, setTableOrder] = useState<TableOrderData | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchTables = useCallback(async () => {
    try {
      const res = await fetch('/api/tables');
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      const data = await res.json();
      if (data.tables) {
        setTables(data.tables);
        setOccupiedMap(data.occupied || {});
      }
    } catch (err) {
      console.error('Failed to load tables', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  const fetchAlertsCount = useCallback(async () => {
    try {
      const res = await fetch('/api/staff/notifications');
      if (res.ok) {
        const d = await res.json();
        const unread = Array.isArray(d.items) ? d.items.filter((n: { readAt?: string | null }) => !n.readAt).length : 0;
        setUnreadCount(unread);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchTables();
    fetchAlertsCount();

    // Auto-polling interval for resilience
    const interval = setInterval(() => {
      fetchTables();
      fetchAlertsCount();
    }, 4000);

    return () => clearInterval(interval);
  }, [fetchTables, fetchAlertsCount]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTables();
    fetchAlertsCount();
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.push('/login');
  };

  // Fetch running order details when an occupied table is selected
  useEffect(() => {
    if (selectedTable && occupiedMap[selectedTable.id]) {
      setLoadingOrder(true);
      fetch(`/api/tables/order?tableId=${selectedTable.id}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) setTableOrder(data);
        })
        .catch((e) => console.error('Error fetching table order', e))
        .finally(() => setLoadingOrder(false));
    } else {
      setTableOrder(null);
    }
  }, [selectedTable, occupiedMap]);

  // Toast auto-clear
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 2800);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const handleMarkServed = async () => {
    if (!selectedTable) return;
    const occ = occupiedMap[selectedTable.id];
    const orderId = occ?.orderId || occ?.id;
    if (!orderId) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'served' }),
      });

      if (res.ok) {
        setToastMessage(`✓ Order #${occ.number} marked as Served!`);
        setOccupiedMap((prev) => ({
          ...prev,
          [selectedTable.id]: {
            ...prev[selectedTable.id]!,
            status: 'served',
          },
        }));
        fetchTables();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Failed to update order status');
      }
    } catch (err) {
      console.error('Error marking order served', err);
      alert('Network error updating status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestBill = async (cancel = false) => {
    if (!selectedTable) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/tables/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: cancel ? 'cancel_bill_request' : 'request_bill',
          tableId: selectedTable.id,
        }),
      });

      if (res.ok) {
        setToastMessage(
          cancel
            ? `Bill request cleared for Table ${selectedTable.label}`
            : `🧾 Bill requested for Table ${selectedTable.label}!`
        );
        const nextState = cancel ? 'seated' : 'billed';
        setTables((prev) =>
          prev.map((t) => (t.id === selectedTable.id ? { ...t, state: nextState } : t))
        );
        setSelectedTable((prev) => (prev ? { ...prev, state: nextState } : null));
        fetchTables();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Failed to update bill request');
      }
    } catch (err) {
      console.error('Error requesting bill', err);
      alert('Network error updating bill request');
    } finally {
      setActionLoading(false);
    }
  };

  const getTableStatus = (table: TableItem): { label: string; bg: string; text: string; border: string } => {
    const occ = occupiedMap[table.id];
    if (table.state === 'billed' || occ?.status === 'settled') {
      return {
        label: 'BILL REQUESTED',
        bg: 'bg-purple-500/15',
        text: 'text-purple-400',
        border: 'border-purple-500/40',
      };
    }
    if (occ || table.state === 'seated') {
      return {
        label: 'OCCUPIED',
        bg: 'bg-amber-500/15',
        text: 'text-amber-400',
        border: 'border-amber-500/40',
      };
    }
    return {
      label: 'AVAILABLE',
      bg: 'bg-emerald-500/15',
      text: 'text-emerald-400',
      border: 'border-emerald-500/40',
    };
  };

  const formatElapsed = (sinceMs: number) => {
    const mins = Math.max(0, Math.floor((Date.now() - sinceMs) / 60000));
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
  };

  const filteredTables = tables.filter((t) => {
    const occ = occupiedMap[t.id];
    if (filter === 'free') return !occ && t.state === 'free';
    if (filter === 'occupied') return !!occ || t.state === 'seated';
    if (filter === 'billed') return t.state === 'billed';
    return true;
  });

  const totalOccupied = Object.keys(occupiedMap).length;
  const totalFree = tables.length - totalOccupied;

  return (
    <div className="min-h-screen pb-24">
      {/* Top App Bar */}
      <header className="sticky top-0 z-40 glass-panel px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/30 flex items-center justify-center">
            <Utensils className="w-4 h-4 text-sky-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">ChayaOne Floor</h1>
            <p className="text-[11px] text-gray-400">
              <span className="text-emerald-400 font-semibold">{totalFree} Free</span> ·{' '}
              <span className="text-amber-400 font-semibold">{totalOccupied} Seated</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className={`p-2 rounded-xl bg-gray-800/80 hover:bg-gray-700/80 text-gray-300 transition-all ${
              refreshing ? 'animate-spin text-sky-400' : ''
            }`}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleLogout}
            className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 transition-all"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Filter Tabs */}
      <div className="p-3 flex items-center gap-2 overflow-x-auto">
        {[
          { key: 'all', label: `All (${tables.length})` },
          { key: 'free', label: `Available (${totalFree})` },
          { key: 'occupied', label: `Occupied (${totalOccupied})` },
          { key: 'billed', label: 'Bill Requested' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key as any)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              filter === tab.key
                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/25'
                : 'bg-gray-900/60 text-gray-400 hover:text-gray-200 border border-gray-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tables Grid */}
      <main className="p-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <RefreshCw className="w-8 h-8 animate-spin text-sky-400 mb-3" />
            <p className="text-xs">Loading floor map...</p>
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="text-center py-16 text-gray-500 text-xs">
            No tables found matching filter.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filteredTables.map((table) => {
              const status = getTableStatus(table);
              const occ = occupiedMap[table.id];

              return (
                <div
                  key={table.id}
                  onClick={() => setSelectedTable(table)}
                  className={`relative p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer active:scale-98 flex flex-col justify-between h-36 ${
                    status.border
                  } ${status.bg} bg-opacity-30 hover:bg-opacity-50`}
                >
                  {/* Table Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-lg font-black text-white tracking-tight">
                        {table.label}
                      </span>
                      <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-0.5">
                        <Users className="w-3 h-3 text-gray-500" />
                        <span>{table.seats} seats</span>
                      </div>
                    </div>
                    <span
                      className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${status.bg} ${status.text} border ${status.border}`}
                    >
                      {status.label}
                    </span>
                  </div>

                  {/* Active Order / Occupancy Details */}
                  {occ ? (
                    <div className="mt-2 pt-2 border-t border-gray-800/60 text-[11px]">
                      <div className="flex items-center justify-between text-gray-300 font-medium">
                        <span>Order #{occ.number}</span>
                        <span className="font-bold text-white tnum">
                          ₹{(occ.billPaise / 100).toFixed(0)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-gray-400 mt-0.5">
                        <span className="flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {formatElapsed(occ.sinceMs)}
                        </span>
                        <span className="text-amber-400/90 font-medium capitalize">
                          {occ.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 text-[11px] text-emerald-400/80 font-medium flex items-center gap-1">
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Tap to take order</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Table Actions Drawer */}
      {selectedTable && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setSelectedTable(null)}
        >
          <div
            className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-800">
              <div>
                <h2 className="text-xl font-bold text-white">Table {selectedTable.label}</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {selectedTable.seats} Seats · {getTableStatus(selectedTable).label}
                </p>
              </div>
              <button
                onClick={() => setSelectedTable(null)}
                className="w-8 h-8 rounded-full bg-gray-800 text-gray-400 hover:text-white flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Quick Actions List */}
            <div className="space-y-3 mt-3">
              {occupiedMap[selectedTable.id] && (
                <div className="p-3.5 rounded-2xl bg-gray-800/60 border border-gray-700/60 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-white">
                        Order #{occupiedMap[selectedTable.id]?.number}
                      </span>
                      <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                        <Clock className="w-3 h-3 text-gray-400" />
                        {formatElapsed(occupiedMap[selectedTable.id]!.sinceMs)} ago
                      </span>
                    </div>

                    <span
                      className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                        occupiedMap[selectedTable.id]?.status === 'served'
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : occupiedMap[selectedTable.id]?.status === 'ready'
                          ? 'bg-sky-500/15 text-sky-400 border-sky-500/30 animate-pulse'
                          : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      }`}
                    >
                      {occupiedMap[selectedTable.id]?.status === 'served'
                        ? '✓ Served'
                        : occupiedMap[selectedTable.id]?.status === 'ready'
                        ? 'Ready to Serve'
                        : 'Preparing (KOT)'}
                    </span>
                  </div>

                  {/* Ordered Items Preview */}
                  {loadingOrder ? (
                    <div className="py-2 text-[11px] text-gray-400 animate-pulse">Loading order items...</div>
                  ) : tableOrder && tableOrder.lines.length > 0 ? (
                    <div className="max-h-32 overflow-y-auto space-y-1 pr-1 border-t border-gray-700/50 pt-2">
                      {tableOrder.lines.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs text-gray-300">
                          <div className="flex items-center gap-1.5 flex-1 pr-2 truncate">
                            <span className="font-bold text-sky-400 text-[11px]">{item.qty}x</span>
                            <span className="truncate">{item.name}</span>
                            {item.station && (
                              <span className="text-[8px] uppercase px-1 py-0.5 rounded bg-gray-700/80 text-gray-300 font-semibold">
                                {item.station}
                              </span>
                            )}
                          </div>
                          <span className="text-gray-400 text-[11px] tnum">
                            ₹{(item.linePaise / 100).toFixed(0)}
                          </span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between text-xs font-bold text-white pt-1.5 border-t border-gray-700/50">
                        <span className="text-gray-400 text-[11px]">Running Total</span>
                        <span className="tnum">₹{(occupiedMap[selectedTable.id]!.billPaise / 100).toFixed(0)}</span>
                      </div>
                    </div>
                  ) : null}

                  {/* 1-Tap Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {occupiedMap[selectedTable.id]?.status !== 'served' ? (
                      <button
                        onClick={handleMarkServed}
                        disabled={actionLoading}
                        className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-98 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" />
                        <span>Mark as Served</span>
                      </button>
                    ) : (
                      <div className="py-2.5 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Food Served</span>
                      </div>
                    )}

                    {selectedTable.state === 'billed' ? (
                      <button
                        onClick={() => handleRequestBill(true)}
                        disabled={actionLoading}
                        className="py-2.5 px-3 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all"
                      >
                        <span>Cancel Bill</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRequestBill(false)}
                        disabled={actionLoading}
                        className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-98 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-purple-500/20 transition-all disabled:opacity-50"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        <span>Request Bill</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={() => router.push(`/order/${selectedTable.id}`)}
                className="w-full py-3.5 px-4 rounded-2xl bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white font-semibold flex items-center justify-between transition-all shadow-lg shadow-sky-500/20"
              >
                <div className="flex items-center gap-3">
                  <Utensils className="w-5 h-5" />
                  <span>
                    {occupiedMap[selectedTable.id] ? 'Add Items to Order' : 'Take New Order'}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-80" />
              </button>

              {occupiedMap[selectedTable.id] && (
                <>
                  <button
                    onClick={() =>
                      router.push(`/transfers?from=${selectedTable.id}&action=transfer`)
                    }
                    className="w-full py-3 px-4 rounded-xl bg-gray-800/80 hover:bg-gray-700/80 text-gray-200 font-medium flex items-center justify-between border border-gray-700/60 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <ArrowRightLeft className="w-4 h-4 text-sky-400" />
                      <span>Transfer to Another Table</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  </button>

                  <button
                    onClick={() =>
                      router.push(`/transfers?from=${selectedTable.id}&action=merge`)
                    }
                    className="w-full py-3 px-4 rounded-xl bg-gray-800/80 hover:bg-gray-700/80 text-gray-200 font-medium flex items-center justify-between border border-gray-700/60 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <Merge className="w-4 h-4 text-amber-400" />
                      <span>Merge with Another Table</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  </button>

                  <button
                    onClick={() =>
                      router.push(`/transfers?from=${selectedTable.id}&action=split`)
                    }
                    className="w-full py-3 px-4 rounded-xl bg-gray-800/80 hover:bg-gray-700/80 text-gray-200 font-medium flex items-center justify-between border border-gray-700/60 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <Split className="w-4 h-4 text-purple-400" />
                      <span>Split Order / Items</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 py-2.5 px-5 rounded-2xl bg-emerald-500 text-white font-bold text-xs shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top duration-200">
          <Check className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Bottom Navigation */}
      <WaiterBottomNav unreadAlertsCount={unreadCount} />
    </div>
  );
}
