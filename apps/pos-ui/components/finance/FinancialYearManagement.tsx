'use client';

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  RefreshCw,
  Clock,
  ShieldCheck,
  Building,
  Info,
  X,
  FileCheck,
} from 'lucide-react';

interface FinancialYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'closed';
  isDefault: boolean;
  closedAt: string | null;
  closedByName: string | null;
  notes: string | null;
}

interface FinancialYearManagementProps {
  currentStaff?: { name: string; role: string };
  onFYChange?: () => void;
}

export function FinancialYearManagement({ currentStaff, onFYChange }: FinancialYearManagementProps) {
  const [loading, setLoading] = useState(true);
  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);
  const [activeFY, setActiveFY] = useState<FinancialYear | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isDefault, setIsDefault] = useState(true);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Confirmation Modal for Closing / Reopening
  const [confirmModal, setConfirmModal] = useState<{
    action: 'close' | 'reopen';
    fy: FinancialYear;
  } | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadFinancialYears = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/finance/financial-year');
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'Failed to fetch financial years');
      }
      setFinancialYears(json.financialYears || []);
      setActiveFY(json.activeFinancialYear || null);
    } catch (err: any) {
      setError(err.message || 'Error loading financial years');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFinancialYears();
  }, []);

  // Quick Preset Handlers
  const applyIndiaPreset = () => {
    const curYear = new Date().getFullYear();
    const curMonth = new Date().getMonth() + 1;
    const startY = curMonth >= 4 ? curYear : curYear - 1;
    const endY = startY + 1;
    setName(`FY ${startY}–${String(endY).slice(-2)}`);
    setStartDate(`${startY}-04-01`);
    setEndDate(`${endY}-03-31`);
  };

  const applyCalendarPreset = () => {
    const curYear = new Date().getFullYear();
    setName(`CY ${curYear}`);
    setStartDate(`${curYear}-01-01`);
    setEndDate(`${curYear}-12-31`);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (startDate >= endDate) {
      setFormError('Start date must be before end date.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/finance/financial-year', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          startDate,
          endDate,
          isDefault,
          notes: notes.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || json.message || 'Failed to save financial year');
      }

      showToast(`Financial Year "${name}" created successfully!`);
      setShowCreateModal(false);
      setName('');
      setStartDate('');
      setEndDate('');
      setNotes('');
      await loadFinancialYears();
      if (onFYChange) onFYChange();
    } catch (err: any) {
      setFormError(err.message || 'Error creating financial year');
    } finally {
      setSubmitting(false);
    }
  };

  const handleActionConfirm = async () => {
    if (!confirmModal) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/finance/financial-year', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: confirmModal.fy.id,
          action: confirmModal.action,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || json.message || 'Action failed');
      }

      showToast(
        confirmModal.action === 'close'
          ? `Financial Year "${confirmModal.fy.name}" is now CLOSED. Period locking is active.`
          : `Financial Year "${confirmModal.fy.name}" has been REOPENED.`
      );
      setConfirmModal(null);
      await loadFinancialYears();
      if (onFYChange) onFYChange();
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-10 right-10 z-[9999] px-6 py-3 rounded-full bg-slate-900 text-white font-bold text-xs shadow-xl flex items-center gap-2">
          <span>✔️</span>
          {toastMessage}
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-lg font-bold font-display flex items-center gap-2">
            <Calendar className="text-amber-600" size={20} /> Financial Year Setup &amp; Period Locking
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Define accounting fiscal years, enforce period locking on historical books, and configure official tax periods.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              applyIndiaPreset();
              setShowCreateModal(true);
            }}
            className="btn btn-primary text-xs gap-1 px-4 py-2"
          >
            <Plus size={15} /> Setup Financial Year
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* ── CURRENT ACTIVE FINANCIAL YEAR CARD (Requirement 12) ── */}
      {activeFY ? (
        <div
          className="card p-5 border-2 rounded-2xl relative overflow-hidden"
          style={{
            background: 'var(--paper-2)',
            borderColor: activeFY.status === 'active' ? 'var(--turmeric)' : 'var(--line)',
          }}
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wide text-slate-400">
                  Current Operating Financial Year
                </span>
                <span className="pill text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border-emerald-300">
                  ACTIVE
                </span>
              </div>
              <h2 className="text-3xl font-extrabold font-display text-slate-900 tracking-tight">
                {activeFY.name}
              </h2>
              <div className="flex items-center gap-3 text-xs text-slate-600 font-mono pt-1">
                <span>Start Date: <b>{activeFY.startDate}</b></span>
                <span>•</span>
                <span>End Date: <b>{activeFY.endDate}</b></span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmModal({ action: 'close', fy: activeFY })}
                className="btn btn-secondary text-xs gap-1.5 px-4 py-2 border-rose-200 text-rose-700 hover:bg-rose-50"
              >
                <Lock size={14} /> Close / Lock FY
              </button>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t text-[11.5px] text-slate-500 flex items-center gap-2" style={{ borderColor: 'var(--line)' }}>
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>
              All POS billing, customer payments, receipts, and day-closing records are mapped to <b>{activeFY.name}</b>.
            </span>
          </div>
        </div>
      ) : (
        <div className="card p-5 text-center text-slate-500 text-xs" style={{ background: 'var(--paper-2)' }}>
          <RefreshCw className="animate-spin inline-block mr-2" size={16} /> Loading active financial year...
        </div>
      )}

      {/* ── FINANCIAL YEAR HISTORY TABLE (Requirement 15) ── */}
      <section className="card p-0 overflow-hidden" style={{ background: 'var(--paper-2)' }}>
        <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: 'var(--line)' }}>
          <h4 className="font-bold text-sm">Financial Years Register</h4>
          <span className="text-xs text-slate-400 font-mono">
            {financialYears.length} {financialYears.length === 1 ? 'Year' : 'Years'} Configured
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b text-[11px] font-extrabold text-slate-500 uppercase tracking-wider" style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }}>
                <th className="py-3 px-4">Financial Year</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4">Closure Audit</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--line)' }}>
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    <RefreshCw className="animate-spin inline-block mr-2" size={16} /> Loading records...
                  </td>
                </tr>
              ) : financialYears.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No financial years found.
                  </td>
                </tr>
              ) : (
                financialYears.map((fy) => (
                  <tr key={fy.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900 text-sm">
                      <div className="flex items-center gap-2">
                        <span>{fy.name}</span>
                        {fy.isDefault && (
                          <span className="pill text-[9px] bg-amber-100 text-amber-800 font-extrabold uppercase">
                            Default
                          </span>
                        )}
                      </div>
                      {fy.notes && <span className="text-[10px] text-slate-400 block font-normal">{fy.notes}</span>}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-700">
                      <span className="font-semibold">{fy.startDate}</span>
                      <span className="text-slate-400 mx-1.5">→</span>
                      <span className="font-semibold">{fy.endDate}</span>
                    </td>

                    <td className="py-3.5 px-3 text-center">
                      <span
                        className={`pill text-[10px] font-extrabold uppercase px-2.5 py-0.5 ${
                          fy.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-slate-200 text-slate-700 border-slate-300'
                        }`}
                      >
                        {fy.status === 'active' ? '🟢 ACTIVE' : '🔒 CLOSED'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-[11px] text-slate-500">
                      {fy.status === 'closed' ? (
                        <div>
                          <span>Closed by <b>{fy.closedByName || 'Manager'}</b></span>
                          {fy.closedAt && (
                            <span className="block text-[10px] text-slate-400 font-mono">
                              {new Date(fy.closedAt).toLocaleDateString('en-IN')}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">— Open for postings —</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {fy.status === 'active' ? (
                        <button
                          type="button"
                          onClick={() => setConfirmModal({ action: 'close', fy })}
                          className="btn btn-secondary btn-sm text-[11px] gap-1 px-3 py-1 text-rose-700 border-rose-200 hover:bg-rose-50"
                        >
                          <Lock size={12} /> Close FY
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmModal({ action: 'reopen', fy })}
                          className="btn btn-secondary btn-sm text-[11px] gap-1 px-3 py-1 text-slate-700 hover:bg-slate-100"
                        >
                          <Unlock size={12} /> Reopen FY
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── CREATE / SETUP FINANCIAL YEAR MODAL ── */}
      {showCreateModal && (
        <div className="scrim anim-fade z-[9900] flex items-center justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setShowCreateModal(false)} />
          <div
            className="relative card w-full max-w-md p-6 anim-pop z-10 space-y-4"
            style={{
              background: 'var(--paper-2)',
              borderRadius: 22,
              boxShadow: 'var(--sh-3)',
              border: '1px solid var(--line)',
            }}
          >
            <div className="flex justify-between items-center border-b pb-3" style={{ borderColor: 'var(--line)' }}>
              <h3 className="font-display font-bold text-base flex items-center gap-2">
                <Calendar size={18} className="text-amber-600" /> Setup Financial Year
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="btn btn-icon btn-sm btn-ghost text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 text-rose-800 text-xs rounded-xl border border-rose-200 flex items-center gap-1.5">
                <AlertTriangle size={15} /> {formError}
              </div>
            )}

            {/* Quick Preset Buttons */}
            <div>
              <label className="lbl text-[11px]">Quick Date Presets</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={applyIndiaPreset}
                  className="btn btn-secondary btn-sm text-[11px] flex-1 py-1.5 font-bold"
                >
                  🇮🇳 India (01 Apr – 31 Mar)
                </button>
                <button
                  type="button"
                  onClick={applyCalendarPreset}
                  className="btn btn-secondary btn-sm text-[11px] flex-1 py-1.5 font-bold"
                >
                  🌐 Calendar (01 Jan – 31 Dec)
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5">
              <div>
                <label className="lbl">Financial Year Label / Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. FY 2026–27"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="inp"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="lbl">Start Date</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="inp font-mono"
                  />
                </div>
                <div>
                  <label className="lbl">End Date</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="inp font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="lbl">Notes / Accounting Comments</label>
                <input
                  type="text"
                  placeholder="Optional remarks"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="inp"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="defaultFY"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <label htmlFor="defaultFY" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Set as Primary Active Financial Year
                </label>
              </div>

              <div className="pt-3 border-t flex justify-end gap-2" style={{ borderColor: 'var(--line)' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary text-xs px-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary text-xs px-5 font-bold"
                >
                  {submitting ? 'Saving...' : 'Save Financial Year'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CONFIRMATION MODAL (Requirement 15 & 19: Period Locking) ── */}
      {confirmModal && (
        <div className="scrim anim-fade z-[9900] flex items-center justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setConfirmModal(null)} />
          <div
            className="relative card w-full max-w-md p-6 anim-pop z-10 space-y-4"
            style={{
              background: 'var(--paper-2)',
              borderRadius: 22,
              boxShadow: 'var(--sh-3)',
              border: '1px solid var(--line)',
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  confirmModal.action === 'close'
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {confirmModal.action === 'close' ? <Lock size={20} /> : <Unlock size={20} />}
              </div>
              <div>
                <h3 className="font-display font-bold text-base">
                  {confirmModal.action === 'close' ? 'Lock & Close Financial Year' : 'Reopen Financial Year'}
                </h3>
                <span className="text-xs text-slate-500 font-mono font-bold">
                  {confirmModal.fy.name} ({confirmModal.fy.startDate} to {confirmModal.fy.endDate})
                </span>
              </div>
            </div>

            {confirmModal.action === 'close' ? (
              <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-2">
                <p className="font-bold">⚠️ Critical Period Locking Warning:</p>
                <p>
                  Closing this financial year locks all accounting transactions, day-closing records, POS payments,
                  and expense claims within this date range. No staff member will be able to add or alter historical
                  records in this period.
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-600 leading-relaxed">
                Reopening this financial year will remove the period lock and allow authorized adjustments to this
                fiscal period.
              </p>
            )}

            <div className="pt-2 border-t flex justify-end gap-2" style={{ borderColor: 'var(--line)' }}>
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="btn btn-secondary text-xs px-4"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleActionConfirm}
                className={`btn text-xs px-5 font-bold ${
                  confirmModal.action === 'close'
                    ? 'bg-rose-600 text-white hover:bg-rose-700'
                    : 'btn-primary'
                }`}
              >
                {submitting
                  ? 'Processing...'
                  : confirmModal.action === 'close'
                  ? 'Confirm Period Lock & Close'
                  : 'Confirm Reopen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
