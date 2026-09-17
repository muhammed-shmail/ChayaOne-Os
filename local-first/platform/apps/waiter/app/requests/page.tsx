'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { WaiterBottomNav } from '@/components/WaiterBottomNav';
import {
  Bell,
  BellRing,
  CheckCircle2,
  XCircle,
  Receipt,
  Utensils,
  Clock,
  RefreshCw,
  Sparkles,
  Check,
  ChevronRight,
} from 'lucide-react';

interface NotificationItem {
  id: string;
  type: string;
  severity: string;
  title: string;
  body: string | null;
  entity: string | null;
  readAt: string | null;
  at: string;
}

interface PendingApprovalOrder {
  id: string;
  number: number;
  tableLabel: string;
  totalPaise: number;
  placedAt: string;
  items: Array<{ nameSnapshot: string; qty: number; unitPricePaise: number }>;
}

export default function WaiterRequestsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [pendingOrders, setPendingOrders] = useState<PendingApprovalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchFeed = async () => {
    try {
      const [notifRes, appRes] = await Promise.all([
        fetch('/api/staff/notifications'),
        fetch('/api/approvals'),
      ]);

      if (notifRes.ok) {
        const notifData = await notifRes.json();
        const items = (notifData.items || []).filter((n: NotificationItem) => n.type !== 'reminder');
        setNotifications(items);
      }

      if (appRes.ok) {
        const appData = await appRes.json();
        const orders = (appData.orders || []).map((o: any) => ({
          id: o.id,
          number: o.number,
          tableLabel: o.table?.label || 'Takeaway',
          totalPaise: o.totalPaise,
          placedAt: o.placedAt,
          items: o.items || [],
        }));
        setPendingOrders(orders);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeed();
    const interval = setInterval(fetchFeed, 3500);
    return () => clearInterval(interval);
  }, []);

  const handleApproveOrder = async (orderId: string) => {
    setProcessingId(orderId);
    try {
      const res = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', orderId }),
      });
      if (res.ok) {
        setPendingOrders((prev) => prev.filter((o) => o.id !== orderId));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDismissNotification = async (id: string) => {
    try {
      await fetch('/api/staff/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'read', id }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleDismissAll = async () => {
    try {
      await fetch('/api/staff/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'read_all' }),
      });
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: new Date().toISOString() }))
      );
    } catch (e) {
      console.error(e);
    }
  };


  const unreadNotifs = notifications.filter((n) => !n.readAt);

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 glass-panel px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-center justify-center">
            <BellRing className="w-4 h-4 text-rose-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">Requests & Alerts</h1>
            <p className="text-[11px] text-gray-400">
              <span className="text-amber-400 font-semibold">{pendingOrders.length} QR Approvals</span> ·{' '}
              <span className="text-rose-400 font-semibold">{unreadNotifs.length} Assistance</span>
            </p>
          </div>
        </div>

        <button
          onClick={handleDismissAll}
          disabled={unreadNotifs.length === 0}
          className="text-xs text-sky-400 hover:text-sky-300 font-semibold disabled:opacity-30 transition-all"
        >
          Clear All
        </button>
      </header>

      <main className="p-3 max-w-lg mx-auto space-y-5">
        {/* 1. CUSTOMER QR ORDERS AWAITING APPROVAL */}
        {pendingOrders.length > 0 && (
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Utensils className="w-3.5 h-3.5" />
                <span>Customer QR Orders to Approve ({pendingOrders.length})</span>
              </h2>
            </div>

            <div className="space-y-2.5">
              {pendingOrders.map((order) => (
                <div
                  key={order.id}
                  className="p-4 rounded-3xl bg-amber-500/10 border border-amber-500/30 space-y-3 shadow-lg"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-base font-extrabold text-white">
                        Table {order.tableLabel}
                      </span>
                      <p className="text-xs text-amber-300/80 font-medium">Order #{order.number}</p>
                    </div>
                    <span className="text-sm font-black text-white tnum">
                      ₹{(order.totalPaise / 100).toFixed(0)}
                    </span>
                  </div>

                  <div className="space-y-1 py-1 text-xs text-gray-300">
                    {order.items.map((i, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>
                          {i.qty}× {i.nameSnapshot}
                        </span>
                        <span className="text-gray-400 tnum">
                          ₹{((i.unitPricePaise * i.qty) / 100).toFixed(0)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => handleApproveOrder(order.id)}
                    disabled={processingId === order.id}
                    className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-98 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{processingId === order.id ? 'Approving...' : 'Approve & Fire to Kitchen'}</span>
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 2. CUSTOMER ASSISTANCE & BILL CALLS */}
        <section className="space-y-2.5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5" />
            <span>Floor Assistance Feed</span>
          </h2>

          {loading ? (
            <div className="text-center py-10 text-xs text-gray-500 animate-pulse">
              Loading requests...
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12 rounded-3xl bg-gray-900/40 border border-gray-800 text-xs text-gray-500">
              No recent alerts or customer calls.
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => {
                const isUnread = !n.readAt;
                const isBill = n.type.includes('bill');

                return (
                  <div
                    key={n.id}
                    className={`p-3.5 rounded-2xl border transition-all flex items-start justify-between gap-3 ${
                      isUnread
                        ? isBill
                          ? 'bg-purple-500/10 border-purple-500/40'
                          : 'bg-rose-500/10 border-rose-500/40'
                        : 'bg-gray-900/40 border-gray-800 opacity-60'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-white">{n.title}</h4>
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                        )}
                      </div>
                      {n.body && (
                        <p className="text-[11px] text-gray-300 mt-0.5 leading-relaxed">
                          {n.body}
                        </p>
                      )}
                      <p className="text-[10px] text-gray-500 mt-1">
                        {new Date(n.at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>

                    {isUnread && (
                      <button
                        onClick={() => handleDismissNotification(n.id)}
                        className="px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-medium flex items-center gap-1 transition-all"
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Done</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Bottom Navigation */}
      <WaiterBottomNav unreadAlertsCount={unreadNotifs.length + pendingOrders.length} />
    </div>
  );
}
