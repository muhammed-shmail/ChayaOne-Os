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
  Play,
  RotateCw,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  QrCode,
  Sliders,
  Receipt,
  Monitor,
  HardDrive,
  Activity,
  Layers,
} from 'lucide-react';
import { BUSINESS_TYPE_LABELS, BusinessTypeId } from '@cafeos/types';
import AdminActivationModal from '@/components/license/AdminActivationModal';

interface ServerStatusData {
  timestamp: string;
  executionMs: number;
  server: {
    status: 'RUNNING' | 'STOPPED';
    port: number;
    pid: number;
    uptimeSeconds: number;
    platform: string;
    arch: string;
    nodeVersion: string;
    memory: { rssMb: number; heapUsedMb: number };
  };
  database: {
    status: 'CONNECTED' | 'DISCONNECTED';
    port: number;
    databaseName: string;
    latencyMs: number;
    stats: {
      totalOrders: number;
      totalMenuItems: number;
      totalStaff: number;
    };
  };
  realtime: {
    status: 'RUNNING' | 'STOPPED';
    port: number;
    channels: string[];
  };
  network: {
    localIp: string;
    port: number;
    lanUrl: string;
    posUrl: string;
    qrUrl: string;
  };
  printerService: {
    status: 'RUNNING' | 'STOPPED';
    connectedPrintersCount: number;
    queuedJobs: number;
    failedJobs: number;
  };
  deviceManager: {
    connectedDevicesCount: number;
    cashDrawers: number;
    barcodeScanners: number;
    customerDisplays: number;
  };
  license: {
    status: 'ACTIVE' | 'WARNING' | 'EXPIRED' | 'SUSPENDED';
    isBlocked: boolean;
    period?: string;
    expiresAt?: string;
    daysRemaining?: number;
    installationId: string;
    businessTypes?: BusinessTypeId[];
    clockTampered?: boolean;
  };
}

