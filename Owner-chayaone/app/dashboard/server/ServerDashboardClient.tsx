'use client';

import React, { useState, useEffect } from 'react';
import {
  Server,
  Database,
  Radio,
  Wifi,
  Printer,
  Cpu,
  KeyRound,
  RefreshCw,
  RotateCw,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  QrCode,
  Sliders,
  Receipt,
} from 'lucide-react';
import { BUSINESS_TYPE_LABELS, BusinessTypeId } from '@/types/modules';
import AdminActivationModal from '@/components/license/AdminActivationModal';

export default function ServerDashboardClient() {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedLan, setCopiedLan] = useState(false);
  const [testReceiptSlip, setTestReceiptSlip] = useState<any | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/server/status');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const triggerControlAction = async (action: string) => {
    setActionBusy(action);
    setFeedback(null);
    try {
      const res = await fetch('/api/server/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const result = await res.json();
      if (res.ok) {
        setFeedback({ type: 'success', message: result.message || 'Action executed successfully.' });
        if (action === 'test_print' && result.samplePayload) {
          setTestReceiptSlip(result.samplePayload);
        }
        fetchStatus();
      } else {
        setFeedback({ type: 'error', message: result.error || 'Failed to execute command.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Network error executing server command.' });
    } finally {
      setActionBusy(null);
    }
  };

  const copyText = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s}s`;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 text-[var(--ink,#fafafa)]">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-700">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Main PC Hub
            </span>
            <span className="text-xs text-zinc-400 font-mono">
              PID: {data?.server?.pid || '...'}
            </span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
            Server & Background Services
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 font-medium mt-0.5">
            Real-time diagnostics, local database engine, thermal print spooler, and commercial license manager.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => fetchStatus()}
            className="px-3.5 py-2 rounded-[12px] text-xs font-bold transition flex items-center gap-1.5 bg-zinc-800 border border-zinc-700 text-zinc-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAdminModal(true)}
            className="px-4 py-2 rounded-[12px] text-xs font-bold transition flex items-center gap-1.5 bg-emerald-600 text-white hover:bg-emerald-500"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Manage License</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-[14px] text-xs font-semibold flex items-center justify-between transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/15 border border-red-500/30 text-red-400'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-[11px] underline opacity-80 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Quick Action Bar */}
      <div className="rounded-[20px] p-4.5 flex flex-wrap items-center gap-2 sm:gap-2.5 bg-zinc-850 border border-zinc-700">
        <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 mr-2 flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5" /> Quick Controls:
        </span>

        <button
          type="button"
          disabled={!!actionBusy}
          onClick={() => triggerControlAction('restart_all')}
          className="px-3 py-1.5 rounded-[10px] text-xs font-bold transition flex items-center gap-1.5 bg-zinc-800 border border-zinc-700 text-zinc-200"
        >
          <RotateCw className={`w-3.5 h-3.5 ${actionBusy === 'restart_all' ? 'animate-spin' : ''}`} />
          <span>Restart All Services</span>
        </button>

        <button
          type="button"
          disabled={!!actionBusy}
          onClick={() => triggerControlAction('restart_server')}
          className="px-3 py-1.5 rounded-[10px] text-xs font-bold transition flex items-center gap-1.5 bg-zinc-800 border border-zinc-700 text-zinc-200"
        >
          <Server className="w-3.5 h-3.5" />
          <span>Restart Local Server</span>
        </button>

        <button
          type="button"
          disabled={!!actionBusy}
          onClick={() => triggerControlAction('restart_database')}
          className="px-3 py-1.5 rounded-[10px] text-xs font-bold transition flex items-center gap-1.5 bg-zinc-800 border border-zinc-700 text-zinc-200"
        >
          <Database className="w-3.5 h-3.5" />
          <span>Restart Database</span>
        </button>

        <button
          type="button"
          disabled={!!actionBusy}
          onClick={() => triggerControlAction('restart_realtime')}
          className="px-3 py-1.5 rounded-[10px] text-xs font-bold transition flex items-center gap-1.5 bg-zinc-800 border border-zinc-700 text-zinc-200"
        >
          <Radio className="w-3.5 h-3.5" />
          <span>Restart Realtime</span>
        </button>

        <button
          type="button"
          disabled={!!actionBusy}
          onClick={() => triggerControlAction('test_print')}
          className="px-3 py-1.5 rounded-[10px] text-xs font-bold transition flex items-center gap-1.5 bg-amber-500/20 border border-amber-500 text-amber-400"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>{actionBusy === 'test_print' ? 'Printing...' : 'Test Print Receipt'}</span>
        </button>

        <div className="hidden sm:block h-5 w-[1px] bg-zinc-700 mx-1" />

        <a
          href="http://localhost:3000/pos"
          target="_blank"
          rel="noreferrer"
          className="px-3 py-1.5 rounded-[10px] text-xs font-bold transition flex items-center gap-1.5 text-emerald-400 hover:underline"
        >
          <span>Open POS</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {/* Server */}
        <div className="rounded-[20px] p-5 space-y-4 bg-zinc-850 border border-zinc-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-emerald-500/15 text-emerald-400">
                <Server className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold">ChayaOne Server</h3>
                <span className="text-[11px] text-zinc-400 font-medium">Next.js Engine</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/15 text-emerald-400">
              RUNNING
            </span>
          </div>

          <div className="space-y-2 pt-2 border-t border-zinc-700 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-400">Port</span>
              <span className="font-mono font-bold">{data?.server?.port || 3000}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Uptime</span>
              <span className="font-medium font-mono">
                {data ? formatUptime(data.server.uptimeSeconds) : '...'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Memory RSS</span>
              <span className="font-mono font-medium">
                {data?.server?.memory?.rssMb || 0} MB
              </span>
            </div>
          </div>
        </div>

        {/* Database */}
        <div className="rounded-[20px] p-5 space-y-4 bg-zinc-850 border border-zinc-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-amber-500/15 text-amber-400">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold">PostgreSQL Engine</h3>
                <span className="text-[11px] text-zinc-400 font-medium">
                  {data?.database?.databaseName || 'chayaone_os'}
                </span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/15 text-emerald-400">
              {data?.database?.status || 'CONNECTED'}
            </span>
          </div>

          <div className="space-y-2 pt-2 border-t border-zinc-700 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-400">Port</span>
              <span className="font-mono font-bold">{data?.database?.port || 5433}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Latency</span>
              <span className="font-mono font-bold text-emerald-400">
                {data?.database?.latencyMs ?? 0} ms
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Total Orders</span>
              <span className="font-bold">{data?.database?.stats?.totalOrders ?? 0}</span>
            </div>
          </div>
        </div>

        {/* Realtime */}
        <div className="rounded-[20px] p-5 space-y-4 bg-zinc-850 border border-zinc-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-purple-500/15 text-purple-400">
                <Radio className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold">Realtime WebSocket</h3>
                <span className="text-[11px] text-zinc-400 font-medium">Order Sync & KDS</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/15 text-emerald-400">
              ACTIVE
            </span>
          </div>

          <div className="space-y-2 pt-2 border-t border-zinc-700 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-400">Port</span>
              <span className="font-mono font-bold">{data?.realtime?.port || 3001}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Broadcast Channels</span>
              <span className="font-mono font-medium">5 active</span>
            </div>
          </div>
        </div>
      </div>

      {/* Commercial License System Box */}
      <div className="rounded-[24px] p-6 space-y-4 bg-zinc-850 border border-zinc-700">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-amber-500/15 text-amber-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-display">Commercial License & Validity</h2>
              <p className="text-xs text-zinc-400">
                Local Main PC License Engine with clock tampering protection & offline-first persistence.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide ${
                data?.license?.status === 'ACTIVE'
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : data?.license?.status === 'WARNING'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-red-500/15 text-red-400'
              }`}
            >
              {data?.license?.status || 'ACTIVE'}
            </span>

            <button
              type="button"
              onClick={() => setShowAdminModal(true)}
              className="px-3.5 py-1.5 rounded-[12px] text-xs font-bold transition flex items-center gap-1.5 bg-emerald-600 text-white hover:bg-emerald-500"
            >
              <span>Activate / Renew</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Installation ID */}
          <div className="p-3.5 rounded-[14px] bg-zinc-800 border border-zinc-700 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
              Persistent Installation ID
            </span>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-bold select-all truncate text-white">
                {data?.license?.installationId || 'Loading...'}
              </span>
              <button
                type="button"
                onClick={() => copyText(data?.license?.installationId || '', setCopiedId)}
                className="p-1 rounded text-zinc-400 hover:text-white shrink-0"
              >
                {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Expiry & Days Remaining */}
          <div className="p-3.5 rounded-[14px] bg-zinc-800 border border-zinc-700 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
              License Expiry & Countdown
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-bold text-white">
                {data?.license?.expiresAt
                  ? new Date(data.license.expiresAt).toLocaleDateString()
                  : 'Active'}
              </span>
              <span
                className={`text-xs font-extrabold ${
                  (data?.license?.daysRemaining ?? 99) <= 3
                    ? 'text-red-400'
                    : (data?.license?.daysRemaining ?? 99) <= 10
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                ({data?.license?.daysRemaining ?? 0} days remaining)
              </span>
            </div>
          </div>

          {/* Business Modules Presets */}
          <div className="p-3.5 rounded-[14px] bg-zinc-800 border border-zinc-700 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
              Enabled Business Types
            </span>
            <div className="flex flex-wrap gap-1">
              {(data?.license?.businessTypes || ['cafe']).map((typeId: string) => (
                <span
                  key={typeId}
                  className="px-2 py-0.5 rounded-[6px] text-[10px] font-bold bg-zinc-700 border border-zinc-600 text-emerald-400"
                >
                  {(BUSINESS_TYPE_LABELS as any)[typeId] || typeId}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <AdminActivationModal
        isOpen={showAdminModal}
        onClose={() => setShowAdminModal(false)}
        installationId={data?.license?.installationId || ''}
        onSuccess={() => {
          fetchStatus();
          setFeedback({
            type: 'success',
            message: 'Commercial license updated and verified successfully!',
          });
        }}
      />
    </div>
  );
}
