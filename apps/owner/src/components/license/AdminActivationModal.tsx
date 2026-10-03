'use client';

import React, { useState } from 'react';
import {
  KeyRound,
  FileCode,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
} from 'lucide-react';
import { BUSINESS_TYPE_LABELS, BusinessTypeId } from '@/types/modules';

interface AdminActivationModalProps {
  isOpen: boolean;
  onClose: () => void;
  installationId: string;
  onSuccess?: () => void;
}

export default function AdminActivationModal({
  isOpen,
  onClose,
  installationId,
  onSuccess,
}: AdminActivationModalProps) {
  const [adminPassword, setAdminPassword] = useState('');
  const [licensePeriod, setLicensePeriod] = useState<'1_month' | '2_months' | '3_months' | 'custom'>('1_month');
  const [customDays, setCustomDays] = useState(30);
  const [selectedTypes, setSelectedTypes] = useState<BusinessTypeId[]>(['cafe']);
  const [offlineToken, setOfflineToken] = useState('');
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleBusinessType = (typeId: BusinessTypeId) => {
    if (selectedTypes.includes(typeId)) {
      if (selectedTypes.length > 1) {
        setSelectedTypes(selectedTypes.filter((t) => t !== typeId));
      }
    } else {
      setSelectedTypes([...selectedTypes, typeId]);
    }
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const payload: any = {
        adminPassword,
        licensePeriod,
        businessTypes: selectedTypes,
        customDays: licensePeriod === 'custom' ? Number(customDays) : undefined,
      };

      if (isOfflineMode) {
        if (!offlineToken.trim()) {
          setError('Please paste the offline activation token provided by Nuro7.');
          setBusy(false);
          return;
        }
        payload.offlineToken = offlineToken.trim();
      }

      const res = await fetch('/api/license/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Activation failed. Please verify credentials.');
        setBusy(false);
        return;
      }

      setSuccess('Commercial license successfully activated and verified!');
      setAdminPassword('');
      if (onSuccess) onSuccess();
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err?.message || 'Network error during license activation.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        className="w-full max-w-lg rounded-[24px] p-6 text-left relative overflow-hidden"
        style={{
          background: 'var(--paper-2, #18181b)',
          border: '1px solid var(--line-2, #27272a)',
          boxShadow: 'var(--sh-3, 0 25px 50px -12px rgba(0,0,0,0.5))',
          color: 'var(--ink, #fafafa)',
        }}
      >
        <div className="flex items-center justify-between pb-4 border-b border-[var(--line,#27272a)]">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
              }}
            >
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-[var(--ink,#fafafa)]">
                Administrator Activation
              </h3>
              <p className="text-xs text-[var(--ink-3,#a1a1aa)] font-medium">
                Main PC Commercial License Engine
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--ink-3,#a1a1aa)] hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-[12px] text-xs flex items-center gap-2 bg-red-500/15 border border-red-500/30 text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mt-4 p-3 rounded-[12px] text-xs flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleActivate} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ink-3,#a1a1aa)] mb-1.5">
              Target Installation ID
            </label>
            <input
              type="text"
              readOnly
              value={installationId}
              className="w-full px-3.5 py-2.5 rounded-[12px] font-mono text-xs font-bold bg-zinc-800 border border-zinc-700 text-zinc-300"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ink-3,#a1a1aa)] mb-1.5">
              Administrator Master Password
            </label>
            <input
              type="password"
              required
              placeholder="Enter administrative credentials"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-[12px] text-xs font-medium focus:outline-none bg-zinc-800 border border-zinc-700 text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ink-3,#a1a1aa)] mb-1.5">
              License Duration
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: '1_month', label: '1 Month' },
                { id: '2_months', label: '2 Months' },
                { id: '3_months', label: '3 Months' },
                { id: 'custom', label: 'Custom' },
              ].map((opt) => (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => setLicensePeriod(opt.id as any)}
                  className={`px-2.5 py-2 rounded-[10px] text-xs font-bold text-center transition ${
                    licensePeriod === opt.id
                      ? 'bg-amber-500/20 border-2 border-amber-500 text-amber-400'
                      : 'bg-zinc-800 border border-zinc-700 text-zinc-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {licensePeriod === 'custom' && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={customDays}
                  onChange={(e) => setCustomDays(parseInt(e.target.value, 10) || 1)}
                  className="w-24 px-3 py-1.5 rounded-[10px] text-xs font-bold text-center bg-zinc-800 border border-zinc-700 text-white"
                />
                <span className="text-xs text-zinc-400 font-medium">Days of Validity</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ink-3,#a1a1aa)] mb-1.5">
              Active Business Types
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1 rounded-[10px] border border-zinc-700 bg-zinc-800/50">
              {(Object.keys(BUSINESS_TYPE_LABELS) as BusinessTypeId[]).map((typeId) => {
                const isSelected = selectedTypes.includes(typeId);
                return (
                  <button
                    type="button"
                    key={typeId}
                    onClick={() => toggleBusinessType(typeId)}
                    className={`px-2.5 py-1 rounded-[8px] text-[11px] font-bold transition flex items-center gap-1 ${
                      isSelected
                        ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-400'
                        : 'bg-zinc-800 border border-zinc-700 text-zinc-400'
                    }`}
                  >
                    {isSelected && <CheckCircle2 className="w-3 h-3" />}
                    <span>{BUSINESS_TYPE_LABELS[typeId]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-1">
            <button
              type="button"
              onClick={() => setIsOfflineMode(!isOfflineMode)}
              className="text-[11px] font-bold text-amber-400 hover:underline flex items-center gap-1"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>{isOfflineMode ? 'Hide Offline Activation Token' : 'Have an Offline Activation Token?'}</span>
            </button>

            {isOfflineMode && (
              <textarea
                rows={3}
                placeholder="Paste the cryptographically signed offline activation token from Nuro7..."
                value={offlineToken}
                onChange={(e) => setOfflineToken(e.target.value)}
                className="mt-2 w-full px-3 py-2 rounded-[10px] font-mono text-[11px] focus:outline-none bg-zinc-800 border border-zinc-700 text-white"
              />
            )}
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-[12px] text-xs font-bold transition bg-zinc-800 border border-zinc-700 text-zinc-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-5 py-2 rounded-[12px] text-xs font-bold transition flex items-center gap-2 bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{busy ? 'Verifying...' : 'Activate License'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