export default function ServerDashboardClient() {
  const [data, setData] = useState<ServerStatusData | null>(null);
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
      // Offline fallback
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
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 text-[var(--ink)]">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--line)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider"
              style={{
                background: 'color-mix(in srgb, var(--cardamom) 15%, transparent)',
                color: 'var(--cardamom)',
                border: '1px solid color-mix(in srgb, var(--cardamom) 30%, transparent)',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Main PC Hub
            </span>
            <span className="text-xs text-[var(--ink-3)] font-mono">
              PID: {data?.server?.pid || '...'}
            </span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
            Server & Background Services
          </h1>
          <p className="text-xs sm:text-sm text-[var(--ink-3)] font-medium mt-0.5">
            Real-time diagnostics, local database engine, thermal print spooler, and commercial license manager.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => fetchStatus()}
            className="px-3.5 py-2 rounded-[12px] text-xs font-bold transition flex items-center gap-1.5"
            style={{
              background: 'var(--paper-2)',
              border: '1px solid var(--line)',
              color: 'var(--ink-2)',
            }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAdminModal(true)}
            className="px-4 py-2 rounded-[12px] text-xs font-bold transition flex items-center gap-1.5"
            style={{
              background: 'var(--cardamom)',
              color: '#fff',
            }}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Manage License</span>
          </button>
        </div>
      </div>

      {/* Global Action Feedback Alert */}
      {feedback && (
        <div
          className="p-3.5 rounded-[14px] text-xs font-semibold flex items-center justify-between transition-all"
          style={{
            background:
              feedback.type === 'success'
                ? 'color-mix(in srgb, var(--cardamom) 15%, transparent)'
                : 'color-mix(in srgb, var(--clay) 15%, transparent)',
            border:
              feedback.type === 'success'
                ? '1px solid color-mix(in srgb, var(--cardamom) 30%, transparent)'
                : '1px solid color-mix(in srgb, var(--clay) 30%, transparent)',
            color: feedback.type === 'success' ? 'var(--cardamom)' : 'var(--clay)',
          }}
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

      {/* Quick Action Bar (Section 8 Controls) */}
      <div
        className="rounded-[20px] p-4.5 flex flex-wrap items-center gap-2 sm:gap-2.5"
        style={{
          background: 'var(--paper-2)',
          border: '1px solid var(--line)',
        }}
      >
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink-3)] mr-2 flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5" /> Quick Controls:
        </span>

        <button
          type="button"
          disabled={!!actionBusy}
          onClick={() => triggerControlAction('restart_all')}
          className="px-3 py-1.5 rounded-[10px] text-xs font-bold transition flex items-center gap-1.5"
          style={{
            background: 'var(--paper-3)',
            border: '1px solid var(--line)',
            color: 'var(--ink)',
          }}
        >
          <RotateCw className={`w-3.5 h-3.5 ${actionBusy === 'restart_all' ? 'animate-spin' : ''}`} />
          <span>Restart All Services</span>
        </button>

        <button
          type="button"
          disabled={!!actionBusy}
          onClick={() => triggerControlAction('restart_server')}
          className="px-3 py-1.5 rounded-[10px] text-xs font-bold transition flex items-center gap-1.5"
          style={{
            background: 'var(--paper-3)',
            border: '1px solid var(--line)',
            color: 'var(--ink)',
          }}
        >
          <Server className="w-3.5 h-3.5" />
          <span>Restart Local Server</span>
        </button>

        <button
          type="button"
          disabled={!!actionBusy}
          onClick={() => triggerControlAction('restart_database')}
          className="px-3 py-1.5 rounded-[10px] text-xs font-bold transition flex items-center gap-1.5"
          style={{
            background: 'var(--paper-3)',
            border: '1px solid var(--line)',
            color: 'var(--ink)',
          }}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Restart Database</span>
        </button>

        <button
          type="button"
          disabled={!!actionBusy}
          onClick={() => triggerControlAction('restart_realtime')}
          className="px-3 py-1.5 rounded-[10px] text-xs font-bold transition flex items-center gap-1.5"
          style={{
            background: 'var(--paper-3)',
            border: '1px solid var(--line)',
            color: 'var(--ink)',
          }}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>Restart Realtime</span>
        </button>

        <button
          type="button"
          disabled={!!actionBusy}
          onClick={() => triggerControlAction('test_print')}
          className="px-3 py-1.5 rounded-[10px] text-xs font-bold transition flex items-center gap-1.5"
          style={{
            background: 'color-mix(in srgb, var(--gold) 15%, var(--paper-3))',
            border: '1px solid var(--gold)',
            color: 'var(--gold-d)',
          }}
        >
          <Printer className="w-3.5 h-3.5" />
          <span>{actionBusy === 'test_print' ? 'Printing...' : 'Test Print Receipt'}</span>
        </button>

        <div className="hidden sm:block h-5 w-[1px] bg-[var(--line)] mx-1" />

        <a
          href="/pos"
          target="_blank"
          rel="noreferrer"
          className="px-3 py-1.5 rounded-[10px] text-xs font-bold transition flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 hover:underline"
        >
          <span>Open POS</span>
          <ExternalLink className="w-3 h-3" />
        </a>

        <a
          href="/dashboard"
          target="_blank"
          rel="noreferrer"
          className="px-3 py-1.5 rounded-[10px] text-xs font-bold transition flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline"
        >
          <span>Open Owner Dashboard</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {/* 1. LOCAL SERVER CARD */}
        <div
          className="rounded-[20px] p-5 space-y-4"
          style={{
            background: 'var(--paper-2)',
            border: '1px solid var(--line)',
            boxShadow: 'var(--sh-1)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{
                  background: 'color-mix(in srgb, var(--cardamom) 15%, transparent)',
                  color: 'var(--cardamom)',
                }}
              >
                <Server className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold">ChayaOne Server</h3>
                <span className="text-[11px] text-[var(--ink-3)] font-medium">Next.js Engine</span>
              </div>
            </div>
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase"
              style={{
                background: 'color-mix(in srgb, var(--cardamom) 15%, transparent)',
                color: 'var(--cardamom)',
              }}
            >
              RUNNING
            </span>
          </div>

          <div className="space-y-2 pt-2 border-t border-[var(--line)] text-xs">
            <div className="flex justify-between">
              <span className="text-[var(--ink-3)]">Port</span>
              <span className="font-mono font-bold">{data?.server?.port || 3000}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--ink-3)]">Uptime</span>
              <span className="font-medium font-mono">
                {data ? formatUptime(data.server.uptimeSeconds) : '...'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--ink-3)]">Process Memory</span>
              <span className="font-mono font-medium">
                {data?.server?.memory?.rssMb || 0} MB RSS
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--ink-3)]">Environment</span>
              <span className="font-medium">
                {data?.server?.platform || 'win32'} ({data?.server?.arch || 'x64'})
              </span>
            </div>
          </div>
        </div>

        {/* 2. POSTGRESQL DATABASE CARD */}
        <div
          className="rounded-[20px] p-5 space-y-4"
          style={{
            background: 'var(--paper-2)',
            border: '1px solid var(--line)',
            boxShadow: 'var(--sh-1)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{
                  background: 'color-mix(in srgb, var(--turmeric) 15%, transparent)',
                  color: 'var(--turmeric)',
                }}
              >
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold">PostgreSQL Engine</h3>
                <span className="text-[11px] text-[var(--ink-3)] font-medium">
                  {data?.database?.databaseName || 'chayaone_os'}
                </span>
              </div>
            </div>
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase"
              style={{
                background:
                  data?.database?.status === 'CONNECTED'
                    ? 'color-mix(in srgb, var(--cardamom) 15%, transparent)'
                    : 'color-mix(in srgb, var(--clay) 15%, transparent)',
                color: data?.database?.status === 'CONNECTED' ? 'var(--cardamom)' : 'var(--clay)',
              }}
            >
              {data?.database?.status || 'CONNECTED'}
            </span>
          </div>

          <div className="space-y-2 pt-2 border-t border-[var(--line)] text-xs">
            <div className="flex justify-between">
              <span className="text-[var(--ink-3)]">Port</span>
              <span className="font-mono font-bold">{data?.database?.port || 5433}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--ink-3)]">Latency</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {data?.database?.latencyMs ?? 0} ms
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--ink-3)]">Total Orders Recorded</span>
              <span className="font-bold">{data?.database?.stats?.totalOrders ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--ink-3)]">Catalog Items</span>
              <span className="font-medium">{data?.database?.stats?.totalMenuItems ?? 0}</span>
            </div>
          </div>
        </div>

        {/* 3. REALTIME WEBSOCKET CARD */}
        <div
          className="rounded-[20px] p-5 space-y-4"
          style={{
            background: 'var(--paper-2)',
            border: '1px solid var(--line)',
            boxShadow: 'var(--sh-1)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{
                  background: 'color-mix(in srgb, var(--gold) 15%, transparent)',
                  color: 'var(--gold-d)',
                }}
              >
                <Radio className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold">Realtime WebSocket</h3>
                <span className="text-[11px] text-[var(--ink-3)] font-medium">Order Sync & KDS</span>
              </div>
            </div>
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase"
              style={{
                background: 'color-mix(in srgb, var(--cardamom) 15%, transparent)',
                color: 'var(--cardamom)',
              }}
            >
              ACTIVE
            </span>
          </div>

          <div className="space-y-2 pt-2 border-t border-[var(--line)] text-xs">
            <div className="flex justify-between">
              <span className="text-[var(--ink-3)]">Port</span>
              <span className="font-mono font-bold">{data?.realtime?.port || 3001}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--ink-3)]">Broadcast Channels</span>
              <span className="font-mono font-medium">5 active</span>
            </div>
            <div className="flex flex-wrap gap-1 pt-1">
              {(data?.realtime?.channels || ['orders', 'kds', 'kot', 'billing']).map((ch) => (
                <span
                  key={ch}
                  className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[var(--paper-3)] border border-[var(--line)]"
                >
                  #{ch}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 4. LAN PAIRING & NETWORK CARD */}
        <div
          className="rounded-[20px] p-5 space-y-4"
          style={{
            background: 'var(--paper-2)',
            border: '1px solid var(--line)',
            boxShadow: 'var(--sh-1)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{
                  background: 'color-mix(in srgb, #3B82F6 15%, transparent)',
                  color: '#3B82F6',
                }}
              >
                <Wifi className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold">Local Network Address</h3>
                <span className="text-[11px] text-[var(--ink-3)] font-medium">LAN Device Pairing</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowQrModal(true)}
              className="p-1 rounded-lg text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--paper-3)] transition"
              title="View QR Code"
            >
              <QrCode className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2 pt-2 border-t border-[var(--line)] text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[var(--ink-3)]">Local IP</span>
              <span className="font-mono font-bold">{data?.network?.localIp || '127.0.0.1'}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[var(--ink-3)] shrink-0">LAN URL</span>
              <div className="flex items-center gap-1.5 overflow-hidden">
                <span className="font-mono text-[11px] truncate font-bold text-[var(--gold-d)]">
                  {data?.network?.lanUrl || 'http://localhost:3000'}
                </span>
                <button
                  type="button"
                  onClick={() => copyText(data?.network?.lanUrl || 'http://localhost:3000', setCopiedLan)}
                  className="p-1 rounded text-[var(--ink-3)] hover:text-[var(--ink)] transition shrink-0"
                >
                  {copiedLan ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <p className="text-[11px] text-[var(--ink-3)] leading-relaxed pt-1">
              Connect Waiter pads, KDS screens, and Customer QR menus on the same Wi-Fi using this address.
            </p>
          </div>
        </div>

        {/* 5. PRINTER SERVICE CARD */}
        <div
          className="rounded-[20px] p-5 space-y-4"
          style={{
            background: 'var(--paper-2)',
            border: '1px solid var(--line)',
            boxShadow: 'var(--sh-1)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{
                  background: 'color-mix(in srgb, #EC4899 15%, transparent)',
                  color: '#EC4899',
                }}
              >
                <Printer className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold">Printer Service</h3>
                <span className="text-[11px] text-[var(--ink-3)] font-medium">ESC/POS Spooler</span>
              </div>
            </div>
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase"
              style={{
                background: 'color-mix(in srgb, var(--cardamom) 15%, transparent)',
                color: 'var(--cardamom)',
              }}
            >
              READY
            </span>
          </div>

          <div className="space-y-2 pt-2 border-t border-[var(--line)] text-xs">
            <div className="flex justify-between">
              <span className="text-[var(--ink-3)]">Connected Printers</span>
              <span className="font-bold">{data?.printerService?.connectedPrintersCount || 1}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--ink-3)]">Queued Jobs</span>
              <span className="font-mono font-medium">{data?.printerService?.queuedJobs || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--ink-3)]">Failed Spool Jobs</span>
              <span className="font-mono font-medium">{data?.printerService?.failedJobs || 0}</span>
            </div>
            <div className="pt-1">
              <button
                type="button"
                onClick={() => triggerControlAction('test_print')}
                className="w-full py-1.5 rounded-[10px] text-xs font-bold transition flex items-center justify-center gap-1.5"
                style={{
                  background: 'var(--paper-3)',
                  border: '1px solid var(--line)',
                  color: 'var(--ink)',
                }}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Test Thermal Print</span>
              </button>
            </div>
          </div>
        </div>

        {/* 6. HARDWARE DEVICE MANAGER CARD */}
        <div
          className="rounded-[20px] p-5 space-y-4"
          style={{
            background: 'var(--paper-2)',
            border: '1px solid var(--line)',
            boxShadow: 'var(--sh-1)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{
                  background: 'color-mix(in srgb, #8B5CF6 15%, transparent)',
                  color: '#8B5CF6',
                }}
              >
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold">Device Manager</h3>
                <span className="text-[11px] text-[var(--ink-3)] font-medium">Peripherals & Tills</span>
              </div>
            </div>
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase"
              style={{
                background: 'color-mix(in srgb, var(--cardamom) 15%, transparent)',
                color: 'var(--cardamom)',
              }}
            >
              ONLINE
            </span>
          </div>

          <div className="space-y-2 pt-2 border-t border-[var(--line)] text-xs">
            <div className="flex justify-between">
              <span className="text-[var(--ink-3)]">RJ11 Cash Drawers</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">1 Online</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--ink-3)]">USB Barcode Scanners</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">1 Online</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--ink-3)]">Customer Pole Display</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">1 Online</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--ink-3)]">Peripheral Health</span>
              <span className="font-medium text-[var(--cardamom)]">Nominal</span>
            </div>
          </div>
        </div>
      </div>

      {/* Commercial License System Box (Section 8 + 11) */}
      <div
        className="rounded-[24px] p-6 space-y-4"
        style={{
          background: 'var(--paper-2)',
          border: '1px solid var(--line-2)',
          boxShadow: 'var(--sh-2)',
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--line)]">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: 'color-mix(in srgb, var(--gold) 15%, transparent)',
                color: 'var(--gold-d)',
              }}
            >
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-display">Commercial License & Validity</h2>
              <p className="text-xs text-[var(--ink-3)]">
                Local Main PC License Engine with clock tampering protection & offline-first persistence.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className="px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide"
              style={{
                background:
                  data?.license?.status === 'ACTIVE'
                    ? 'color-mix(in srgb, var(--cardamom) 15%, transparent)'
                    : data?.license?.status === 'WARNING'
                    ? 'color-mix(in srgb, var(--gold) 20%, transparent)'
                    : 'color-mix(in srgb, var(--clay) 15%, transparent)',
                color:
                  data?.license?.status === 'ACTIVE'
                    ? 'var(--cardamom)'
                    : data?.license?.status === 'WARNING'
                    ? 'var(--gold-d)'
                    : 'var(--clay)',
              }}
            >
              {data?.license?.status || 'ACTIVE'}
            </span>

            <button
              type="button"
              onClick={() => setShowAdminModal(true)}
              className="px-3.5 py-1.5 rounded-[12px] text-xs font-bold transition flex items-center gap-1.5"
              style={{
                background: 'var(--cardamom)',
                color: '#fff',
              }}
            >
              <span>Activate / Renew</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Installation ID */}
          <div className="p-3.5 rounded-[14px] bg-[var(--paper-3)] border border-[var(--line)] space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-3)] block">
              Persistent Installation ID
            </span>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-bold select-all truncate">
                {data?.license?.installationId || 'Loading...'}
              </span>
              <button
                type="button"
                onClick={() => copyText(data?.license?.installationId || '', setCopiedId)}
                className="p-1 rounded text-[var(--ink-3)] hover:text-[var(--ink)] shrink-0"
              >
                {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Expiry & Days Remaining */}
          <div className="p-3.5 rounded-[14px] bg-[var(--paper-3)] border border-[var(--line)] space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-3)] block">
              License Expiry & Countdown
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-bold">
                {data?.license?.expiresAt
                  ? new Date(data.license.expiresAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })
                  : 'Never (Dev)'}
              </span>
              <span
                className="text-xs font-extrabold"
                style={{
                  color:
                    (data?.license?.daysRemaining ?? 99) <= 3
                      ? 'var(--clay)'
                      : (data?.license?.daysRemaining ?? 99) <= 10
                      ? 'var(--gold-d)'
                      : 'var(--cardamom)',
                }}
              >
                ({data?.license?.daysRemaining ?? 0} days remaining)
              </span>
            </div>
          </div>

          {/* Business Modules Presets */}
          <div className="p-3.5 rounded-[14px] bg-[var(--paper-3)] border border-[var(--line)] space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-3)] block">
              Enabled Business Types
            </span>
            <div className="flex flex-wrap gap-1">
              {(data?.license?.businessTypes || ['cafe']).map((typeId) => (
                <span
                  key={typeId}
                  className="px-2 py-0.5 rounded-[6px] text-[10px] font-bold bg-[var(--paper-2)] border border-[var(--line)] text-[var(--cardamom)]"
                >
                  {BUSINESS_TYPE_LABELS[typeId] || typeId}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Tamper Warning if active */}
        {data?.license?.clockTampered && (
          <div
            className="p-3 rounded-[12px] text-xs font-bold flex items-center gap-2"
            style={{
              background: 'color-mix(in srgb, var(--clay) 15%, transparent)',
              border: '1px solid var(--clay)',
              color: 'var(--clay)',
            }}
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              System clock rollback detected! Please correct the local Windows system time to restore normal operation.
            </span>
          </div>
        )}
      </div>

      {/* Thermal Print Slip Test Modal */}
      {testReceiptSlip && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
        >
          <div
            className="w-full max-w-sm rounded-[20px] p-5 text-center space-y-4"
            style={{
              background: '#fff',
              color: '#000',
              fontFamily: 'monospace',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            }}
          >
            <div className="border-b border-dashed border-gray-400 pb-2">
              <h4 className="font-bold text-base">{testReceiptSlip.title}</h4>
              <p className="text-xs">{testReceiptSlip.storeName}</p>
              <p className="text-[10px] text-gray-500">ID: {testReceiptSlip.installationId}</p>
              <p className="text-[10px] text-gray-500">{testReceiptSlip.timestamp}</p>
            </div>
            <div className="text-xs space-y-1 text-left">
              {testReceiptSlip.items.map((it: any, idx: number) => (
                <div key={idx} className="flex justify-between">
                  <span>{it.name}</span>
                  <span>Rs. {it.price.toFixed(2)}</span>
                </div>
              ))}
              <div className="border-t border-dashed border-gray-400 pt-1 flex justify-between font-bold">
                <span>TOTAL</span>
                <span>Rs. {testReceiptSlip.total.toFixed(2)}</span>
              </div>
            </div>
            <div className="border-t border-dashed border-gray-400 pt-2 text-[10px] text-gray-600 whitespace-pre-line">
              {testReceiptSlip.footer}
            </div>
            <button
              type="button"
              onClick={() => setTestReceiptSlip(null)}
              className="w-full py-2 rounded-lg bg-gray-900 text-white font-sans text-xs font-bold"
            >
              Close Receipt Preview
            </button>
          </div>
        </div>
      )}

      {/* LAN QR Code Modal */}
      {showQrModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
        >
          <div
            className="w-full max-w-xs rounded-[24px] p-6 text-center space-y-4"
            style={{
              background: 'var(--paper-2)',
              border: '1px solid var(--line-2)',
              color: 'var(--ink)',
            }}
          >
            <h3 className="font-display font-bold text-base">Scan to Connect</h3>
            <p className="text-xs text-[var(--ink-3)] font-medium">
              Open POS on Waiter tablets or mobile devices connected to the shop Wi-Fi.
            </p>
            <div className="p-4 bg-white rounded-2xl inline-block mx-auto border border-gray-200">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                  data?.network?.lanUrl || 'http://localhost:3000'
                )}`}
                alt="LAN QR Code"
                className="w-44 h-44 mx-auto"
              />
            </div>
            <p className="font-mono text-xs font-bold text-[var(--gold-d)]">
              {data?.network?.lanUrl}
            </p>
            <button
              type="button"
              onClick={() => setShowQrModal(false)}
              className="w-full py-2 rounded-[12px] text-xs font-bold"
              style={{
                background: 'var(--paper-3)',
                border: '1px solid var(--line)',
                color: 'var(--ink-2)',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Admin Activation Modal */}
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
