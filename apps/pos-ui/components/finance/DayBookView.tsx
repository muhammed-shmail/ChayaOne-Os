'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BookOpen,
  Calendar,
  Search,
  Filter,
  Download,
  Printer,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  X,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Eye,
  Landmark,
  Wallet,
  Banknote,
  Smartphone,
  CreditCard,
  Shield,
  Lock,
  Layers,
  FileSpreadsheet,
  RotateCcw,
  Building2,
  Users,
  BriefcaseBusiness,
} from 'lucide-react';
import { formatINR } from '@cafeos/core';

interface DayBookViewProps {
  outlet?: any;
  currentStaff?: any;
}

interface DayBookEntry {
  id: string;
  timestamp: string | Date;
  dateStr: string;
  timeStr: string;
  type: 'sale' | 'expense' | 'payment' | 'refund' | 'vendor' | 'bank' | 'payroll' | 'cash_drawer';
  reference: string;
  description: string;
  method: string;
  debitPaise: number;
  creditPaise: number;
  status: 'completed' | 'pending' | 'cancelled' | 'refunded' | 'voided';
  source: string;
  metadata?: Record<string, any>;
  financialYearName?: string;
}

interface DayBookSummary {
  openingBalancePaise: number;
  totalSalesPaise: number;
  totalExpensesPaise: number;
  totalRefundsPaise: number;
  totalDebitPaise: number;
  totalCreditPaise: number;
  netMovementPaise: number;
  closingBalancePaise: number;
  dayClosingRecord?: {
    id: string;
    closingNumber: string;
    status: string;
    closedAt: string | null;
    closedByName: string | null;
    actualCashPaise: number;
    cashVariancePaise: number;
  } | null;
}

interface FinancialYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'closed';
  isDefault: boolean;
}

