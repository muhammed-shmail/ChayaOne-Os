'use client';

import { useState, useEffect } from 'react';
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
} from 'lucide-react';

interface TableItem {
  id: string;
  label: string;
  seats: number;
  state: 'free' | 'seated' | 'billed';
}

interface OccupancyInfo {
  number: number;
  sinceMs: number;
  billPaise: number;
  orders: number;
  status: string;
}

export default function WaiterTablesPage() {
  const router = useRouter();
  const [tables, setTables] = useState<TableItem[]>([]);
  const [occupiedMap, setOccupiedMap] = useState<Record<string, OccupancyInfo>>({});
  const [filter, setFilter] = useState<'all' | 'free' | 'occupied' | 'billed'>('all');
  const [selectedTable, setSelectedTable] = useState<TableItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchTables = async () => {
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
  };

  const fetchAlertsCount = async () => {
    try {
      const res = await fetch('/api/notifications?unread=1');
      if (res.ok) {
        const d = await res.json();
        setUnreadCount(d.unread || 0);
      }
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    fetchTables();
    fetchAlertsCount();

    // Auto-polling interval for resilience
    const interval = setInterval(() => {
      fetchTables();
      fetchAlertsCount();
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTables();
    fetchAlertsCount();
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.push('/login');
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
            <div className="space-y-2 mt-4">
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

      {/* Bottom Navigation */}
      <WaiterBottomNav unreadAlertsCount={unreadCount} />
    </div>
  );
}
