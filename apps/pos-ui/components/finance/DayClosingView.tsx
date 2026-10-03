'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Unlock,
  Printer,
  RefreshCw,
  History,
  ArrowRight,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Receipt,
  CreditCard,
  Smartphone,
  Banknote,
  Clock,
  Layers,
  FileSpreadsheet,
  FileText,
  X,
  Building,
  Vault,
} from 'lucide-react';
import { formatINR, toPaise, type CashDenominations } from '@cafeos/core';
import { DayClosingPrintReport } from './DayClosingPrintReport';

interface DayClosingViewProps {
  outlet?: any;
  currentStaff?: any;
  initialDate?: string;
  isStandalonePage?: boolean;
}

export function DayClosingView({
  outlet,
  currentStaff,
  initialDate,
  isStandalonePage = false,
}: DayClosingViewProps) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals
  const [activeModal, setActiveModal] = useState<
    'final_confirm' | 'force_close_shift' | 'reopen_day' | 'print_preview' | 'validation_errors' | null
  >(null);

  // Cash Denomination state
  const [denominations, setDenominations] = useState<CashDenominations>({
    d500: 0,
    d200: 0,
    d100: 0,
    d50: 0,
    d20: 0,
    d10: 0,
    coinsPaise: 0,
  });

  // Manual cash override if user chooses not to use denomination counter
  const [manualCashInput, setManualCashInput] = useState<string>('');
  const [useDenominationCounter, setUseDenominationCounter] = useState(true);

  // Variance explanation
  const [varianceReason, setVarianceReason] = useState<string>('Cash shortage');
  const [customVarianceNote, setCustomVarianceNote] = useState<string>('');

  // Tomorrow Opening Cash Options
  const [tomorrowOption, setTomorrowOption] = useState<'same' | 'entire' | 'custom' | 'zero'>('same');
  const [customTomorrowCash, setCustomTomorrowCash] = useState<string>('15000');

  // Cash Deposit Destination
  const [depositDestination, setDepositDestination] = useState<
    'bank' | 'vault' | 'owner_withdrawal' | 'petty_cash' | 'other'
  >('vault');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('vault_safe');

  // Force close shift modal state
  const [selectedShiftToForceClose, setSelectedShiftToForceClose] = useState<any>(null);
  const [forceCloseActualCash, setForceCloseActualCash] = useState<string>('');
  const [managerPin, setManagerPin] = useState<string>('');
  const [reopenReason, setReopenReason] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Expandable sections toggles
  const [expandExpenses, setExpandExpenses] = useState(false);
  const [expandRefunds, setExpandRefunds] = useState(false);
  const [expandSettlements, setExpandSettlements] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Load day closing data
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = initialDate
        ? `/api/finance/day-closing?date=${initialDate}`
        : '/api/finance/day-closing';
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load day closing data');
      setData(json.data);

      // Pre-fill existing denominations if available
      if (json.data?.cashReconciliation?.denominations) {
        setDenominations(json.data.cashReconciliation.denominations);
      }
      if (json.data?.cashReconciliation?.actualCashCountedPaise) {
        setManualCashInput((json.data.cashReconciliation.actualCashCountedPaise / 100).toString());
      }
      if (json.data?.cashReconciliation?.varianceReason) {
        setVarianceReason(json.data.cashReconciliation.varianceReason);
      }
      if (json.data?.cashReconciliation?.varianceNote) {
        setCustomVarianceNote(json.data.cashReconciliation.varianceNote);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading day closing data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDate]);

  // Denominations Total Calculation
  const countedFromDenominationsPaise = useMemo(() => {
    return (
      (denominations.d500 || 0) * 50000 +
      (denominations.d200 || 0) * 20000 +
      (denominations.d100 || 0) * 10000 +
      (denominations.d50 || 0) * 5000 +
      (denominations.d20 || 0) * 2000 +
      (denominations.d10 || 0) * 1000 +
      (denominations.coinsPaise || 0)
    );
  }, [denominations]);

  // Effective Actual Cash Counted
  const effectiveActualCashPaise = useMemo(() => {
    if (useDenominationCounter) {
      return countedFromDenominationsPaise;
    }
    const val = parseFloat(manualCashInput) || 0;
    return Math.round(val * 100);
  }, [useDenominationCounter, countedFromDenominationsPaise, manualCashInput]);

  // Expected Cash
  const expectedCashPaise = data?.cashReconciliation?.expectedClosingCashPaise || 0;

  // Calculated Variance
  const cashVariancePaise = effectiveActualCashPaise - expectedCashPaise;
  const hasVariance = Math.abs(cashVariancePaise) > 0;

  // Tomorrow Opening Cash Calculated
  const tomorrowOpeningCashPaise = useMemo(() => {
    if (tomorrowOption === 'same') {
      return data?.cashReconciliation?.openingCashPaise || 1500000;
    }
    if (tomorrowOption === 'entire') {
      return effectiveActualCashPaise;
    }
    if (tomorrowOption === 'zero') {
      return 0;
    }
    const val = parseFloat(customTomorrowCash) || 0;
    return Math.round(val * 100);
  }, [tomorrowOption, customTomorrowCash, data, effectiveActualCashPaise]);

  // Cash to Remove / Deposit Calculated
  const cashToRemoveDepositPaise = Math.max(0, effectiveActualCashPaise - tomorrowOpeningCashPaise);

  // Role authority check
  const isManagerOrOwner = useMemo(() => {
    const role = currentStaff?.role?.toLowerCase() || '';
    return role === 'owner' || role === 'manager' || role === 'admin';
  }, [currentStaff]);

  // Check validation for closing
  const validationIssues = useMemo(() => {
    const issues: string[] = [];
    if (!data) return issues;

    if (data.shiftSummary?.openShifts > 0) {
      issues.push(
        `${data.shiftSummary.openShifts} shift(s) are still open. All shifts must be closed before the business day can be finalized.`
      );
    }
    if (hasVariance && !varianceReason) {
      issues.push('A cash variance reason is required when variance is non-zero.');
    }
    if (effectiveActualCashPaise <= 0 && expectedCashPaise > 0) {
      issues.push('Actual cash count cannot be zero when expected cash exists in register.');
    }
    return issues;
  }, [data, hasVariance, varianceReason, effectiveActualCashPaise, expectedCashPaise]);

  const canProceedToClose = validationIssues.length === 0;

  // Final Close Action
  const handleConfirmCloseBusinessDay = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const selectedAccount = data?.bankAccounts?.find((a: any) => a.id === selectedAccountId);

      const payload = {
        action: 'close_day',
        businessDate: data.businessDate,
        actualCashPaise: effectiveActualCashPaise,
        varianceReason: hasVariance ? varianceReason : null,
        varianceNote: hasVariance ? customVarianceNote : null,
        denominations: useDenominationCounter ? denominations : undefined,
        tomorrowOpeningCashPaise,
        tomorrowOption,
        cashDepositDestination: depositDestination,
        cashDepositAccountId: selectedAccountId,
        cashDepositAccountName: selectedAccount?.name || depositDestination,
        managerPin: managerPin || undefined,
      };

      const res = await fetch('/api/finance/day-closing', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resJson = await res.json();
      if (!res.ok) throw new Error(resJson.message || resJson.error || 'Failed to close business day');

      setActiveModal(null);
      showToast('Business day closed successfully!');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to close business day');
    } finally {
      setSubmitting(false);
    }
  };

  // Reopen Day Action
  const handleReopenDay = async () => {
    if (!reopenReason.trim()) {
      alert('Please provide a mandatory reason for reopening the business day.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/finance/day-closing', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'reopen_day',
          businessDate: data.businessDate,
          reason: reopenReason,
          managerPin: managerPin || undefined,
        }),
      });
      const resJson = await res.json();
      if (!res.ok) throw new Error(resJson.message || resJson.error || 'Failed to reopen day');

      setActiveModal(null);
      setReopenReason('');
      showToast('Business day reopened successfully!');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to reopen business day');
    } finally {
      setSubmitting(false);
    }
  };

  // Force Close Shift Action
  const handleForceCloseShift = async () => {
    if (!selectedShiftToForceClose) return;
    setSubmitting(true);
    try {
      const actualVal = parseFloat(forceCloseActualCash) || 0;
      const actualPaise = Math.round(actualVal * 100);

      const res = await fetch('/api/finance/day-closing', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'force_close_shift',
          shiftId: selectedShiftToForceClose.id,
          actualCashPaise: actualPaise,
          managerPin: managerPin || undefined,
          notes: 'Force closed from Day Closing dashboard',
        }),
      });
      const resJson = await res.json();
      if (!res.ok) throw new Error(resJson.message || resJson.error || 'Failed to close shift');

      setActiveModal(null);
      setSelectedShiftToForceClose(null);
      setForceCloseActualCash('');
      showToast('Shift force-closed successfully!');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to force close shift');
    } finally {
      setSubmitting(false);
    }
  };

  // Export CSV
  const exportCSV = () => {
    if (!data) return;
    const rows = [
      ['CHAYAONE RESTAURANT OS — DAY CLOSING REPORT'],
      ['Business Date', data.businessDate],
      ['Closing Number', data.closingNumber || 'N/A'],
      ['Status', data.status],
      [''],
      ['SALES SUMMARY'],
      ['Gross Sales', (data.salesSummary.grossSalesPaise / 100).toFixed(2)],
      ['Discounts', (data.salesSummary.discountsPaise / 100).toFixed(2)],
      ['Net Sales', (data.salesSummary.netSalesPaise / 100).toFixed(2)],
      ['Tax Collected', (data.salesSummary.taxCollectedPaise / 100).toFixed(2)],
      ['Total Orders', data.salesSummary.totalOrders],
      ['Completed Orders', data.salesSummary.completedOrders],
      ['Cancelled Orders', data.salesSummary.cancelledOrders],
      [''],
      ['PAYMENT RECONCILIATION'],
      ...data.paymentReconciliation.map((p: any) => [
        p.label,
        (p.systemAmountPaise / 100).toFixed(2),
        (p.actualAmountPaise / 100).toFixed(2),
        p.status,
      ]),
      [''],
      ['CASH RECONCILIATION'],
      ['Opening Cash', (data.cashReconciliation.openingCashPaise / 100).toFixed(2)],
      ['Cash Sales', (data.cashReconciliation.cashSalesPaise / 100).toFixed(2)],
      ['Cash In', (data.cashReconciliation.cashInPaise / 100).toFixed(2)],
      ['Cash Expenses', (data.cashReconciliation.cashExpensesPaise / 100).toFixed(2)],
      ['Cash Out', (data.cashReconciliation.cashOutPaise / 100).toFixed(2)],
      ['Expected Closing Cash', (data.cashReconciliation.expectedClosingCashPaise / 100).toFixed(2)],
      ['Actual Cash Counted', (effectiveActualCashPaise / 100).toFixed(2)],
      ['Variance', (cashVariancePaise / 100).toFixed(2)],
      ['Variance Reason', varianceReason || 'N/A'],
      [''],
      ['NEXT BUSINESS DAY CARRY FORWARD'],
      ['Tomorrow Opening Cash', (tomorrowOpeningCashPaise / 100).toFixed(2)],
      ['Cash Removed / Deposited', (cashToRemoveDepositPaise / 100).toFixed(2)],
      ['Deposit Destination', depositDestination],
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `DayClosing_${data.businessDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[400px]">
        <RefreshCw className="animate-spin text-amber-500 w-8 h-8 mb-3" />
        <p className="text-sm font-bold text-slate-500">Calculating authoritative business day figures...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center bg-red-50 rounded-2xl border border-red-200">
        <AlertTriangle className="text-rose-500 w-10 h-10 mx-auto mb-2" />
        <h3 className="font-bold text-rose-800 text-base">Unable to Load Day Closing</h3>
        <p className="text-xs text-rose-600 mt-1">{error || 'Unknown error occurred'}</p>
        <button onClick={loadData} className="btn btn-dark mt-4 text-xs">
          🔄 Retry Load
        </button>
      </div>
    );
  }

  const isClosed = data.status === 'closed';

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-16">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-8 right-8 z-[9999] px-5 py-3 rounded-full bg-slate-900 text-white font-bold text-xs shadow-2xl flex items-center gap-2 border border-slate-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {toastMessage}
        </div>
      )}

      {/* Standalone navigation if visited directly at /finance/day-closing */}
      {isStandalonePage && (
        <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--line)' }}>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-xs font-bold text-slate-500 hover:text-slate-800 transition flex items-center gap-1"
            >
              ← Back to Dashboard
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-bold text-amber-600">Finance</span>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-extrabold">Day Closing</span>
          </div>
          <Link
            href="/finance/day-closing/history"
            className="btn btn-sm btn-ghost border text-xs gap-1 font-bold"
          >
            <History size={14} /> View History
          </Link>
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4" style={{ background: 'var(--paper-2)' }}>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold">
              RESTAURANT FINANCE &amp; AUDIT
            </span>
            <span
              className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                isClosed
                  ? 'bg-red-100 text-red-800'
                  : data.status === 'extended'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {data.status}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black font-display tracking-tight text-slate-900 mt-1">
            DAY CLOSING
          </h1>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
            <span className="flex items-center gap-1 font-mono font-bold text-slate-700">
              <Calendar size={13} className="text-amber-500" />
              {new Date(data.businessDate).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </span>
            <span>•</span>
            <span className="font-mono text-slate-500">Timezone: {data.timezone}</span>
            {data.closingNumber && (
              <>
                <span>•</span>
                <span className="font-mono font-bold text-emerald-700">ID: {data.closingNumber}</span>
              </>
            )}
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadData}
            className="btn btn-sm btn-ghost border text-xs gap-1.5"
            title="Refresh calculations"
          >
            <RefreshCw size={13} /> Refresh
          </button>
          <Link
            href="/finance/day-closing/history"
            className="btn btn-sm btn-ghost border text-xs gap-1.5"
          >
            <History size={13} /> Previous Closings
          </Link>

          {isClosed ? (
            <>
              <button
                onClick={() => setActiveModal('print_preview')}
                className="btn btn-sm btn-primary text-xs gap-1.5"
              >
                <Printer size={13} /> Print Report
              </button>
              <button
                onClick={exportCSV}
                className="btn btn-sm btn-ghost border text-xs gap-1.5"
              >
                <FileSpreadsheet size={13} /> Export CSV
              </button>
              {isManagerOrOwner && (
                <button
                  onClick={() => setActiveModal('reopen_day')}
                  className="btn btn-sm text-xs gap-1.5 text-rose-600 border border-rose-200 hover:bg-rose-50"
                >
                  <Unlock size={13} /> Reopen Day
                </button>
              )}
            </>
          ) : (
            <button
              onClick={() => {
                if (!canProceedToClose) {
                  setActiveModal('validation_errors');
                } else {
                  setActiveModal('final_confirm');
                }
              }}
              className="btn btn-sm btn-primary text-xs gap-1.5 px-4 font-bold shadow-md"
              style={{ background: 'var(--turmeric)', color: '#2A1607' }}
            >
              <Lock size={13} /> Close Business Day
            </button>
          )}
        </div>
      </div>

      {/* ── CLOSED STATE BANNER ── */}
      {isClosed && (
        <div className="p-4 rounded-xl border border-slate-300 bg-slate-100 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold">
              ✓
            </div>
            <div>
              <p className="font-bold text-slate-800">
                Business Day is Closed and Financials are Locked
              </p>
              <p className="text-[11px] text-slate-500">
                Closed by <b>{data.dayClosing?.closedByName || 'Manager'}</b> on{' '}
                {data.dayClosing?.closedAt ? new Date(data.dayClosing.closedAt).toLocaleString('en-IN') : 'N/A'}.
                All financial figures are historical read-only snapshots.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveModal('print_preview')}
            className="btn btn-sm btn-dark text-xs gap-1"
          >
            <Printer size={12} /> View Printable Report
          </button>
        </div>
      )}

      {/* ── OPEN SHIFTS WARNING BANNER ── */}
      {!isClosed && data.shiftSummary?.openShifts > 0 && (
        <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wide">
                WARNING: {data.shiftSummary.openShifts} Cashier Shift(s) Still Active
              </h4>
              <p className="text-xs mt-0.5 text-amber-800">
                All cashier shifts must be closed and reconciled before the business day can be finalized.
                Do not silently close active shifts.
              </p>
            </div>
          </div>
          <div className="text-xs font-mono text-amber-700 bg-amber-100 px-3 py-1.5 rounded-lg">
            Active Shifts: {data.shiftSummary.openShifts} / {data.shiftSummary.totalShifts}
          </div>
        </div>
      )}

      {/* ── 1. SALES SUMMARY ── */}
      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Receipt size={14} className="text-amber-500" />
          1. Sales Summary (Business Day Totals)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="card p-3.5 flex flex-col justify-between" style={{ background: 'var(--paper-2)' }}>
            <span className="text-[10px] text-slate-400 uppercase font-bold">Gross Sales</span>
            <h4 className="text-lg md:text-xl font-bold font-mono mt-1 text-slate-800">
              {formatINR(data.salesSummary.grossSalesPaise)}
            </h4>
            <span className="text-[9px] text-slate-400 mt-1">Pre-discount order subtotal</span>
          </div>

          <div className="card p-3.5 flex flex-col justify-between" style={{ background: 'var(--paper-2)' }}>
            <span className="text-[10px] text-slate-400 uppercase font-bold">Discounts</span>
            <h4 className="text-lg md:text-xl font-bold font-mono mt-1 text-rose-600">
              −{formatINR(data.salesSummary.discountsPaise)}
            </h4>
            <span className="text-[9px] text-slate-400 mt-1">Bill &amp; manual concessions</span>
          </div>

          <div className="card p-3.5 flex flex-col justify-between" style={{ background: 'var(--paper-2)' }}>
            <span className="text-[10px] text-slate-400 uppercase font-bold">Refunds Paid</span>
            <h4 className="text-lg md:text-xl font-bold font-mono mt-1 text-rose-600">
              −{formatINR(data.salesSummary.refundsPaise)}
            </h4>
            <span className="text-[9px] text-slate-400 mt-1">{data.salesSummary.refundedOrders} orders refunded</span>
          </div>

          <div className="card p-3.5 flex flex-col justify-between border-2 border-amber-300" style={{ background: 'var(--paper-2)' }}>
            <span className="text-[10px] text-amber-700 uppercase font-bold">Net Sales</span>
            <h4 className="text-lg md:text-xl font-black font-mono mt-1 text-slate-900">
              {formatINR(data.salesSummary.netSalesPaise)}
            </h4>
            <span className="text-[9px] text-slate-400 mt-1">Gross minus discounts</span>
          </div>

          <div className="card p-3.5 flex flex-col justify-between" style={{ background: 'var(--paper-2)' }}>
            <span className="text-[10px] text-slate-400 uppercase font-bold">Tax Collected</span>
            <h4 className="text-lg md:text-xl font-bold font-mono mt-1 text-indigo-700">
              {formatINR(data.salesSummary.taxCollectedPaise)}
            </h4>
            <span className="text-[9px] text-slate-400 mt-1">CGST + SGST + IGST</span>
          </div>

          <div className="card p-3.5 flex flex-col justify-between" style={{ background: 'var(--paper-2)' }}>
            <span className="text-[10px] text-slate-400 uppercase font-bold">Total Orders</span>
            <h4 className="text-lg md:text-xl font-bold font-mono mt-1 text-slate-800">
              {data.salesSummary.totalOrders}
            </h4>
            <span className="text-[9px] text-slate-400 mt-1">
              {data.salesSummary.completedOrders} settled • {data.salesSummary.cancelledOrders} cancelled
            </span>
          </div>
        </div>
      </section>

      {/* ── 2. PAYMENT RECONCILIATION & 3. SHIFT SUMMARY ── */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Payment Reconciliation */}
        <section className="card p-5 flex flex-col justify-between" style={{ background: 'var(--paper-2)' }}>
          <div>
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <CreditCard size={14} className="text-amber-500" />
                2. Payment Reconciliation
              </h4>
              <span className="text-[10px] font-mono text-slate-400">All channels reconciled</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--line)', color: 'var(--ink-3)' }}>
                    <th className="py-2">Method</th>
                    <th className="py-2 text-right">System Recorded</th>
                    <th className="py-2 text-right">Verified Actual</th>
                    <th className="py-2 text-right">Variance</th>
                    <th className="py-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.paymentReconciliation.map((p: any) => (
                    <tr key={p.method} className="border-b hover:bg-slate-50/50" style={{ borderColor: 'var(--line)' }}>
                      <td className="py-2.5 font-bold flex items-center gap-2">
                        {p.method === 'cash' && <Banknote size={14} className="text-emerald-600" />}
                        {p.method === 'upi' && <Smartphone size={14} className="text-indigo-600" />}
                        {p.method === 'card' && <CreditCard size={14} className="text-blue-600" />}
                        {p.method === 'other' && <Layers size={14} className="text-amber-600" />}
                        <span>{p.label}</span>
                      </td>
                      <td className="py-2.5 text-right font-mono font-bold">{formatINR(p.systemAmountPaise)}</td>
                      <td className="py-2.5 text-right font-mono">{formatINR(p.actualAmountPaise)}</td>
                      <td className="py-2.5 text-right font-mono text-slate-400">₹0</td>
                      <td className="py-2.5 text-center">
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-bold" style={{ borderColor: 'var(--line)' }}>
                    <td className="py-2.5">Total Collections</td>
                    <td className="py-2.5 text-right font-mono text-sm text-slate-900">
                      {formatINR(
                        data.paymentReconciliation.reduce((s: number, p: any) => s + p.systemAmountPaise, 0)
                      )}
                    </td>
                    <td className="py-2.5 text-right font-mono text-sm text-slate-900">
                      {formatINR(
                        data.paymentReconciliation.reduce((s: number, p: any) => s + p.actualAmountPaise, 0)
                      )}
                    </td>
                    <td className="py-2.5 text-right font-mono text-slate-400">₹0</td>
                    <td className="py-2.5 text-center text-[10px] text-emerald-700">MATCHED</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </section>

        {/* Shift Summary */}
        <section className="card p-5 flex flex-col justify-between" style={{ background: 'var(--paper-2)' }}>
          <div>
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Clock size={14} className="text-amber-500" />
                3. Shift Summary ({data.shiftSummary.totalShifts} Total Shifts)
              </h4>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-emerald-700 font-bold">{data.shiftSummary.closedShifts} Closed</span>
                <span>•</span>
                <span className={data.shiftSummary.openShifts > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}>
                  {data.shiftSummary.openShifts} Open
                </span>
              </div>
            </div>

            {data.shiftSummary.shifts.length === 0 ? (
              <div className="p-8 text-center border rounded-xl border-dashed text-slate-400 text-xs">
                No individual cashier shifts registered for this date. The day closing will use the register drawer directly.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b" style={{ borderColor: 'var(--line)', color: 'var(--ink-3)' }}>
                      <th className="py-2">Cashier</th>
                      <th className="py-2 text-right">Opening</th>
                      <th className="py-2 text-right">Sales</th>
                      <th className="py-2 text-right">Expected</th>
                      <th className="py-2 text-right">Actual</th>
                      <th className="py-2 text-right">Variance</th>
                      <th className="py-2 text-center">Status</th>
                      {!isClosed && <th className="py-2 text-right">Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {data.shiftSummary.shifts.map((s: any) => (
                      <tr key={s.id} className="border-b hover:bg-slate-50/50" style={{ borderColor: 'var(--line)' }}>
                        <td className="py-2.5 font-bold">{s.cashierName}</td>
                        <td className="py-2.5 text-right font-mono">{formatINR(s.openingCashPaise)}</td>
                        <td className="py-2.5 text-right font-mono">{formatINR(s.salesPaise)}</td>
                        <td className="py-2.5 text-right font-mono">{formatINR(s.expectedCashPaise)}</td>
                        <td className="py-2.5 text-right font-mono font-bold">
                          {s.status === 'open' ? 'Pending' : formatINR(s.actualCashPaise)}
                        </td>
                        <td
                          className={`py-2.5 text-right font-mono font-bold ${
                            s.variancePaise === 0 ? 'text-slate-400' : s.variancePaise > 0 ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {s.status === 'open' ? '—' : `${s.variancePaise >= 0 ? '+' : ''}${formatINR(s.variancePaise)}`}
                        </td>
                        <td className="py-2.5 text-center">
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                              s.status === 'closed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800 animate-pulse'
                            }`}
                          >
                            {s.status.toUpperCase()}
                          </span>
                        </td>
                        {!isClosed && (
                          <td className="py-2.5 text-right">
                            {s.status === 'open' && isManagerOrOwner && (
                              <button
                                onClick={() => {
                                  setSelectedShiftToForceClose(s);
                                  setForceCloseActualCash(
                                    ((s.expectedCashPaise || s.openingCashPaise + s.salesPaise) / 100).toString()
                                  );
                                  setActiveModal('force_close_shift');
                                }}
                                className="btn btn-xs btn-ghost text-rose-600 border border-rose-200"
                              >
                                Force Close
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ── 4. CASH RECONCILIATION & 5. CASH COUNTING UI ── */}
      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6">
        {/* Cash Counting UI (Denomination Counter) */}
        <section className="card p-5 flex flex-col justify-between" style={{ background: 'var(--paper-2)' }}>
          <div>
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Banknote size={14} className="text-amber-500" />
                4. Cash Counting &amp; Denomination Calculator
              </h4>
              <div className="flex items-center gap-2">
                <button
                  disabled={isClosed}
                  onClick={() => setUseDenominationCounter(!useDenominationCounter)}
                  className="text-[10px] font-bold text-amber-700 underline"
                >
                  {useDenominationCounter ? 'Switch to Direct Amount' : 'Switch to Denomination Counter'}
                </button>
              </div>
            </div>

            {useDenominationCounter ? (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { note: 500, key: 'd500' },
                    { note: 200, key: 'd200' },
                    { note: 100, key: 'd100' },
                    { note: 50, key: 'd50' },
                    { note: 20, key: 'd20' },
                    { note: 10, key: 'd10' },
                  ].map((denom) => {
                    const count = (denominations as any)[denom.key] || 0;
                    const subtotal = count * denom.note;
                    return (
                      <div
                        key={denom.note}
                        className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-xs">₹{denom.note}</span>
                          <span className="text-[10px] font-mono font-bold text-slate-500">
                            = {formatINR(subtotal * 100)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mt-2">
                          <input
                            disabled={isClosed}
                            type="number"
                            min="0"
                            value={count || ''}
                            placeholder="0"
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                              setDenominations((prev) => ({ ...prev, [denom.key]: val }));
                            }}
                            className="inp h-8 text-center text-xs font-mono font-bold"
                          />
                        </div>
                      </div>
                    );
                  })}

                  <div className="col-span-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-xs">Coins Total (₹)</span>
                      <span className="text-[10px] font-mono font-bold text-slate-500">
                        = {formatINR(denominations.coinsPaise || 0)}
                      </span>
                    </div>
                    <input
                      disabled={isClosed}
                      type="number"
                      min="0"
                      step="0.5"
                      value={denominations.coinsPaise ? (denominations.coinsPaise / 100).toString() : ''}
                      placeholder="0.00"
                      onChange={(e) => {
                        const val = Math.max(0, parseFloat(e.target.value) || 0);
                        setDenominations((prev) => ({ ...prev, coinsPaise: Math.round(val * 100) }));
                      }}
                      className="inp h-8 text-xs font-mono font-bold mt-2"
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900 text-white flex justify-between items-center mt-3">
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-bold block">
                      Total Actual Cash Calculated
                    </span>
                    <span className="text-xl font-black font-mono text-emerald-400">
                      {formatINR(countedFromDenominationsPaise)}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">Automatic sum from notes &amp; coins</span>
                </div>
              </div>
            ) : (
              <div className="space-y-3 py-4">
                <label className="lbl">Direct Counted Cash in Drawer (INR)</label>
                <input
                  disabled={isClosed}
                  type="number"
                  min="0"
                  step="0.01"
                  value={manualCashInput}
                  onChange={(e) => setManualCashInput(e.target.value)}
                  placeholder="Enter counted cash in drawer..."
                  className="inp text-xl font-mono font-black"
                />
                <p className="text-[11px] text-slate-400">
                  Switch back to denomination counter above to track note breakdowns (₹500, ₹200, etc.).
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Cash Reconciliation Formula Box */}
        <section className="card p-5 flex flex-col justify-between" style={{ background: 'var(--paper-2)' }}>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
              <DollarSign size={14} className="text-amber-500" />
              5. Cash Reconciliation Formula
            </h4>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b" style={{ borderColor: 'var(--line)' }}>
                <span className="text-slate-500">Opening Cash Float</span>
                <span className="font-mono font-bold">{formatINR(data.cashReconciliation.openingCashPaise)}</span>
              </div>
              <div className="flex justify-between py-1 border-b text-emerald-700" style={{ borderColor: 'var(--line)' }}>
                <span>+ Cash Sales Today</span>
                <span className="font-mono font-bold">+{formatINR(data.cashReconciliation.cashSalesPaise)}</span>
              </div>
              <div className="flex justify-between py-1 border-b text-emerald-700" style={{ borderColor: 'var(--line)' }}>
                <span>+ Cash In / Float Top-ups</span>
                <span className="font-mono font-bold">+{formatINR(data.cashReconciliation.cashInPaise)}</span>
              </div>
              <div className="flex justify-between py-1 border-b text-rose-600" style={{ borderColor: 'var(--line)' }}>
                <span>− Cash Expenses Recorded</span>
                <span className="font-mono font-bold">−{formatINR(data.cashReconciliation.cashExpensesPaise)}</span>
              </div>
              <div className="flex justify-between py-1 border-b text-rose-600" style={{ borderColor: 'var(--line)' }}>
                <span>− Cash Withdrawals / Drops</span>
                <span className="font-mono font-bold">−{formatINR(data.cashReconciliation.cashOutPaise)}</span>
              </div>
              <div className="flex justify-between py-1 border-b text-rose-600" style={{ borderColor: 'var(--line)' }}>
                <span>− Refunds Paid in Cash</span>
                <span className="font-mono font-bold">−{formatINR(data.cashReconciliation.cashRefundsPaise)}</span>
              </div>

              <div className="flex justify-between py-2 border-t-2 font-bold text-sm" style={{ borderColor: 'var(--line)' }}>
                <span>= Expected Closing Cash</span>
                <span className="font-mono">{formatINR(expectedCashPaise)}</span>
              </div>

              <div className="flex justify-between py-1.5 bg-slate-100 px-3 rounded-lg font-bold">
                <span>Actual Cash Counted</span>
                <span className="font-mono text-emerald-800">{formatINR(effectiveActualCashPaise)}</span>
              </div>

              {/* Variance Indicator */}
              <div
                className={`p-3 rounded-xl border mt-2 ${
                  !hasVariance
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                <div className="flex justify-between items-center font-bold">
                  <span>Reconciliation Variance:</span>
                  <span className="font-mono text-base">
                    {cashVariancePaise >= 0 ? '+' : ''}
                    {formatINR(cashVariancePaise)}
                  </span>
                </div>
                <p className="text-[11px] mt-0.5 leading-normal">
                  {!hasVariance
                    ? '✓ Physical cash perfectly matches expected balance.'
                    : `⚠️ Drawer variance detected (${
                        cashVariancePaise > 0 ? 'Cash Excess' : 'Cash Shortage'
                      }). A mandatory reason must be provided below.`}
                </p>
              </div>

              {/* Variance Reason Input if variance exists */}
              {hasVariance && (
                <div className="pt-2 space-y-2">
                  <label className="lbl">Variance Reason (Required)</label>
                  <select
                    disabled={isClosed}
                    value={varianceReason}
                    onChange={(e) => setVarianceReason(e.target.value)}
                    className="inp text-xs font-bold"
                  >
                    <option value="Cash shortage">Cash shortage</option>
                    <option value="Cash excess">Cash excess</option>
                    <option value="Expense not recorded">Expense not recorded</option>
                    <option value="Wrong change given">Wrong change given</option>
                    <option value="Cash counting error">Cash counting error</option>
                    <option value="Other">Other</option>
                  </select>
                  <textarea
                    disabled={isClosed}
                    value={customVarianceNote}
                    onChange={(e) => setCustomVarianceNote(e.target.value)}
                    placeholder="Enter custom manager explanation or notes regarding this variance..."
                    className="inp h-14 text-xs"
                  />
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* ── 6. TOMORROW OPENING CASH CONFIGURATION (CRITICAL FEATURE) ── */}
      <section className="card p-6 border-2 border-emerald-300" style={{ background: 'var(--paper-2)' }}>
        <div className="flex justify-between items-center mb-4">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-800 font-bold">
              NEXT BUSINESS DAY ROLLOVER
            </span>
            <h3 className="text-xl font-bold font-display text-slate-900 flex items-center gap-2">
              <Calendar className="text-emerald-600" size={20} />
              6. Tomorrow Opening Cash Configuration ({data.tomorrowDate})
            </h3>
          </div>
          <span className="text-xs bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full font-bold">
            Float Carry-Forward
          </span>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Options */}
          <div className="space-y-3 text-xs">
            <label className="block text-slate-600 font-bold mb-1">
              Select how to configure tomorrow&apos;s cash drawer:
            </label>

            <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white cursor-pointer hover:bg-slate-50 transition">
              <input
                disabled={isClosed}
                type="radio"
                name="tomorrowOption"
                checked={tomorrowOption === 'same'}
                onChange={() => setTomorrowOption('same')}
                className="w-4 h-4 text-emerald-600"
              />
              <div className="flex-1">
                <b className="block">Keep same amount as today&apos;s opening float</b>
                <span className="text-slate-500 text-[11px]">
                  Maintain standard float of {formatINR(data.cashReconciliation.openingCashPaise)}.
                </span>
              </div>
              <span className="font-mono font-bold text-slate-700">
                {formatINR(data.cashReconciliation.openingCashPaise)}
              </span>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white cursor-pointer hover:bg-slate-50 transition">
              <input
                disabled={isClosed}
                type="radio"
                name="tomorrowOption"
                checked={tomorrowOption === 'entire'}
                onChange={() => setTomorrowOption('entire')}
                className="w-4 h-4 text-emerald-600"
              />
              <div className="flex-1">
                <b className="block">Keep entire closing cash in drawer</b>
                <span className="text-slate-500 text-[11px]">No cash will be removed/deposited tonight.</span>
              </div>
              <span className="font-mono font-bold text-slate-700">{formatINR(effectiveActualCashPaise)}</span>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white cursor-pointer hover:bg-slate-50 transition">
              <input
                disabled={isClosed}
                type="radio"
                name="tomorrowOption"
                checked={tomorrowOption === 'custom'}
                onChange={() => setTomorrowOption('custom')}
                className="w-4 h-4 text-emerald-600"
              />
              <div className="flex-1">
                <b className="block">Custom opening cash amount</b>
                <span className="text-slate-500 text-[11px]">Specify exact rupee amount for tomorrow.</span>
              </div>
              {tomorrowOption === 'custom' && (
                <input
                  disabled={isClosed}
                  type="number"
                  min="0"
                  value={customTomorrowCash}
                  onChange={(e) => setCustomTomorrowCash(e.target.value)}
                  className="inp w-28 h-8 text-right font-mono font-bold text-xs"
                />
              )}
            </label>

            <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white cursor-pointer hover:bg-slate-50 transition">
              <input
                disabled={isClosed}
                type="radio"
                name="tomorrowOption"
                checked={tomorrowOption === 'zero'}
                onChange={() => setTomorrowOption('zero')}
                className="w-4 h-4 text-emerald-600"
              />
              <div className="flex-1">
                <b className="block">Remove all cash from drawer (₹0 Float)</b>
                <span className="text-slate-500 text-[11px]">Complete cash drop to safe or bank.</span>
              </div>
              <span className="font-mono font-bold text-slate-700">₹0</span>
            </label>
          </div>

          {/* Calculations and Destination */}
          <div className="flex flex-col justify-between p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="space-y-3">
              <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider">
                Automatic Calculation Summary
              </h4>

              <div className="flex justify-between text-xs py-1 border-b border-slate-200">
                <span className="text-slate-500">Today&apos;s Actual Closing Cash:</span>
                <span className="font-mono font-bold text-slate-900">{formatINR(effectiveActualCashPaise)}</span>
              </div>

              <div className="flex justify-between text-xs py-1 border-b border-slate-200 text-emerald-700">
                <span>Tomorrow&apos;s Opening Float:</span>
                <span className="font-mono font-bold">{formatINR(tomorrowOpeningCashPaise)}</span>
              </div>

              <div className="flex justify-between text-sm py-2 font-black border-b border-slate-300">
                <span>Cash to Remove / Deposit:</span>
                <span className="font-mono text-indigo-900">{formatINR(cashToRemoveDepositPaise)}</span>
              </div>

              {/* Destination selector */}
              {cashToRemoveDepositPaise > 0 && (
                <div className="pt-2 space-y-2 text-xs">
                  <label className="lbl">Cash Deposit / Removal Destination</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'vault', label: 'Cash Vault / Safe', icon: Vault },
                      { key: 'bank', label: 'Deposit to Bank', icon: Building },
                      { key: 'owner_withdrawal', label: 'Owner Withdrawal', icon: DollarSign },
                      { key: 'other', label: 'Other Cash Account', icon: Layers },
                    ].map((dest) => (
                      <button
                        key={dest.key}
                        disabled={isClosed}
                        type="button"
                        onClick={() => setDepositDestination(dest.key as any)}
                        className={`p-2.5 rounded-lg border text-left flex items-center gap-2 transition ${
                          depositDestination === dest.key
                            ? 'bg-slate-900 text-white font-bold border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <dest.icon size={14} />
                        <span className="text-[11px]">{dest.label}</span>
                      </button>
                    ))}
                  </div>

                  {depositDestination === 'bank' && (
                    <div className="pt-2">
                      <label className="lbl">Select Destination Bank Account</label>
                      <select
                        disabled={isClosed}
                        value={selectedAccountId}
                        onChange={(e) => setSelectedAccountId(e.target.value)}
                        className="inp text-xs font-bold"
                      >
                        {data.bankAccounts?.map((acc: any) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} ({acc.identifier})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Explicit Confirmation Text */}
            <div className="p-3 bg-emerald-100/70 border border-emerald-300 rounded-lg text-emerald-900 text-xs font-bold">
              “{formatINR(tomorrowOpeningCashPaise)} will remain as tomorrow&apos;s opening cash.{' '}
              {cashToRemoveDepositPaise > 0
                ? `${formatINR(cashToRemoveDepositPaise)} will be recorded as removed and deposited to ${depositDestination}.`
                : 'No cash will be removed.'}”
            </div>
          </div>
        </div>
      </section>

      {/* ── EXPANDABLE SECTIONS: EXPENSES, REFUNDS, SETTLEMENTS ── */}
      <div className="space-y-3">
        {/* Expenses */}
        <div className="card border overflow-hidden" style={{ background: 'var(--paper-2)' }}>
          <button
            onClick={() => setExpandExpenses(!expandExpenses)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50/50 transition"
          >
            <div className="flex items-center gap-2">
              <Receipt size={16} className="text-amber-500" />
              <span className="font-bold text-xs uppercase tracking-wide">
                Expenses Recorded During Day ({data.expenses.length} Records • Total {formatINR(data.totalExpensesPaise)})
              </span>
            </div>
            {expandExpenses ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {expandExpenses && (
            <div className="p-4 border-t border-slate-200">
              {data.expenses.length === 0 ? (
                <p className="text-xs text-slate-400">No operational expenses recorded during this business day.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b text-slate-400">
                        <th className="py-2">Time</th>
                        <th className="py-2">Category</th>
                        <th className="py-2">Vendor</th>
                        <th className="py-2">Method</th>
                        <th className="py-2">Reference</th>
                        <th className="py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.expenses.map((e: any) => (
                        <tr key={e.id} className="border-b hover:bg-slate-50/50">
                          <td className="py-2 font-mono">{e.time}</td>
                          <td className="py-2 font-bold">{e.category}</td>
                          <td className="py-2 text-slate-600">{e.vendor || '—'}</td>
                          <td className="py-2 uppercase font-mono text-[10px]">{e.method}</td>
                          <td className="py-2 text-slate-400 font-mono">{e.reference || '—'}</td>
                          <td className="py-2 text-right font-mono font-bold text-rose-600">
                            {formatINR(e.amountPaise)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Refunds & Cancellations */}
        <div className="card border overflow-hidden" style={{ background: 'var(--paper-2)' }}>
          <button
            onClick={() => setExpandRefunds(!expandRefunds)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50/50 transition"
          >
            <div className="flex items-center gap-2">
              <ShieldAlert size={16} className="text-rose-500" />
              <span className="font-bold text-xs uppercase tracking-wide">
                Refunds &amp; Cancellations ({data.salesSummary.cancelledOrders} Cancelled Orders • {data.refundsAndCancellations.cancelledItemsCount} Void Items)
              </span>
            </div>
            {expandRefunds ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {expandRefunds && (
            <div className="p-4 border-t border-slate-200 grid sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border">
                <span className="text-slate-400 block text-[10px]">CASH REFUNDS</span>
                <b className="font-mono text-sm text-rose-600">{formatINR(data.refundsAndCancellations.cashRefundsPaise)}</b>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border">
                <span className="text-slate-400 block text-[10px]">UPI REFUNDS</span>
                <b className="font-mono text-sm">{formatINR(data.refundsAndCancellations.upiRefundsPaise)}</b>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border">
                <span className="text-slate-400 block text-[10px]">CARD REFUNDS</span>
                <b className="font-mono text-sm">{formatINR(data.refundsAndCancellations.cardRefundsPaise)}</b>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border">
                <span className="text-slate-400 block text-[10px]">KOT VOIDS / VOID ITEMS</span>
                <b className="font-mono text-sm text-slate-800">
                  {data.refundsAndCancellations.kotCancellationsCount} KOTs • {data.refundsAndCancellations.complimentaryItemsCount} Free/Comp
                </b>
              </div>
            </div>
          )}
        </div>

        {/* Delivery / Settlements */}
        <div className="card border overflow-hidden" style={{ background: 'var(--paper-2)' }}>
          <button
            onClick={() => setExpandSettlements(!expandSettlements)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50/50 transition"
          >
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-indigo-500" />
              <span className="font-bold text-xs uppercase tracking-wide">
                Delivery &amp; Online Platform Settlements
              </span>
            </div>
            {expandSettlements ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {expandSettlements && (
            <div className="p-4 border-t border-slate-200 grid sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border">
                <span className="text-slate-400 block text-[10px]">PLATFORM SALES</span>
                <b className="font-mono text-sm">{formatINR(data.settlements.platformSalesPaise)}</b>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border">
                <span className="text-slate-400 block text-[10px]">COMMISSION &amp; FEES</span>
                <b className="font-mono text-sm text-rose-600">
                  −{formatINR(data.settlements.platformCommissionPaise + data.settlements.platformFeesPaise)}
                </b>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border">
                <span className="text-slate-400 block text-[10px]">EXPECTED SETTLEMENT</span>
                <b className="font-mono text-sm text-emerald-700">{formatINR(data.settlements.expectedSettlementPaise)}</b>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border">
                <span className="text-slate-400 block text-[10px]">DIFFERENCE</span>
                <b className="font-mono text-sm text-slate-500">{formatINR(data.settlements.settlementDifferencePaise)}</b>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── MODALS ── */}

      {/* 1. Validation Errors Modal */}
      {activeModal === 'validation_errors' && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-rose-200 anim-pop">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <ShieldAlert size={24} />
              <h3 className="font-bold text-base">CANNOT CLOSE BUSINESS DAY</h3>
            </div>
            <p className="text-xs text-slate-600 mb-4">
              The following operational issues must be resolved before final closure:
            </p>
            <ul className="space-y-2 mb-6">
              {validationIssues.map((issue, i) => (
                <li key={i} className="text-xs text-rose-800 bg-rose-50 p-2.5 rounded-lg border border-rose-200 flex items-start gap-2">
                  <span className="font-bold">•</span>
                  <span>{issue}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-end">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold"
              >
                Understood, Return to Review
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Final Closing Confirmation Modal */}
      {activeModal === 'final_confirm' && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 anim-pop space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">FINAL CONFIRMATION</span>
                <h3 className="font-bold text-lg text-slate-900">FINAL DAY CLOSING REVIEW</h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3.5 rounded-xl font-mono">
              <div>
                <span className="text-[10px] text-slate-400 font-sans block">Business Date</span>
                <b>{data.businessDate}</b>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-sans block">Net Sales</span>
                <b>{formatINR(data.salesSummary.netSalesPaise)}</b>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-sans block">Total Collections</span>
                <b>{formatINR(data.paymentReconciliation.reduce((s: number, p: any) => s + p.systemAmountPaise, 0))}</b>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-sans block">Cash Counted</span>
                <b>{formatINR(effectiveActualCashPaise)}</b>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-sans block">Cash Variance</span>
                <b className={cashVariancePaise === 0 ? 'text-emerald-700' : 'text-rose-600'}>
                  {cashVariancePaise >= 0 ? '+' : ''}{formatINR(cashVariancePaise)}
                </b>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-sans block">Tomorrow Float</span>
                <b className="text-emerald-700">{formatINR(tomorrowOpeningCashPaise)}</b>
              </div>
              <div className="col-span-2 pt-1 border-t border-slate-200 flex justify-between font-bold font-sans">
                <span>Cash Removed for Deposit ({depositDestination}):</span>
                <span className="font-mono text-indigo-900">{formatINR(cashToRemoveDepositPaise)}</span>
              </div>
            </div>

            {!isManagerOrOwner && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                <label className="lbl text-amber-900">Manager Authorization PIN Required</label>
                <input
                  type="password"
                  placeholder="Enter Manager / Owner PIN..."
                  value={managerPin}
                  onChange={(e) => setManagerPin(e.target.value)}
                  className="inp text-xs font-bold"
                />
              </div>
            )}

            <div className="text-[11px] text-slate-500">
              Closing will lock this business day, advance the operating date to {data.tomorrowDate}, and record an official audit trail.
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                disabled={submitting}
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                disabled={submitting}
                onClick={handleConfirmCloseBusinessDay}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="animate-spin w-3.5 h-3.5" /> Closing Day...
                  </>
                ) : (
                  'Confirm & Close Business Day'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Force Close Shift Modal */}
      {activeModal === 'force_close_shift' && selectedShiftToForceClose && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 anim-pop space-y-4">
            <h3 className="font-bold text-base text-slate-900">
              Force Close Shift: {selectedShiftToForceClose.cashierName}
            </h3>
            <p className="text-xs text-slate-500">
              Expected Cash for shift:{' '}
              <b>{formatINR(selectedShiftToForceClose.expectedCashPaise || selectedShiftToForceClose.salesPaise)}</b>
            </p>

            <div>
              <label className="lbl">Counted Cash for Shift (INR)</label>
              <input
                type="number"
                value={forceCloseActualCash}
                onChange={(e) => setForceCloseActualCash(e.target.value)}
                className="inp text-sm font-mono font-bold"
              />
            </div>

            {!isManagerOrOwner && (
              <div>
                <label className="lbl">Manager PIN</label>
                <input
                  type="password"
                  placeholder="Manager PIN"
                  value={managerPin}
                  onChange={(e) => setManagerPin(e.target.value)}
                  className="inp text-xs font-bold"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 border rounded-lg text-xs font-bold"
              >
                Cancel
              </button>
              <button
                disabled={submitting}
                onClick={handleForceCloseShift}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold"
              >
                {submitting ? 'Closing...' : 'Close Shift'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Reopen Day Modal */}
      {activeModal === 'reopen_day' && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 anim-pop space-y-4">
            <h3 className="font-bold text-base text-rose-700 flex items-center gap-2">
              <Unlock size={18} /> Reopen Business Day
            </h3>
            <p className="text-xs text-slate-600">
              Reopening a closed day must have a valid operational reason. This action will be permanently logged in the audit trail.
            </p>

            <div>
              <label className="lbl">Reopen Reason (Required)</label>
              <textarea
                required
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="Reason for reopening (e.g. late night settlement adjustment, audit correction)..."
                className="inp h-20 text-xs"
              />
            </div>

            {!isManagerOrOwner && (
              <div>
                <label className="lbl">Manager PIN</label>
                <input
                  type="password"
                  value={managerPin}
                  onChange={(e) => setManagerPin(e.target.value)}
                  className="inp text-xs font-bold"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 border rounded-lg text-xs font-bold"
              >
                Cancel
              </button>
              <button
                disabled={submitting}
                onClick={handleReopenDay}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold"
              >
                {submitting ? 'Reopening...' : 'Confirm Reopen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Print Preview Report Modal */}
      {activeModal === 'print_preview' && (
        <DayClosingPrintReport
          reportData={data.dayClosing ? { ...data.dayClosing, outlet } : { ...data, outlet }}
          onClose={() => setActiveModal(null)}
        />
      )}
    </div>
  );
}