export function DayBookView({ outlet, currentStaff }: DayBookViewProps) {
  // Filters State
  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);
  const [selectedFYId, setSelectedFYId] = useState<string>('');
  const [datePreset, setDatePreset] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('today');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedMethod, setSelectedMethod] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(25);

  // Data State
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<DayBookEntry[]>([]);
  const [summary, setSummary] = useState<DayBookSummary>({
    openingBalancePaise: 0,
    totalSalesPaise: 0,
    totalExpensesPaise: 0,
    totalRefundsPaise: 0,
    totalDebitPaise: 0,
    totalCreditPaise: 0,
    netMovementPaise: 0,
    closingBalancePaise: 0,
  });
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [selectedEntry, setSelectedEntry] = useState<DayBookEntry | null>(null);

  // Helper to compute local date in outlet timezone
  const getTodayDateStr = useCallback(() => {
    try {
      const tz = outlet?.timezone || 'Asia/Kolkata';
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(new Date());
      const y = parts.find((p) => p.type === 'year')?.value ?? '2026';
      const m = parts.find((p) => p.type === 'month')?.value ?? '01';
      const d = parts.find((p) => p.type === 'day')?.value ?? '01';
      return `${y}-${m}-${d}`;
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  }, [outlet?.timezone]);

  // Initialize date range based on preset
  useEffect(() => {
    const today = getTodayDateStr();
    const parts = today.split('-').map(Number);
    const y = parts[0] ?? 2026;
    const m = parts[1] ?? 1;
    const d = parts[2] ?? 1;
    const todayObj = new Date(Date.UTC(y, m - 1, d));

    if (datePreset === 'today') {
      setDateFrom(today);
      setDateTo(today);
    } else if (datePreset === 'yesterday') {
      const yestObj = new Date(todayObj.getTime() - 864e5);
      const yestStr = yestObj.toISOString().slice(0, 10);
      setDateFrom(yestStr);
      setDateTo(yestStr);
    } else if (datePreset === 'week') {
      const dayOfWeek = todayObj.getUTCDay(); // 0 is Sunday
      const diff = todayObj.getUTCDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Monday
      const monday = new Date(todayObj.setDate(diff));
      setDateFrom(monday.toISOString().slice(0, 10));
      setDateTo(today);
    } else if (datePreset === 'month') {
      const firstDay = `${y}-${String(m).padStart(2, '0')}-01`;
      setDateFrom(firstDay);
      setDateTo(today);
    }
    setPage(1);
  }, [datePreset, getTodayDateStr]);


  // Load Financial Years
  useEffect(() => {
    async function loadFYs() {
      try {
        const res = await fetch('/api/finance/financial-year');
        const json = await res.json();
        if (json.ok && Array.isArray(json.financialYears)) {
          setFinancialYears(json.financialYears);
          if (json.activeFinancialYear?.id) {
            setSelectedFYId(json.activeFinancialYear.id);
          }
        }
      } catch (e) {
        console.error('Failed to load FYs:', e);
      }
    }
    loadFYs();
  }, []);

  // Fetch Day Book Entries
  const fetchDayBook = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (selectedFYId) params.set('financialYearId', selectedFYId);
      if (selectedType && selectedType !== 'all') params.set('type', selectedType);
      if (selectedMethod && selectedMethod !== 'all') params.set('paymentMethod', selectedMethod);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));

      const res = await fetch(`/api/finance/day-book?${params.toString()}`);
      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'Failed to fetch Day Book');
      }

      setEntries(json.data.entries || []);
      setSummary(json.data.summary);
      setTotalCount(json.data.totalCount || 0);
      setTotalPages(json.data.totalPages || 1);
    } catch (err: any) {
      setError(err.message || 'Error loading Day Book');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, selectedFYId, selectedType, selectedMethod, searchQuery, page, pageSize]);

  useEffect(() => {
    if (dateFrom && dateTo) {
      fetchDayBook();
    }
  }, [fetchDayBook, dateFrom, dateTo]);

  // CSV Export Handler
  const handleExportCSV = () => {
    const params = new URLSearchParams();
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (selectedFYId) params.set('financialYearId', selectedFYId);
    if (selectedType && selectedType !== 'all') params.set('type', selectedType);
    if (selectedMethod && selectedMethod !== 'all') params.set('paymentMethod', selectedMethod);
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    params.set('export', 'csv');

    window.open(`/api/finance/day-book?${params.toString()}`, '_blank');
  };

  // Print Handler
  const handlePrint = () => {
    window.print();
  };

  // Format Method Icon
  const getMethodBadge = (m: string) => {
    const lower = (m || '').toLowerCase();
    if (lower === 'cash') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
          <Banknote size={12} /> Cash
        </span>
      );
    }
    if (lower === 'upi') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
          <Smartphone size={12} /> UPI
        </span>
      );
    }
    if (lower === 'card') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-900 border border-blue-300">
          <CreditCard size={12} /> Card
        </span>
      );
    }
    if (lower.includes('bank')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-900 border border-purple-300">
          <Landmark size={12} /> Bank
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
        <Wallet size={12} /> {m || 'Other'}
      </span>
    );
  };

  // Format Type Badge
  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'sale':
        return <span className="pill text-[11px] font-extrabold bg-emerald-50 text-emerald-800 border-emerald-300">Sale</span>;
      case 'expense':
        return <span className="pill text-[11px] font-extrabold bg-rose-50 text-rose-800 border-rose-300">Expense</span>;
      case 'refund':
        return <span className="pill text-[11px] font-extrabold bg-amber-50 text-amber-800 border-amber-300">Refund</span>;
      case 'vendor':
        return <span className="pill text-[11px] font-extrabold bg-orange-50 text-orange-800 border-orange-300">Vendor Payout</span>;
      case 'bank':
        return <span className="pill text-[11px] font-extrabold bg-indigo-50 text-indigo-800 border-indigo-300">Bank Txn</span>;
      case 'payroll':
        return <span className="pill text-[11px] font-extrabold bg-purple-50 text-purple-800 border-purple-300">Payroll</span>;
      case 'cash_drawer':
        return <span className="pill text-[11px] font-extrabold bg-cyan-50 text-cyan-800 border-cyan-300">Cash Drawer</span>;
      default:
        return <span className="pill text-[11px] font-extrabold bg-slate-50 text-slate-800 border-slate-300">{type}</span>;
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* ── HEADER & ACTIONS ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold font-display flex items-center gap-2">
              <BookOpen className="text-amber-600" size={22} /> Restaurant Day Book
            </h3>
            <span className="pill text-[11px] font-extrabold" style={{ background: 'var(--paper-3)', color: 'var(--ink-2)' }}>
              Audit Register
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Authoritative chronological financial register synchronized with Billing, Expenses, Cash Drawer &amp; Day Closing.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={fetchDayBook}
            className="btn btn-secondary text-xs gap-1.5 px-3 py-2"
            title="Refresh Day Book"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button
            onClick={handleExportCSV}
            className="btn btn-secondary text-xs gap-1.5 px-3 py-2"
            title="Export filtered records to CSV"
          >
            <FileSpreadsheet size={14} /> Export CSV
          </button>
          <button
            onClick={handlePrint}
            className="btn btn-secondary text-xs gap-1.5 px-3 py-2"
            title="Print Day Book Register"
          >
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      {/* ── TOP AUTHORITATIVE SUMMARY CARDS ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. Opening Balance */}
        <div className="card p-4 flex flex-col justify-between" style={{ background: 'var(--paper-2)' }}>
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-slate-500">Opening Balance</span>
            <Wallet size={16} className="text-slate-400" />
          </div>
          <div className="mt-2">
            <div className="text-lg font-mono font-extrabold text-slate-800">
              {formatINR(summary.openingBalancePaise)}
            </div>
            <span className="text-[10px] text-slate-400">Day start float</span>
          </div>
        </div>

        {/* 2. Total Sales (Debits) */}
        <div className="card p-4 flex flex-col justify-between" style={{ background: 'var(--paper-2)' }}>
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-slate-500">Total Sales</span>
            <ArrowUpRight size={16} className="text-emerald-600" />
          </div>
          <div className="mt-2">
            <div className="text-lg font-mono font-extrabold text-emerald-700">
              +{formatINR(summary.totalSalesPaise)}
            </div>
            <span className="text-[10px] text-slate-400">Gross receipts</span>
          </div>
        </div>

        {/* 3. Total Expenses (Credits) */}
        <div className="card p-4 flex flex-col justify-between" style={{ background: 'var(--paper-2)' }}>
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-slate-500">Expenses</span>
            <ArrowDownLeft size={16} className="text-rose-600" />
          </div>
          <div className="mt-2">
            <div className="text-lg font-mono font-extrabold text-rose-700">
              −{formatINR(summary.totalExpensesPaise)}
            </div>
            <span className="text-[10px] text-slate-400">Approved claims</span>
          </div>
        </div>

        {/* 4. Customer Refunds */}
        <div className="card p-4 flex flex-col justify-between" style={{ background: 'var(--paper-2)' }}>
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-slate-500">Refunds</span>
            <RotateCcw size={16} className="text-amber-600" />
          </div>
          <div className="mt-2">
            <div className="text-lg font-mono font-extrabold text-amber-700">
              −{formatINR(summary.totalRefundsPaise)}
            </div>
            <span className="text-[10px] text-slate-400">Order reversals</span>
          </div>
        </div>

        {/* 5. Net Movement */}
        <div className="card p-4 flex flex-col justify-between" style={{ background: 'var(--paper-2)' }}>
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-slate-500">Net Movement</span>
            <BriefcaseBusiness size={16} className="text-indigo-600" />
          </div>
          <div className="mt-2">
            <div
              className={`text-lg font-mono font-extrabold ${
                summary.netMovementPaise >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {summary.netMovementPaise >= 0 ? '+' : '−'}
              {formatINR(Math.abs(summary.netMovementPaise))}
            </div>
            <span className="text-[10px] text-slate-400">Inflows − Outflows</span>
          </div>
        </div>

        {/* 6. Closing Balance */}
        <div
          className="card p-4 flex flex-col justify-between border-2"
          style={{
            background: 'var(--paper-2)',
            borderColor: summary.dayClosingRecord ? 'var(--cardamom-d)' : 'var(--line)',
          }}
        >
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-slate-800">Closing Balance</span>
            {summary.dayClosingRecord ? (
              <CheckCircle2 size={16} className="text-emerald-600" />
            ) : (
              <Clock size={16} className="text-amber-500" />
            )}
          </div>
          <div className="mt-2">
            <div className="text-lg font-mono font-extrabold text-slate-900">
              {formatINR(summary.closingBalancePaise)}
            </div>
            <span className="text-[10px] text-slate-500">
              {summary.dayClosingRecord ? `Verified (${summary.dayClosingRecord.closingNumber})` : 'Expected EOD'}
            </span>
          </div>
        </div>
      </div>

      {/* ── DAY CLOSING SYNCHRONIZATION BANNER ── */}
      {summary.dayClosingRecord && (
        <div
          className="p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs"
          style={{ background: '#F0FDF4', borderColor: '#BBF7D0', color: '#166534' }}
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <div>
              <span className="font-extrabold">Authoritative Day Closing Finalized: </span>
              <span className="font-mono font-bold">{summary.dayClosingRecord.closingNumber}</span>
              <span className="text-emerald-700">
                {' '}· Closed by {summary.dayClosingRecord.closedByName || 'Manager'} · Counted Cash:{' '}
                <b>{formatINR(summary.dayClosingRecord.actualCashPaise)}</b>
                {summary.dayClosingRecord.cashVariancePaise !== 0 && (
                  <span className="ml-1 text-rose-600 font-bold">
                    (Variance: {formatINR(summary.dayClosingRecord.cashVariancePaise)})
                  </span>
                )}
              </span>
            </div>
          </div>
          <span className="pill bg-emerald-200 text-emerald-900 font-extrabold text-[10px] px-2.5 py-0.5">
            LOCKED EOD
          </span>
        </div>
      )}

      {/* ── FILTER CONTROLS BAR ── */}
      <section className="card p-4 space-y-3" style={{ background: 'var(--paper-2)' }}>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Financial Year Selector */}
          <div className="md:col-span-3">
            <label className="block text-[11px] font-extrabold text-slate-600 mb-1">Financial Year</label>
            <select
              value={selectedFYId}
              onChange={(e) => {
                setSelectedFYId(e.target.value);
                setPage(1);
              }}
              className="inp text-xs font-bold w-full"
            >
              <option value="">All Financial Years</option>
              {financialYears.map((fy) => (
                <option key={fy.id} value={fy.id}>
                  {fy.name} ({fy.startDate.slice(0, 4)}–{fy.endDate.slice(0, 4)}) {fy.status === 'active' ? '🟢 Active' : '🔒 Closed'}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Preset Selector */}
          <div className="md:col-span-4">
            <label className="block text-[11px] font-extrabold text-slate-600 mb-1">Date Period</label>
            <div className="inline-flex rounded-xl p-0.5 border w-full" style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }}>
              {(['today', 'yesterday', 'week', 'month', 'custom'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setDatePreset(p)}
                  className={`flex-1 py-1.5 text-[11px] font-extrabold rounded-lg capitalize transition-colors ${
                    datePreset === p ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Date Pickers (Custom or display) */}
          <div className="md:col-span-5 flex items-center gap-2">
            <div className="flex-1">
              <label className="block text-[11px] font-extrabold text-slate-600 mb-1">From Date</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setDatePreset('custom');
                  setPage(1);
                }}
                className="inp text-xs font-mono w-full"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[11px] font-extrabold text-slate-600 mb-1">To Date</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setDatePreset('custom');
                  setPage(1);
                }}
                className="inp text-xs font-mono w-full"
              />
            </div>
          </div>
        </div>

        {/* Row 2: Search + Filter Pills */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center pt-2 border-t" style={{ borderColor: 'var(--line)' }}>
          {/* Search Input */}
          <div className="md:col-span-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Search reference, order #, table, vendor, customer..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="inp pl-9 text-xs w-full"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Transaction Type Filters */}
          <div className="md:col-span-5 flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
            {[
              { key: 'all', label: 'All Types' },
              { key: 'sales', label: 'Sales' },
              { key: 'expenses', label: 'Expenses' },
              { key: 'refunds', label: 'Refunds' },
              { key: 'vendor', label: 'Vendor' },
              { key: 'bank', label: 'Bank' },
              { key: 'payroll', label: 'Payroll' },
              { key: 'cash_drawer', label: 'Cash Drawer' },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setSelectedType(t.key);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  selectedType === t.key
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Payment Method Filters */}
          <div className="md:col-span-3 flex items-center justify-start md:justify-end gap-1">
            {[
              { key: 'all', label: 'All Methods' },
              { key: 'cash', label: 'Cash' },
              { key: 'upi', label: 'UPI' },
              { key: 'card', label: 'Card' },
            ].map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => {
                  setSelectedMethod(m.key);
                  setPage(1);
                }}
                className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold uppercase transition-colors ${
                  selectedMethod === m.key
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── DAY BOOK REGISTER TABLE ── */}
      <section className="card p-0 overflow-hidden" style={{ background: 'var(--paper-2)' }}>
        <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: 'var(--line)' }}>
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-sm">Chronological Financial Journal</h4>
            <span className="pill text-[10px] font-extrabold bg-slate-100 text-slate-600">
              {totalCount} {totalCount === 1 ? 'record' : 'records'}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {dateFrom} to {dateTo}
          </span>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 text-rose-800 text-xs flex items-center gap-2 border-b border-rose-200">
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b text-[11px] font-extrabold text-slate-500 uppercase tracking-wider" style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }}>
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3">Reference</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-3">Method</th>
                <th className="py-3 px-4 text-right">Debit (₹)</th>
                <th className="py-3 px-4 text-right">Credit (₹)</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--line)' }}>
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <RefreshCw className="animate-spin inline-block mr-2" size={16} /> Loading Day Book transactions...
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <p className="font-bold text-sm">No financial transactions recorded for this period.</p>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      POS orders, settled bills, expenses, and cash drawer movements will automatically appear here.
                    </span>
                  </td>
                </tr>
              ) : (
                entries.map((e) => {
                  const isVoidedOrCancelled = e.status === 'cancelled' || e.status === 'voided';
                  return (
                    <tr
                      key={e.id}
                      onClick={() => setSelectedEntry(e)}
                      className={`hover:bg-slate-50/70 transition-colors cursor-pointer ${
                        isVoidedOrCancelled ? 'opacity-60 bg-slate-50/40 line-through' : ''
                      }`}
                    >
                      {/* Time */}
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                        <div className="font-bold text-slate-900">{e.timeStr}</div>
                        <div className="text-[9.5px] text-slate-400">{e.dateStr}</div>
                      </td>

                      {/* Type Badge */}
                      <td className="py-3 px-3 whitespace-nowrap">{getTypeBadge(e.type)}</td>

                      {/* Reference */}
                      <td className="py-3 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {e.reference}
                      </td>

                      {/* Description */}
                      <td className="py-3 px-4 text-slate-800 max-w-[280px] truncate" title={e.description}>
                        <div className="font-semibold truncate">{e.description}</div>
                        {e.metadata?.customerName && (
                          <span className="text-[10px] text-slate-400 block truncate">
                            Customer: {e.metadata.customerName}
                          </span>
                        )}
                        {e.metadata?.vendorName && (
                          <span className="text-[10px] text-slate-400 block truncate">
                            Vendor: {e.metadata.vendorName}
                          </span>
                        )}
                      </td>

                      {/* Payment Method */}
                      <td className="py-3 px-3 whitespace-nowrap">{getMethodBadge(e.method)}</td>

                      {/* Debit (Inflow) */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                        {e.debitPaise > 0 ? formatINR(e.debitPaise) : '—'}
                      </td>

                      {/* Credit (Outflow) */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-rose-700 whitespace-nowrap">
                        {e.creditPaise > 0 ? formatINR(e.creditPaise) : '—'}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span
                          className={`pill text-[10px] font-extrabold uppercase px-2 py-0.5 ${
                            e.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : e.status === 'refunded'
                              ? 'bg-amber-100 text-amber-800'
                              : e.status === 'pending'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {e.status}
                        </span>
                      </td>

                      {/* View Action */}
                      <td className="py-3 px-3 text-center whitespace-nowrap" onClick={(ev) => ev.stopPropagation()}>
                        <button
                          onClick={() => setSelectedEntry(e)}
                          className="btn btn-icon btn-ghost btn-sm text-slate-400 hover:text-slate-800"
                          title="View Transaction Details"
                        >
                          <Eye size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Authoritative Totals Footer */}
            {!loading && entries.length > 0 && (
              <tfoot>
                <tr className="border-t-2 font-bold text-xs" style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }}>
                  <td colSpan={5} className="py-3 px-4 text-right font-extrabold uppercase text-slate-700">
                    Period Movement Totals:
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-800 text-sm font-extrabold whitespace-nowrap">
                    +{formatINR(summary.totalDebitPaise)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-rose-800 text-sm font-extrabold whitespace-nowrap">
                    −{formatINR(summary.totalCreditPaise)}
                  </td>
                  <td colSpan={2} className="py-3 px-4 text-right font-mono font-extrabold text-slate-800 whitespace-nowrap">
                    Net: {summary.netMovementPaise >= 0 ? '+' : '−'}
                    {formatINR(Math.abs(summary.netMovementPaise))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* ── PAGINATION CONTROLS ── */}
        {!loading && totalPages > 1 && (
          <div className="p-3.5 border-t flex flex-col sm:flex-row justify-between items-center gap-3" style={{ borderColor: 'var(--line)' }}>
            <span className="text-[11px] text-slate-500 font-medium">
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)} of {totalCount} records
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="btn btn-secondary btn-sm text-xs px-2.5 py-1 disabled:opacity-40"
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <div className="flex items-center gap-1 px-2 font-mono text-xs font-bold text-slate-700">
                {page} / {totalPages}
              </div>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="btn btn-secondary btn-sm text-xs px-2.5 py-1 disabled:opacity-40"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── TRANSACTION DETAILS MODAL (Requirement 8) ── */}
      {selectedEntry && (
        <div className="scrim anim-fade z-[9900] flex items-center justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setSelectedEntry(null)} />
          <div
            className="relative card w-full max-w-lg p-6 anim-pop z-10 space-y-4"
            style={{
              background: 'var(--paper-2)',
              borderRadius: 22,
              boxShadow: 'var(--sh-3)',
              border: '1px solid var(--line)',
            }}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b pb-3.5" style={{ borderColor: 'var(--line)' }}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-lg">Transaction Details</span>
                  {getTypeBadge(selectedEntry.type)}
                </div>
                <span className="text-xs font-mono text-slate-500 font-bold block mt-0.5">
                  Ref: {selectedEntry.reference}
                </span>
              </div>
              <button
                onClick={() => setSelectedEntry(null)}
                className="btn btn-icon btn-sm btn-ghost text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            {/* Financial Amount Banner */}
            <div
              className={`p-4 rounded-xl border flex justify-between items-center ${
                selectedEntry.debitPaise > 0
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wide block">
                  {selectedEntry.debitPaise > 0 ? 'Debit (Liquid Inflow)' : 'Credit (Liquid Outflow)'}
                </span>
                <span className="text-2xl font-mono font-extrabold block mt-0.5">
                  {selectedEntry.debitPaise > 0
                    ? `+${formatINR(selectedEntry.debitPaise)}`
                    : `−${formatINR(selectedEntry.creditPaise)}`}
                </span>
              </div>
              <div>{getMethodBadge(selectedEntry.method)}</div>
            </div>

            {/* Detailed Properties Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-lg border" style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }}>
                <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Date &amp; Time</span>
                <span className="font-bold text-slate-800 block mt-0.5">
                  {selectedEntry.dateStr} · {selectedEntry.timeStr}
                </span>
              </div>

              <div className="p-2.5 rounded-lg border" style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }}>
                <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Origin / Source</span>
                <span className="font-bold text-slate-800 block mt-0.5">{selectedEntry.source}</span>
              </div>

              <div className="p-2.5 rounded-lg border" style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }}>
                <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Payment Status</span>
                <span className="font-bold text-slate-800 capitalize block mt-0.5">{selectedEntry.status}</span>
              </div>

              <div className="p-2.5 rounded-lg border" style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }}>
                <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Method</span>
                <span className="font-bold text-slate-800 uppercase block mt-0.5">{selectedEntry.method}</span>
              </div>

              {selectedEntry.metadata?.orderNumber && (
                <div className="p-2.5 rounded-lg border" style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }}>
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Related Order</span>
                  <span className="font-bold text-slate-800 block mt-0.5">
                    Order #{selectedEntry.metadata.orderNumber}
                  </span>
                </div>
              )}

              {selectedEntry.metadata?.tableName && (
                <div className="p-2.5 rounded-lg border" style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }}>
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Table / Station</span>
                  <span className="font-bold text-slate-800 block mt-0.5">
                    Table {selectedEntry.metadata.tableName}
                  </span>
                </div>
              )}

              {selectedEntry.metadata?.customerName && (
                <div className="p-2.5 rounded-lg border" style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }}>
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Customer</span>
                  <span className="font-bold text-slate-800 block mt-0.5">
                    {selectedEntry.metadata.customerName}
                    {selectedEntry.metadata?.customerPhone && ` (${selectedEntry.metadata.customerPhone})`}
                  </span>
                </div>
              )}

              {selectedEntry.metadata?.vendorName && (
                <div className="p-2.5 rounded-lg border" style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }}>
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Vendor</span>
                  <span className="font-bold text-slate-800 block mt-0.5">{selectedEntry.metadata.vendorName}</span>
                </div>
              )}

              {selectedEntry.metadata?.providerRef && (
                <div className="p-2.5 rounded-lg border col-span-2" style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }}>
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Payment Provider Reference</span>
                  <span className="font-mono text-slate-800 font-bold block mt-0.5">
                    {selectedEntry.metadata.providerRef}
                  </span>
                </div>
              )}
            </div>

            {/* Description / Particulars */}
            <div className="p-3 rounded-xl border text-xs" style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }}>
              <span className="text-[10px] font-extrabold text-slate-400 uppercase block mb-1">
                Particulars / Narrative
              </span>
              <p className="text-slate-800 leading-relaxed font-medium">{selectedEntry.description}</p>
            </div>

            {/* Accounting General Ledger Treatment */}
            {selectedEntry.metadata?.accountingDrCr && (
              <div className="p-3 rounded-xl border text-xs" style={{ background: '#FAF5FF', borderColor: '#E9D5FF', color: '#6B21A8' }}>
                <span className="text-[10px] font-extrabold uppercase block mb-0.5">
                  Accounting Ledger Impact
                </span>
                <p className="font-mono font-bold text-[11px]">{selectedEntry.metadata.accountingDrCr}</p>
              </div>
            )}

            {/* Close Button */}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedEntry(null)}
                className="btn btn-secondary text-xs px-5 py-2 font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
