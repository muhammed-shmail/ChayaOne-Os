'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  RefreshCw,
  ShieldCheck,
  HardDrive,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Download,
  Clock,
  Layers,
  FileText,
  Server,
  Terminal,
  Cpu,
  Info,
  Calendar,
  Zap,
} from 'lucide-react';

interface SystemManagementProps {
  initialTab?: 'about' | 'updates' | 'history' | 'backup' | 'diagnostics';
  flashMessage?: (msg: string) => void;
}

export default function SystemManagement({
  initialTab = 'about',
  flashMessage = (msg) => console.log(msg),
}: SystemManagementProps) {
  const [activeTab, setActiveTab] = useState<'about' | 'updates' | 'history' | 'backup' | 'diagnostics'>(initialTab);

  // About State
  const [aboutData, setAboutData] = useState<any>(null);

  // Updates State
  const [updateState, setUpdateState] = useState<any>(null);
  const [updateChecking, setUpdateChecking] = useState(false);
  const [channel, setChannel] = useState<'stable' | 'beta'>('stable');

  // History State
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Backup State
  const [backupsList, setBackupsList] = useState<any[]>([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  // Diagnostics State
  const [diagData, setDiagData] = useState<any>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);

  // Fetch initial data
  useEffect(() => {
    loadAbout();
    loadUpdateState();
  }, []);

  useEffect(() => {
    if (activeTab === 'history') loadHistory();
    if (activeTab === 'backup') loadBackups();
    if (activeTab === 'diagnostics') loadDiagnostics();
  }, [activeTab]);

  const loadAbout = async () => {
    try {
      const res = await fetch('/api/system/about');
      if (res.ok) setAboutData(await res.json());
    } catch {
      // Ignore
    }
  };

  const loadUpdateState = async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).chayaOne?.getUpdateStatus) {
        const desktopStatus = await (window as any).chayaOne.getUpdateStatus();
        if (desktopStatus) {
          setUpdateState(desktopStatus);
          return;
        }
      }
      const res = await fetch('/api/system/updates');
      if (res.ok) {
        const data = await res.json();
        setUpdateState(data);
        if (data.channel) setChannel(data.channel);
      }
    } catch {
      // Ignore
    }
  };

  const handleCheckUpdates = async () => {
    setUpdateChecking(true);
    try {
      if (typeof window !== 'undefined' && (window as any).chayaOne?.checkForUpdates) {
        const result = await (window as any).chayaOne.checkForUpdates();
        flashMessage(result.message || 'Update check completed.');
        await loadUpdateState();
        return;
      }
      const res = await fetch('/api/system/updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check', channel }),
      });
      const data = await res.json();
      flashMessage(data.message || 'Update check completed.');
      await loadUpdateState();
    } catch (err: any) {
      flashMessage('Failed to check for updates. Operating locally.');
    } finally {
      setUpdateChecking(false);
    }
  };

  const handleRestartAndInstall = () => {
    if (typeof window !== 'undefined' && (window as any).chayaOne?.quitAndInstall) {
      (window as any).chayaOne.quitAndInstall();
    } else {
      flashMessage('Restart & Install is available inside the Windows Desktop App.');
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/system/updates/history');
      if (res.ok) {
        const data = await res.json();
        setHistoryList(data.history || []);
      }
    } catch {
      // Ignore
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadBackups = async () => {
    setBackupLoading(true);
    try {
      const res = await fetch('/api/system/backups');
      if (res.ok) {
        const data = await res.json();
        setBackupsList(data.backups || []);
      }
    } catch {
      // Ignore
    } finally {
      setBackupLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    setBackingUp(true);
    try {
      const res = await fetch('/api/system/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', type: 'MANUAL' }),
      });
      const data = await res.json();
      if (data.success) {
        flashMessage('✓ Manual database backup created successfully.');
        await loadBackups();
      } else {
        flashMessage('Backup generation failed.');
      }
    } catch {
      flashMessage('Error creating database backup.');
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestoreBackup = async (backupId: string) => {
    const confirmRestore = window.confirm(
      'WARNING: Restoring this backup will replace current database tables with data from this snapshot. A safety backup will be taken automatically before restoring. Proceed?'
    );
    if (!confirmRestore) return;

    setRestoringId(backupId);
    try {
      const res = await fetch('/api/system/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore', backupId }),
      });
      const data = await res.json();
      if (data.success) {
        flashMessage(`✓ ${data.message}`);
        await loadBackups();
      } else {
        flashMessage(`Restore failed: ${data.error || data.message}`);
      }
    } catch (err: any) {
      flashMessage(`Restore error: ${err.message}`);
    } finally {
      setRestoringId(null);
    }
  };

  const loadDiagnostics = async () => {
    setDiagLoading(true);
    try {
      const res = await fetch('/api/system/diagnostics');
      if (res.ok) {
        setDiagData(await res.json());
      }
    } catch {
      // Ignore
    } finally {
      setDiagLoading(false);
    }
  };

  const handleExportSupportReport = async () => {
    setGeneratingReport(true);
    try {
      const res = await fetch('/api/system/diagnostics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'report' }),
      });
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chayaone-support-report-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        flashMessage('✓ Sanitized Support Report generated and downloaded.');
      }
    } catch {
      flashMessage('Failed to generate support report.');
    } finally {
      setGeneratingReport(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Sub-Navigation Tabs */}
      <div className="flex border-b border-gray-200 dark:border-slate-800 gap-2 pb-2">
        <button
          onClick={() => setActiveTab('about')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 ${
            activeTab === 'about'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'
          }`}
        >
          <Info size={16} /> About ChayaOne
        </button>
        <button
          onClick={() => setActiveTab('updates')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 ${
            activeTab === 'updates'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'
          }`}
        >
          <RefreshCw size={16} /> Updates
          {updateState?.manifest && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 ${
            activeTab === 'history'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'
          }`}
        >
          <Clock size={16} /> Update History
        </button>
        <button
          onClick={() => setActiveTab('backup')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 ${
            activeTab === 'backup'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'
          }`}
        >
          <HardDrive size={16} /> Backup &amp; Recovery
        </button>
        <button
          onClick={() => setActiveTab('diagnostics')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 ${
            activeTab === 'diagnostics'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'
          }`}
        >
          <Activity size={16} /> Diagnostics
        </button>
      </div>

      {/* ──────────────── TAB 1: ABOUT CHAYAONE ──────────────── */}
      {activeTab === 'about' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Sparkles size={28} />
              </div>
              <div>
                <h2 className="text-2xl font-bold font-display tracking-tight text-gray-900 dark:text-white">
                  {aboutData?.appName || 'ChayaOne OS'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Production Local-First Operating System for Cafes &amp; Restaurants
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200/80 dark:border-slate-800">
                <div className="text-xs text-gray-500 dark:text-slate-400">Application Version</div>
                <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                  v{aboutData?.version || '1.0.0'}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200/80 dark:border-slate-800">
                <div className="text-xs text-gray-500 dark:text-slate-400">Build Number</div>
                <div className="text-lg font-bold font-mono text-gray-800 dark:text-slate-200 mt-1">
                  {aboutData?.build || '20260905'}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200/80 dark:border-slate-800">
                <div className="text-xs text-gray-500 dark:text-slate-400">Release Channel</div>
                <div className="text-lg font-bold capitalize text-gray-800 dark:text-slate-200 mt-1">
                  {aboutData?.channel || 'Stable'}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200/80 dark:border-slate-800">
                <div className="text-xs text-gray-500 dark:text-slate-400">Database Engine</div>
                <div className="text-sm font-semibold text-gray-800 dark:text-slate-200 mt-1">
                  {aboutData?.databaseEngine || 'PostgreSQL 16 (Embedded)'}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200/80 dark:border-slate-800">
                <div className="text-xs text-gray-500 dark:text-slate-400">Runtime Mode</div>
                <div className="text-sm font-semibold uppercase text-gray-800 dark:text-slate-200 mt-1">
                  {aboutData?.runtimeMode || 'LOCAL (Zero Cloud Dependency)'}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200/80 dark:border-slate-800">
                <div className="text-xs text-gray-500 dark:text-slate-400">Local Store</div>
                <div className="text-sm font-semibold text-gray-800 dark:text-slate-200 mt-1">
                  {aboutData?.cafeName} — {aboutData?.outletName}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-slate-800 text-xs text-gray-400 dark:text-slate-500 flex justify-between items-center">
              <span>{aboutData?.copyright || '© 2026 Nuro7 / ChayaOne'}</span>
              <span>Node {aboutData?.nodeVersion} on Windows</span>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── TAB 2: UPDATES ──────────────── */}
      {activeTab === 'updates' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 pb-6 border-b border-gray-200 dark:border-slate-800">
              <div>
                <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  CHAYAONE UPDATE MANAGER
                </div>
                <h2 className="text-xl font-bold font-display mt-1 text-gray-900 dark:text-white">
                  System Updates &amp; Release Channels
                </h2>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  Automated background checks with rollback and database safety
                </p>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as any)}
                  className="px-3 py-2 text-xs font-medium rounded-lg bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-200"
                >
                  <option value="stable">Stable Channel (Production)</option>
                  <option value="beta">Beta Channel (Testing)</option>
                </select>

                <button
                  onClick={handleCheckUpdates}
                  disabled={updateChecking}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-2"
                >
                  <RefreshCw size={14} className={updateChecking ? 'animate-spin' : ''} />
                  {updateChecking ? 'Checking...' : 'Check for Updates'}
                </button>
              </div>
            </div>

            {/* Current Status Banner */}
            <div className="mt-6 p-5 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/40">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mt-0.5">
                  <ShieldCheck size={22} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      Current Installed Version:
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      v{updateState?.currentVersion || '1.0.0'}
                    </span>
                  </div>

                  {updateState?.state === 'DOWNLOADED' ? (
                    <div className="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200">
                      <div className="flex items-center gap-2 font-bold text-sm text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 size={16} /> Update Downloaded: v{updateState.targetVersion || 'New Version'}
                      </div>
                      <p className="text-xs text-emerald-800/90 dark:text-emerald-300/90 mt-1">
                        The update is downloaded and ready to install. It will automatically install when the app is restarted or closed, or you can restart now.
                      </p>
                      <div className="mt-4 pt-3 border-t border-emerald-500/20 flex items-center justify-between">
                        <span className="text-xs text-gray-500 dark:text-slate-400">Database and settings are safely preserved.</span>
                        <button
                          onClick={handleRestartAndInstall}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                        >
                          <RefreshCw size={14} />
                          Restart &amp; Install Now
                        </button>
                      </div>
                    </div>
                  ) : updateState?.state === 'DOWNLOADING' ? (
                    <div className="mt-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-900 dark:text-blue-200">
                      <div className="flex items-center gap-2 font-bold text-sm text-blue-700 dark:text-blue-300">
                        <Download size={16} className="animate-bounce" /> Downloading Update in Background... ({updateState.progressPercent || 0}%)
                      </div>
                      <div className="w-full bg-blue-200 dark:bg-blue-950 rounded-full h-2 mt-2.5 overflow-hidden">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${updateState.progressPercent || 0}%` }}
                        />
                      </div>
                      <p className="text-xs text-blue-700/80 dark:text-blue-300/80 mt-2">
                        POS operations continue as normal. Ongoing orders and printers are not affected.
                      </p>
                    </div>
                  ) : updateState?.state === 'AVAILABLE' ? (
                    <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200">
                      <div className="flex items-center gap-2 font-bold text-sm text-amber-700 dark:text-amber-300">
                        <Zap size={16} /> New Version v{updateState.targetVersion} Detected
                      </div>
                      <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-1">
                        Connecting to GitHub Releases to download update in the background...
                      </p>
                    </div>
                  ) : updateState?.error ? (
                    <div className="mt-3 p-3 rounded-xl bg-gray-100 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 text-xs text-gray-600 dark:text-slate-400 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Info size={14} className="text-gray-500" />
                        <span>Operating in Local LAN Mode ({updateState.error})</span>
                      </div>
                      <span className="text-[11px] text-gray-400">POS fully functional</span>
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1.5">
                      <CheckCircle2 size={14} className="text-emerald-500" />
                      You&apos;re running the latest release. Online updates connect to GitHub Releases.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── TAB 3: UPDATE HISTORY ──────────────── */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-slate-800 mb-4">
              <div>
                <h2 className="text-xl font-bold font-display text-gray-900 dark:text-white">
                  Update &amp; Migration History
                </h2>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Audit log of all installed, rolled back, and automated version transitions
                </p>
              </div>
              <button
                onClick={loadHistory}
                disabled={historyLoading}
                className="px-3 py-1.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 text-xs font-medium rounded-lg text-gray-700 dark:text-slate-300"
              >
                Refresh Log
              </button>
            </div>

            {historyLoading ? (
              <div className="py-12 text-center text-xs text-gray-400">Loading update history...</div>
            ) : historyList.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-400">
                No past updates logged. Initial installation version is active.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-slate-800 text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4 font-semibold">Version</th>
                      <th className="py-3 px-4 font-semibold">From</th>
                      <th className="py-3 px-4 font-semibold">Date &amp; Time</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold">Diagnostic Ref</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                    {historyList.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-bold font-mono text-gray-900 dark:text-white">
                          v{item.version}
                        </td>
                        <td className="py-3 px-4 font-mono text-gray-500 dark:text-slate-400">
                          v{item.previousVersion}
                        </td>
                        <td className="py-3 px-4 text-gray-600 dark:text-slate-300">
                          {new Date(item.installedAt).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.status === 'SUCCESS'
                                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                : item.status === 'ROLLED_BACK'
                                ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-gray-400">
                          {item.diagnosticRefId || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────── TAB 4: BACKUP & RECOVERY ──────────────── */}
      {activeTab === 'backup' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 pb-6 border-b border-gray-200 dark:border-slate-800">
              <div>
                <h2 className="text-xl font-bold font-display text-gray-900 dark:text-white">
                  Database Backup &amp; Disaster Recovery
                </h2>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Transactional snapshots stored locally on Main PC with automated pre-update protection
                </p>
              </div>

              <button
                onClick={handleCreateBackup}
                disabled={backingUp}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2 shadow-sm"
              >
                <HardDrive size={14} className={backingUp ? 'animate-spin' : ''} />
                {backingUp ? 'Creating Backup...' : 'Backup Now'}
              </button>
            </div>

            {/* Backups List */}
            <div className="mt-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-3">
                Saved Database Snapshots ({backupsList.length})
              </h3>

              {backupLoading ? (
                <div className="py-10 text-center text-xs text-gray-400">Loading backup list...</div>
              ) : backupsList.length === 0 ? (
                <div className="py-10 text-center text-xs text-gray-400">
                  No database snapshots found. Click &quot;Backup Now&quot; to create your first snapshot.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-slate-800 text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-4 font-semibold">Snapshot Filename</th>
                        <th className="py-3 px-4 font-semibold">Type</th>
                        <th className="py-3 px-4 font-semibold">Size</th>
                        <th className="py-3 px-4 font-semibold">Created At</th>
                        <th className="py-3 px-4 font-semibold">Status</th>
                        <th className="py-3 px-4 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                      {backupsList.map((b) => (
                        <tr key={b.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30">
                          <td className="py-3 px-4 font-mono font-medium text-gray-800 dark:text-slate-200">
                            {b.filename}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300">
                              {b.backupType}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-gray-500">{formatBytes(b.sizeBytes)}</td>
                          <td className="py-3 px-4 text-gray-600 dark:text-slate-300">
                            {new Date(b.createdAt).toLocaleString()}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                b.status === 'VALID'
                                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                              }`}
                            >
                              {b.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleRestoreBackup(b.id)}
                              disabled={restoringId === b.id}
                              className="px-3 py-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-[11px] font-bold rounded transition-colors"
                            >
                              {restoringId === b.id ? 'Restoring...' : 'Restore'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── TAB 5: DIAGNOSTICS & SUPPORT ──────────────── */}
      {activeTab === 'diagnostics' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 pb-6 border-b border-gray-200 dark:border-slate-800">
              <div>
                <h2 className="text-xl font-bold font-display text-gray-900 dark:text-white">
                  Real-time System Diagnostics
                </h2>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Live connectivity probes and health monitoring for local hardware and services
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={loadDiagnostics}
                  disabled={diagLoading}
                  className="px-3 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 text-xs font-medium rounded-lg text-gray-700 dark:text-slate-300 flex items-center gap-1.5"
                >
                  <RefreshCw size={14} className={diagLoading ? 'animate-spin' : ''} />
                  Run Probe
                </button>
                <button
                  onClick={handleExportSupportReport}
                  disabled={generatingReport}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2 shadow-sm"
                >
                  <Download size={14} />
                  {generatingReport ? 'Generating...' : 'Generate Support Report'}
                </button>
              </div>
            </div>

            {diagLoading && !diagData ? (
              <div className="py-12 text-center text-xs text-gray-400">Probing all local subsystems...</div>
            ) : diagData ? (
              <div className="mt-6 space-y-6">
                {/* Status Matrix */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(diagData.services || {}).map(([key, item]: [string, any]) => {
                    const isOk = item.status === 'RUNNING';
                    const isErr = item.status === 'ERROR' || item.status === 'OFFLINE';
                    return (
                      <div
                        key={key}
                        className="p-4 rounded-xl border border-gray-200/80 dark:border-slate-800 bg-gray-50/60 dark:bg-slate-800/40 flex items-start gap-3"
                      >
                        <div
                          className={`w-3 h-3 rounded-full mt-1 shrink-0 ${
                            isOk ? 'bg-emerald-500 ring-4 ring-emerald-500/20' : isErr ? 'bg-rose-500 ring-4 ring-rose-500/20' : 'bg-slate-400'
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-gray-900 dark:text-white truncate">
                            {item.name}
                          </div>
                          <div className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
                            {item.details || item.status}
                          </div>
                          {item.latencyMs !== undefined && (
                            <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                              Latency: {item.latencyMs}ms
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* System Specs & Resources */}
                <div className="p-4 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/30 dark:bg-slate-800/20">
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-3">
                    System Resources &amp; Hardware
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div>
                      <span className="text-gray-400">Host / PC:</span>{' '}
                      <span className="font-semibold text-gray-800 dark:text-slate-200">{diagData.system?.hostname}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">OS Platform:</span>{' '}
                      <span className="font-semibold text-gray-800 dark:text-slate-200">{diagData.system?.platform} ({diagData.system?.arch})</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Memory Used:</span>{' '}
                      <span className="font-semibold text-gray-800 dark:text-slate-200">{diagData.system?.memory?.usedPercent}% ({diagData.system?.memory?.freeMb} MB free)</span>
                    </div>
                    <div>
                      <span className="text-gray-400">LAN IP(s):</span>{' '}
                      <span className="font-semibold text-gray-800 dark:text-slate-200">{diagData.system?.lanIps?.join(', ') || '127.0.0.1'}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
