'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { WaiterBottomNav } from '@/components/WaiterBottomNav';
import {
  ArrowRightLeft,
  Merge,
  Split,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Plus,
  Minus,
  RefreshCw,
  Clock,
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

export default function WaiterTransfersPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-xs text-gray-500">
          <RefreshCw className="w-6 h-6 animate-spin text-sky-400 mb-2" />
        </div>
      }
    >
      <TransfersContent />
    </Suspense>
  );
}

function TransfersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialAction = searchParams.get('action') as 'transfer' | 'merge' | 'split' | null;
  const initialFrom = searchParams.get('from');

  const [activeTab, setActiveTab] = useState<'transfer' | 'merge' | 'split'>(
    initialAction || 'transfer'
  );
  const [tables, setTables] = useState<TableItem[]>([]);
  const [occupiedMap, setOccupiedMap] = useState<Record<string, OccupancyInfo>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Transfer State
  const [sourceTableId, setSourceTableId] = useState<string>(initialFrom || '');
  const [targetTableId, setTargetTableId] = useState<string>('');
  const [transferReason, setTransferReason] = useState<string>('');

  // Split State
  const [splitOrderItems, setSplitOrderItems] = useState<any[]>([]);
  const [splitQuantities, setSplitQuantities] = useState<Record<string, number>>({});
  const [splitTargetTableId, setSplitTargetTableId] = useState<string>('');
  const [loadingItems, setLoadingItems] = useState(false);

  const fetchTables = async () => {
    try {
      const res = await fetch('/api/tables');
      if (res.ok) {
        const data = await res.json();
        setTables(data.tables || []);
        setOccupiedMap(data.occupied || {});
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, []);

  // When source table changes in Split mode, fetch items
  useEffect(() => {
    if (activeTab === 'split' && sourceTableId) {
      loadTableOrderItems(sourceTableId);
    }
  }, [sourceTableId, activeTab]);

  const loadTableOrderItems = async (tblId: string) => {
    setLoadingItems(true);
    try {
      const res = await fetch(`/api/tables/order?tableId=${tblId}`);
      if (res.ok) {
        const data = await res.json();
        const items = data.items || [];
        setSplitOrderItems(items);
        const initialQty: Record<string, number> = {};
        items.forEach((it: any) => {
          initialQty[it.id] = 0;
        });
        setSplitQuantities(initialQty);
      }
    } catch (e) {
      console.error('Failed to load table items', e);
    } finally {
      setLoadingItems(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleExecuteTransfer = async () => {
    if (!sourceTableId || !targetTableId) {
      showToast('Please select both source and destination tables');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/tables/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceTableId,
          destTableId: targetTableId,
          reason: transferReason || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.message || 'Transfer failed');
      } else {
        showToast(data.message || 'Table transferred successfully!');
        setSourceTableId('');
        setTargetTableId('');
        setTransferReason('');
        fetchTables();
      }
    } catch (e) {
      showToast('Network error executing transfer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExecuteMerge = async () => {
    if (!sourceTableId || !targetTableId) {
      showToast('Please select both source and destination tables');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/tables/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceTableId,
          destTableId: targetTableId,
          reason: transferReason || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.message || 'Merge failed');
      } else {
        showToast(data.message || 'Tables merged successfully!');
        setSourceTableId('');
        setTargetTableId('');
        setTransferReason('');
        fetchTables();
      }
    } catch (e) {
      showToast('Network error executing merge');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExecuteSplit = async () => {
    if (!sourceTableId) {
      showToast('Select a table to split');
      return;
    }

    const itemSplits = Object.entries(splitQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([orderItemId, qtyToSplit]) => ({ orderItemId, qtyToSplit }));

    if (itemSplits.length === 0) {
      showToast('Select at least 1 item to split');
      return;
    }

    setSubmitting(true);
    try {
      // Find orderId from first split item
      const firstSplit = itemSplits[0];
      const matchedItem = firstSplit ? splitOrderItems.find((i) => i.id === firstSplit.orderItemId) : null;
      const orderId = matchedItem?.orderId;

      if (!orderId) {
        showToast('Could not find active order ID');
        setSubmitting(false);
        return;
      }

      const res = await fetch('/api/tables/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          itemSplits,
          targetTableId: splitTargetTableId || undefined,
          reason: transferReason || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.message || 'Split failed');
      } else {
        showToast(data.message || 'Order split successfully!');
        setSourceTableId('');
        setSplitQuantities({});
        setSplitOrderItems([]);
        fetchTables();
      }
    } catch (e) {
      showToast('Network error executing split');
    } finally {
      setSubmitting(false);
    }
  };

  const occupiedTables = tables.filter((t) => !!occupiedMap[t.id] || t.state === 'seated');
  const availableTables = tables.filter((t) => !occupiedMap[t.id] && t.state === 'free');

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 glass-panel px-4 py-3 flex items-center justify-between">
        <h1 className="text-base font-bold text-white">Table Operations</h1>
        <button
          onClick={fetchTables}
          className="p-2 rounded-xl bg-gray-800 text-gray-300 hover:text-white"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </header>

      {/* Tabs */}
      <div className="p-3 grid grid-cols-3 gap-2">
        {[
          { key: 'transfer', label: 'Transfer', icon: ArrowRightLeft },
          { key: 'merge', label: 'Merge', icon: Merge },
          { key: 'split', label: 'Split', icon: Split },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`py-2.5 px-3 rounded-2xl flex flex-col items-center justify-center gap-1 text-xs font-bold transition-all ${
                isActive
                  ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
                  : 'bg-gray-900/60 text-gray-400 hover:text-gray-200 border border-gray-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <main className="p-3 max-w-lg mx-auto space-y-4">
        {/* 1. TABLE TRANSFER WORKSPACE */}
        {activeTab === 'transfer' && (
          <div className="space-y-4">
            <div className="p-4 rounded-3xl bg-gray-900/60 border border-gray-800 space-y-3">
              <label className="text-xs font-bold text-gray-300 block">
                1. Select Source Table (Occupied)
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {occupiedTables.length === 0 ? (
                  <p className="text-xs text-gray-500 col-span-3">No occupied tables</p>
                ) : (
                  occupiedTables.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSourceTableId(t.id)}
                      className={`p-3 rounded-xl border text-xs font-bold transition-all ${
                        sourceTableId === t.id
                          ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow'
                          : 'bg-gray-800/40 border-gray-800 text-gray-300'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="p-4 rounded-3xl bg-gray-900/60 border border-gray-800 space-y-3">
              <label className="text-xs font-bold text-gray-300 block">
                2. Select Destination Table (Available)
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {availableTables.length === 0 ? (
                  <p className="text-xs text-gray-500 col-span-3">No available free tables</p>
                ) : (
                  availableTables.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTargetTableId(t.id)}
                      className={`p-3 rounded-xl border text-xs font-bold transition-all ${
                        targetTableId === t.id
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow'
                          : 'bg-gray-800/40 border-gray-800 text-gray-300'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="p-4 rounded-3xl bg-gray-900/60 border border-gray-800 space-y-2">
              <label className="text-xs font-bold text-gray-300 block">
                3. Reason (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Guest moved outdoors, requested larger table..."
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                className="w-full p-3 rounded-xl bg-gray-800/80 border border-gray-700 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            <button
              onClick={handleExecuteTransfer}
              disabled={submitting || !sourceTableId || !targetTableId}
              className="w-full py-4 rounded-2xl bg-sky-500 hover:bg-sky-600 active:scale-98 text-white font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-sky-500/20 transition-all disabled:opacity-40"
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>{submitting ? 'Transferring...' : 'Execute Table Transfer'}</span>
            </button>
          </div>
        )}

        {/* 2. TABLE MERGE WORKSPACE */}
        {activeTab === 'merge' && (
          <div className="space-y-4">
            <div className="p-4 rounded-3xl bg-gray-900/60 border border-gray-800 space-y-3">
              <label className="text-xs font-bold text-gray-300 block">
                1. Select Source Table to Merge FROM
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {occupiedTables.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSourceTableId(t.id)}
                    className={`p-3 rounded-xl border text-xs font-bold transition-all ${
                      sourceTableId === t.id
                        ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow'
                        : 'bg-gray-800/40 border-gray-800 text-gray-300'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-3xl bg-gray-900/60 border border-gray-800 space-y-3">
              <label className="text-xs font-bold text-gray-300 block">
                2. Select Destination Table to Merge INTO
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {occupiedTables
                  .filter((t) => t.id !== sourceTableId)
                  .map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTargetTableId(t.id)}
                      className={`p-3 rounded-xl border text-xs font-bold transition-all ${
                        targetTableId === t.id
                          ? 'bg-sky-500/20 border-sky-500 text-sky-400 shadow'
                          : 'bg-gray-800/40 border-gray-800 text-gray-300'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
              </div>
            </div>

            <button
              onClick={handleExecuteMerge}
              disabled={submitting || !sourceTableId || !targetTableId}
              className="w-full py-4 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-98 text-white font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 transition-all disabled:opacity-40"
            >
              <Merge className="w-4 h-4" />
              <span>{submitting ? 'Merging Tables...' : 'Execute Table Merge'}</span>
            </button>
          </div>
        )}

        {/* 3. TABLE SPLIT WORKSPACE */}
        {activeTab === 'split' && (
          <div className="space-y-4">
            <div className="p-4 rounded-3xl bg-gray-900/60 border border-gray-800 space-y-3">
              <label className="text-xs font-bold text-gray-300 block">
                1. Select Table with Active Order
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {occupiedTables.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSourceTableId(t.id)}
                    className={`p-3 rounded-xl border text-xs font-bold transition-all ${
                      sourceTableId === t.id
                        ? 'bg-purple-500/20 border-purple-500 text-purple-400 shadow'
                        : 'bg-gray-800/40 border-gray-800 text-gray-300'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {sourceTableId && (
              <div className="p-4 rounded-3xl bg-gray-900/60 border border-gray-800 space-y-3">
                <label className="text-xs font-bold text-gray-300 block">
                  2. Select Items to Split into New Bill
                </label>

                {loadingItems ? (
                  <p className="text-xs text-gray-400 animate-pulse">Loading order lines...</p>
                ) : splitOrderItems.length === 0 ? (
                  <p className="text-xs text-gray-500">No active items on this table.</p>
                ) : (
                  <div className="space-y-2">
                    {splitOrderItems.map((item) => {
                      const splitQty = splitQuantities[item.id] || 0;
                      return (
                        <div
                          key={item.id}
                          className="p-3 rounded-xl bg-gray-800/40 border border-gray-800 flex items-center justify-between"
                        >
                          <div>
                            <p className="text-xs font-bold text-white">{item.nameSnapshot}</p>
                            <p className="text-[10px] text-gray-400">
                              Max {item.qty} · ₹{(item.unitPricePaise / 100).toFixed(0)} each
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                setSplitQuantities({
                                  ...splitQuantities,
                                  [item.id]: Math.max(0, splitQty - 1),
                                })
                              }
                              className="w-7 h-7 rounded-lg bg-gray-700 text-white flex items-center justify-center text-xs"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-5 text-center text-xs font-bold text-purple-400 tnum">
                              {splitQty}
                            </span>
                            <button
                              onClick={() =>
                                setSplitQuantities({
                                  ...splitQuantities,
                                  [item.id]: Math.min(item.qty, splitQty + 1),
                                })
                              }
                              className="w-7 h-7 rounded-lg bg-gray-700 text-white flex items-center justify-center text-xs"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleExecuteSplit}
              disabled={submitting || !sourceTableId}
              className="w-full py-4 rounded-2xl bg-purple-600 hover:bg-purple-700 active:scale-98 text-white font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-purple-600/20 transition-all disabled:opacity-40"
            >
              <Split className="w-4 h-4" />
              <span>{submitting ? 'Splitting Order...' : 'Execute Table Split'}</span>
            </button>
          </div>
        )}
      </main>

      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 py-2.5 px-5 rounded-2xl bg-gray-900 border border-sky-500/50 text-white font-bold text-xs shadow-2xl animate-in fade-in slide-in-from-top duration-200">
          {toastMessage}
        </div>
      )}

      {/* Bottom Navigation */}
      <WaiterBottomNav />
    </div>
  );
}
