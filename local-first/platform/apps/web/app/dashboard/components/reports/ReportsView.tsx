'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Download,
  Printer,
  RefreshCw,
  Filter,
  DollarSign,
  ShoppingBag,
  Receipt,
  CreditCard,
  Wallet,
  Users,
  Percent,
  RotateCcw,
  LayoutGrid,
  UtensilsCrossed,
  Archive,
  FileSpreadsheet,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import { MonthCalendarPicker } from './MonthCalendarPicker';

export interface ReportsViewProps {
  outlet: {
    brand: string;
    name: string;
    plan?: string;
    gstin?: string | null;
  };
  currentStaff: {
    id?: string | null;
    name?: string;
    role?: string;
    roles?: string[];
    permissions?: any;
    effectivePermissions?: string[];
  };
  isAdvanced?: boolean;
  initialTrend?: any[];
  initialTopItems?: any[];
  initialSalesGst?: any;
}

export type PeriodType = 'daily' | 'weekly' | 'monthly';

export type ReportType =
  | 'sales'
  | 'items'
  | 'gst'
  | 'payments'
  | 'expenses'
  | 'staff'
  | 'discounts'
  | 'refunds'
  | 'tables'
  | 'kot'
  | 'cash_drawer'
  | 'orders'
  | 'analytics'
  | 'forecast';

function formatINR(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(rupees);
}

function escCell(s: string | number) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function ReportsView({
  outlet,
  currentStaff,
  isAdvanced = false,
  initialTrend = [],
  initialTopItems = [],
  initialSalesGst = null,
}: ReportsViewProps) {
  // ── Period & Navigation State ──
  const [period, setPeriod] = useState<PeriodType>('daily');
  const [activeReport, setActiveReport] = useState<ReportType>('sales');

  // Today reference in local wall-clock
  const todayStr = useMemo(() => {
    const now = new Date();
    return now.toISOString().slice(0, 10);
  }, []);

  // Daily single date
  const [dailyDate, setDailyDate] = useState<string>(todayStr);

  // Weekly selection
  const [weekPreset, setWeekPreset] = useState<'current' | 'previous' | 'custom'>('current');
  const [weekStart, setWeekStart] = useState<string>('');
  const [weekEnd, setWeekEnd] = useState<string>('');

  // Monthly selection
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [monthStart, setMonthStart] = useState<string>('');
  const [monthEnd, setMonthEnd] = useState<string>('');
  const [isCustomMonthlyRange, setIsCustomMonthlyRange] = useState<boolean>(false);
  const [customMonthStart, setCustomMonthStart] = useState<string>('');
  const [customMonthEnd, setCustomMonthEnd] = useState<string>('');

  // Filters
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [selectedOrderType, setSelectedOrderType] = useState<string>('');

  // Loaded data
  const [loading, setLoading] = useState<boolean>(false);
  const [reportData, setReportData] = useState<any>(null);
  const [reportMeta, setReportMeta] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize weekly range
  useEffect(() => {
    const now = new Date();
    const day = now.getDay();
    // Monday as start of week: day = 0 (Sun) -> diff = -6, day = 1 (Mon) -> diff = 0
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const mStr = monday.toISOString().slice(0, 10);
    const sStr = sunday.toISOString().slice(0, 10);
    setWeekStart(mStr);
    setWeekEnd(sStr);
  }, []);

  // Initialize monthly range
  useEffect(() => {
    const y = selectedYear;
    const m = selectedMonth;
    const daysInM = new Date(y, m, 0).getDate();
    const mm = String(m).padStart(2, '0');
    setMonthStart(`${y}-${mm}-01`);
    setMonthEnd(`${y}-${mm}-${String(daysInM).padStart(2, '0')}`);
  }, [selectedYear, selectedMonth]);

  // Compute effective start and end dates based on current period
  const { effectiveStart, effectiveEnd } = useMemo(() => {
    if (period === 'daily') {
      return { effectiveStart: dailyDate, effectiveEnd: dailyDate };
    }
    if (period === 'weekly') {
      return { effectiveStart: weekStart || todayStr, effectiveEnd: weekEnd || todayStr };
    }
    if (isCustomMonthlyRange && customMonthStart && customMonthEnd) {
      return { effectiveStart: customMonthStart, effectiveEnd: customMonthEnd };
    }
    return { effectiveStart: monthStart || todayStr, effectiveEnd: monthEnd || todayStr };
  }, [period, dailyDate, weekStart, weekEnd, isCustomMonthlyRange, customMonthStart, customMonthEnd, monthStart, monthEnd, todayStr]);

  // ── Fetch Report from API ──
  const fetchReport = useCallback(async () => {
    if (activeReport === 'analytics' || activeReport === 'forecast') return;
    setLoading(true);
    setErrorMsg(null);

    const params = new URLSearchParams({
      period,
      report: activeReport,
      startDate: effectiveStart,
      endDate: effectiveEnd,
    });

    if (selectedStaffId) params.set('staffId', selectedStaffId);
    if (selectedPaymentMethod) params.set('paymentMethod', selectedPaymentMethod);
    if (selectedCategory) params.set('category', selectedCategory);
    if (selectedTableId) params.set('tableId', selectedTableId);
    if (selectedOrderType) params.set('orderType', selectedOrderType);

    try {
      const res = await fetch(`/api/dashboard/reports?${params.toString()}`);
      const json = await res.json();
      if (res.ok && json.ok) {
        setReportData(json.data);
        setReportMeta(json.meta);
      } else {
        setErrorMsg(json.message || 'Failed to load report data');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error fetching report');
    } finally {
      setLoading(false);
    }
  }, [period, activeReport, effectiveStart, effectiveEnd, selectedStaffId, selectedPaymentMethod, selectedCategory, selectedTableId, selectedOrderType]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // ── Weekly Navigation Helpers ──
  const handleShiftWeek = (direction: 'prev' | 'next') => {
    const curStart = new Date(`${weekStart}T00:00:00Z`);
    const offset = direction === 'prev' ? -7 : 7;
    curStart.setUTCDate(curStart.getUTCDate() + offset);
    const curEnd = new Date(curStart);
    curEnd.setUTCDate(curStart.getUTCDate() + 6);
    setWeekStart(curStart.toISOString().slice(0, 10));
    setWeekEnd(curEnd.toISOString().slice(0, 10));
    setWeekPreset('custom');
  };

  const handleSelectWeekPreset = (preset: 'current' | 'previous') => {
    setWeekPreset(preset);
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);

    if (preset === 'previous') {
      monday.setDate(monday.getDate() - 7);
    }

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    setWeekStart(monday.toISOString().slice(0, 10));
    setWeekEnd(sunday.toISOString().slice(0, 10));
  };

  // ── Daily Navigation Helpers ──
  const handleShiftDay = (direction: 'prev' | 'next') => {
    const d = new Date(`${dailyDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + (direction === 'prev' ? -1 : 1));
    setDailyDate(d.toISOString().slice(0, 10));
  };

  // ── Export Implementations ──
  const reportFileBase = (name: string) =>
    `${outlet.brand}-${period}-${name}-${effectiveStart}-to-${effectiveEnd}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const exportExcel = (name: string, title: string, headers: string[], rows: (string | number)[][]) => {
    const thead = `<tr>${headers.map((h) => `<th>${escCell(h)}</th>`).join('')}</tr>`;
    const tbody = rows.map((r) => `<tr>${r.map((c) => `<td>${escCell(c)}</td>`).join('')}</tr>`).join('');
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"/><style>td,th{border:1px solid #ccc;padding:5px 8px;text-align:left} th{background:#f3e8d2;font-weight:bold;color:#2a1607}</style></head><body><h3>${escCell(outlet.brand)} — ${escCell(title)}</h3><p>Period: ${escCell(period.toUpperCase())} (${escCell(effectiveStart)} to ${escCell(effectiveEnd)})</p><table>${thead}${tbody}</table></body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${reportFileBase(name)}.xls`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };

  const exportPdf = (title: string, headers: string[], rows: (string | number)[][]) => {
    const w = window.open('', '_blank', 'width=840,height=900');
    if (!w) return;
    const close = '<' + '/script>';
    const thead = `<tr>${headers.map((h) => `<th>${escCell(h)}</th>`).join('')}</tr>`;
    const tbody = rows.map((r) => `<tr>${r.map((c, i) => `<td class="${i === 0 ? 'l' : ''}">${escCell(c)}</td>`).join('')}</tr>`).join('');
    w.document.write(`<html><head><title>${escCell(title)}</title><style>
      *{font-family:ui-sans-serif,system-ui,sans-serif;color:#1e120a;box-sizing:border-box}
      body{padding:28px;max-width:800px;margin:0 auto}
      h1{font-size:22px;margin:0 0 4px}
      .meta{color:#6b5b4d;font-size:12px;margin-bottom:18px}
      table{width:100%;border-collapse:collapse;font-size:12px;margin-top:10px}
      th,td{border-bottom:1px solid #ddd;padding:6px 8px;text-align:right} th:first-child,td.l{text-align:left} th{background:#f7efe2;font-weight:bold}
    </style></head><body>
      <h1>${escCell(outlet.brand)}</h1>
      <div class="meta">${escCell(title)} · ${period.toUpperCase()} (${escCell(effectiveStart)} → ${escCell(effectiveEnd)}) · Printed ${new Date().toLocaleString('en-IN')}</div>
      <table><thead>${thead}</thead><tbody>${tbody}</tbody></table>
      <script>window.onload=function(){window.print()}${close}</body></html>`);
    w.document.close();
  };

  const handlePrint = () => {
    window.print();
  };

  // ── Report categories ──
  const reportCategories: { key: ReportType; label: string; icon: any }[] = [
    { key: 'sales', label: 'Sales', icon: DollarSign },
    { key: 'items', label: 'Items', icon: ShoppingBag },
    { key: 'gst', label: 'GST / Tax', icon: Receipt },
    { key: 'payments', label: 'Payments', icon: CreditCard },
    { key: 'expenses', label: 'Expenses', icon: Wallet },
    { key: 'staff', label: 'Staff', icon: Users },
    { key: 'discounts', label: 'Discounts', icon: Percent },
    { key: 'refunds', label: 'Refunds', icon: RotateCcw },
    { key: 'tables', label: 'Tables', icon: LayoutGrid },
    { key: 'kot', label: 'KOT', icon: UtensilsCrossed },
    { key: 'cash_drawer', label: 'Cash Drawer', icon: Archive },
    { key: 'orders', label: 'Orders', icon: FileSpreadsheet },
    ...(isAdvanced
      ? [
          { key: 'analytics' as ReportType, label: 'Analytics 📊', icon: TrendingUp },
          { key: 'forecast' as ReportType, label: 'Forecast', icon: TrendingUp },
        ]
      : []),
  ];

  // Derive Table Export Headers & Rows based on current report data
  const exportProps = useMemo(() => {
    if (!reportData) return { name: activeReport, title: `${activeReport.toUpperCase()} Report`, headers: [], rows: [] };

    switch (activeReport) {
      case 'sales': {
        const headers = ['Date', 'Orders', 'Gross Sales', 'Discount', 'Tax', 'Net Sales', 'Refunds'];
        const rows = (reportData.ledger || []).map((r: any) => [
          r.label,
          r.orders,
          formatINR(r.grossSalesPaise),
          formatINR(r.discountPaise),
          formatINR(r.taxPaise),
          formatINR(r.netSalesPaise),
          formatINR(r.refundsPaise),
        ]);
        return { name: 'sales-report', title: 'Sales Report', headers, rows };
      }
      case 'items': {
        const headers = ['Product Name', 'Category', 'Quantity Sold', 'Gross Revenue', 'Average Price', 'Share %'];
        const rows = (reportData.items || []).map((i: any) => [
          i.name,
          i.category,
          i.qty,
          formatINR(i.revenuePaise),
          formatINR(i.avgPricePaise),
          `${i.sharePct}%`,
        ]);
        return { name: 'items-report', title: 'Items Sales Report', headers, rows };
      }
      case 'gst': {
        const headers = ['GST Slab', 'Taxable Amount', 'CGST', 'SGST', 'IGST', 'Total Tax', 'Revenue'];
        const rows = (reportData.byRate || []).map((r: any) => [
          r.slab,
          formatINR(r.taxablePaise),
          formatINR(r.cgstPaise),
          formatINR(r.sgstPaise),
          formatINR(r.igstPaise),
          formatINR(r.totalTaxPaise),
          formatINR(r.revenuePaise),
        ]);
        return { name: 'gst-report', title: 'GST & Tax Report', headers, rows };
      }
      case 'payments': {
        const headers = ['Payment Method', 'Transactions', 'Gross Collection', 'Refunds', 'Net Collection', 'Share %'];
        const rows = (reportData.methods || []).map((m: any) => [
          m.label,
          m.count,
          formatINR(m.grossPaise),
          formatINR(m.refundPaise),
          formatINR(m.netPaise),
          `${m.sharePct}%`,
        ]);
        return { name: 'payments-report', title: 'Payments Report', headers, rows };
      }
      case 'expenses': {
        const headers = ['Date', 'Category', 'Vendor', 'Amount', 'GST', 'Method', 'Status', 'Reference'];
        const rows = (reportData.expenses || []).map((e: any) => [
          e.date,
          e.category,
          e.vendor,
          formatINR(e.amountPaise),
          formatINR(e.gstPaise),
          e.method.toUpperCase(),
          e.status.toUpperCase(),
          e.reference,
        ]);
        return { name: 'expenses-report', title: 'Expense Report', headers, rows };
      }
      case 'staff': {
        const headers = ['Staff Name', 'Role', 'Orders Handled', 'Gross Sales', 'Net Sales', 'Discounts Given', 'Refunds', 'AOV'];
        const rows = (reportData.staff || []).map((s: any) => [
          s.name,
          s.role,
          s.orders,
          formatINR(s.grossSalesPaise),
          formatINR(s.netSalesPaise),
          formatINR(s.discountsPaise),
          formatINR(s.refundsPaise),
          formatINR(s.aovPaise),
        ]);
        return { name: 'staff-report', title: 'Staff Performance Report', headers, rows };
      }
      case 'discounts': {
        const headers = ['Order #', 'Date', 'Type', 'Staff', 'Subtotal', 'Discount', 'Final Total'];
        const rows = (reportData.orders || []).map((o: any) => [
          `#${o.number}`,
          o.date,
          o.type,
          o.staffName,
          formatINR(o.subtotalPaise),
          formatINR(o.discountPaise),
          formatINR(o.totalPaise),
        ]);
        return { name: 'discounts-report', title: 'Discount Report', headers, rows };
      }
      case 'refunds': {
        const headers = ['Date', 'Order #', 'Amount', 'Payment Method', 'Reason', 'Approved By'];
        const rows = (reportData.refunds || []).map((r: any) => [
          r.date,
          `#${r.orderNumber}`,
          formatINR(r.amountPaise),
          r.method,
          r.reason,
          r.approvedByName,
        ]);
        return { name: 'refunds-report', title: 'Refunds Report', headers, rows };
      }
      case 'tables': {
        const headers = ['Table', 'Seats', 'Total Orders', 'Total Sales', 'Average Order Value'];
        const rows = (reportData.tables || []).map((t: any) => [
          t.label,
          t.seats,
          t.orders,
          formatINR(t.salesPaise),
          formatINR(t.aovPaise),
        ]);
        return { name: 'tables-report', title: 'Tables Report', headers, rows };
      }
      case 'kot': {
        const headers = ['Kitchen Station', 'Total KOTs', 'Completed / Served', 'Cancelled'];
        const rows = (reportData.byStation || []).map((s: any) => [
          s.station,
          s.total,
          s.completed,
          s.cancelled,
        ]);
        return { name: 'kot-report', title: 'KOT & Kitchen Report', headers, rows };
      }
      case 'cash_drawer': {
        const headers = ['Business Date', 'Status', 'Opening Cash', 'Cash Sales', 'Cash Expenses', 'Expected Cash', 'Actual Cash', 'Variance'];
        const rows = (reportData.closings || []).map((c: any) => [
          c.businessDate,
          c.status.toUpperCase(),
          formatINR(c.openingCashPaise),
          formatINR(c.cashSalesPaise),
          formatINR(c.cashExpensesPaise),
          formatINR(c.expectedCashPaise),
          formatINR(c.actualCashPaise),
          formatINR(c.cashVariancePaise),
        ]);
        return { name: 'cash-drawer-report', title: 'Cash Drawer Report', headers, rows };
      }
      case 'orders': {
        const headers = ['Order #', 'Date', 'Type', 'Status', 'Table', 'Staff', 'Subtotal', 'Discount', 'Tax', 'Total'];
        const rows = (reportData.orders || []).map((o: any) => [
          `#${o.number}`,
          o.date,
          o.type,
          o.status,
          o.tableLabel,
          o.staffName,
          formatINR(o.subtotalPaise),
          formatINR(o.discountPaise),
          formatINR(o.taxPaise),
          formatINR(o.totalPaise),
        ]);
        return { name: 'orders-report', title: 'Order Summary Report', headers, rows };
      }
      default:
        return { name: activeReport, title: 'Report', headers: [], rows: [] };
    }
  }, [reportData, activeReport]);

  return (
    <div className="flex flex-col gap-4">
      {/* ── Top Bar: Title, Financial Year Badge & Action Exports ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl border" style={{ background: 'var(--paper-2)', borderColor: 'var(--line)' }}>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold font-display tracking-tight text-stone-900 dark:text-stone-100">
              Restaurant Reports
            </h3>
            {reportMeta?.activeFinancialYear && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
                {reportMeta.activeFinancialYear.name}
              </span>
            )}
          </div>
          <p className="text-xs text-ink-3 mt-0.5">
            Audit-grade reporting across {period.toUpperCase()} period · {effectiveStart} to {effectiveEnd}
          </p>
        </div>

        {/* Global Action Export Bar */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchReport}
            disabled={loading}
            className="btn btn-sm inline-flex items-center gap-1.5"
            style={{ background: 'var(--paper-3)', border: '1px solid var(--line)' }}
            title="Refresh Data"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => exportExcel(exportProps.name, exportProps.title, exportProps.headers, exportProps.rows)}
            disabled={loading || !exportProps.rows.length}
            className="btn btn-sm inline-flex items-center gap-1.5 disabled:opacity-50"
            style={{ background: 'var(--paper-3)', border: '1px solid var(--line)' }}
          >
            <Download size={13} />
            <span>Excel</span>
          </button>

          <button
            type="button"
            onClick={() => exportPdf(exportProps.title, exportProps.headers, exportProps.rows)}
            disabled={loading || !exportProps.rows.length}
            className="btn btn-sm inline-flex items-center gap-1.5 disabled:opacity-50"
            style={{ background: 'var(--paper-3)', border: '1px solid var(--line)' }}
          >
            <Download size={13} />
            <span>PDF</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="btn btn-sm inline-flex items-center gap-1.5"
            style={{ background: 'var(--paper-3)', border: '1px solid var(--line)' }}
          >
            <Printer size={13} />
            <span className="hidden sm:inline">Print</span>
          </button>
        </div>
      </div>

      {/* ── 1. MAIN REPORT PERIOD SELECTOR [ Daily ] [ Weekly ] [ Monthly ] ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl border" style={{ background: 'var(--paper-2)', borderColor: 'var(--line)' }}>
        {/* Period Switcher */}
        <div className="flex items-center p-1 rounded-xl border bg-black/5 dark:bg-white/5" style={{ borderColor: 'var(--line)' }}>
          {(['daily', 'weekly', 'monthly'] as PeriodType[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`px-5 py-2 rounded-lg text-xs font-bold transition capitalize ${
                period === p ? 'shadow-sm' : 'text-ink-3 hover:text-ink-1'
              }`}
              style={
                period === p
                  ? { background: 'var(--turmeric)', color: '#2A1607' }
                  : { background: 'transparent' }
              }
            >
              {p}
            </button>
          ))}
        </div>

        {/* ── Period-Specific Date Controls ── */}
        <div className="flex flex-wrap items-center gap-2">
          {/* DAILY Controls */}
          {period === 'daily' && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleShiftDay('prev')}
                className="p-1.5 rounded-lg border hover:bg-black/5 dark:hover:bg-white/5"
                style={{ borderColor: 'var(--line)', background: 'var(--paper-3)' }}
                title="Previous Day"
              >
                <ChevronLeft size={16} />
              </button>

              <input
                type="date"
                value={dailyDate}
                onChange={(e) => setDailyDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl border text-xs font-bold"
                style={{ background: 'var(--paper-3)', borderColor: 'var(--line)', color: 'var(--ink)' }}
              />

              <button
                type="button"
                onClick={() => handleShiftDay('next')}
                className="p-1.5 rounded-lg border hover:bg-black/5 dark:hover:bg-white/5"
                style={{ borderColor: 'var(--line)', background: 'var(--paper-3)' }}
                title="Next Day"
              >
                <ChevronRight size={16} />
              </button>

              <button
                type="button"
                onClick={() => setDailyDate(todayStr)}
                className="px-2.5 py-1.5 rounded-xl text-xs font-medium border hover:bg-black/5 dark:hover:bg-white/5"
                style={{ borderColor: 'var(--line)', background: 'var(--paper-3)' }}
              >
                Today
              </button>
            </div>
          )}

          {/* WEEKLY Controls */}
          {period === 'weekly' && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-xl p-1 border text-xs" style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }}>
                <button
                  type="button"
                  onClick={() => handleSelectWeekPreset('current')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    weekPreset === 'current' ? 'bg-amber-600 text-white' : 'text-ink-3'
                  }`}
                >
                  Current Week
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectWeekPreset('previous')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    weekPreset === 'previous' ? 'bg-amber-600 text-white' : 'text-ink-3'
                  }`}
                >
                  Previous Week
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleShiftWeek('prev')}
                  className="p-1.5 rounded-lg border hover:bg-black/5 dark:hover:bg-white/5"
                  style={{ borderColor: 'var(--line)', background: 'var(--paper-3)' }}
                  title="Previous 7 Days"
                >
                  <ChevronLeft size={16} />
                </button>

                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold" style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }}>
                  <span>{weekStart}</span>
                  <span className="text-ink-3">→</span>
                  <span>{weekEnd}</span>
                </div>

                <button
                  type="button"
                  onClick={() => handleShiftWeek('next')}
                  className="p-1.5 rounded-lg border hover:bg-black/5 dark:hover:bg-white/5"
                  style={{ borderColor: 'var(--line)', background: 'var(--paper-3)' }}
                  title="Next 7 Days"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* MONTHLY Controls */}
          {period === 'monthly' && (
            <MonthCalendarPicker
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
              onSelectMonthYear={(y, m, s, e) => {
                setSelectedYear(y);
                setSelectedMonth(m);
                setMonthStart(s);
                setMonthEnd(e);
                setIsCustomMonthlyRange(false);
              }}
              customStartDate={customMonthStart}
              customEndDate={customMonthEnd}
              onSelectCustomRange={(s, e) => {
                setCustomMonthStart(s);
                setCustomMonthEnd(e);
                setIsCustomMonthlyRange(true);
              }}
              isCustomRange={isCustomMonthlyRange}
              onToggleCustomRange={(c) => setIsCustomMonthlyRange(c)}
            />
          )}
        </div>
      </div>

      {/* ── 2. REPORT CATEGORY NAVIGATION (12 Reports) ── */}
      <div className="flex justify-start pb-1 overflow-x-auto no-scrollbar w-full">
        <div className="flex flex-nowrap gap-1.5 p-1 rounded-2xl border w-fit" style={{ background: 'var(--paper-2)', borderColor: 'var(--line)' }} role="tablist">
          {reportCategories.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeReport === tab.key;
            return (
              <button
                key={tab.key}
                role="tab"
                aria-selected={isSelected}
                onClick={() => setActiveReport(tab.key)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                style={
                  isSelected
                    ? { background: 'var(--turmeric)', color: '#2A1607', boxShadow: 'var(--sh-1)' }
                    : { color: 'var(--ink-2)', background: 'transparent' }
                }
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 3. DYNAMIC FILTER BAR (Staff, Payment Method, Category, Table, Type) ── */}
      {['sales', 'items', 'payments', 'expenses', 'staff', 'discounts', 'tables', 'orders'].includes(activeReport) && (
        <div className="flex flex-wrap items-center gap-2.5 p-3 rounded-xl border text-xs" style={{ background: 'var(--paper-2)', borderColor: 'var(--line)' }}>
          <div className="flex items-center gap-1 text-ink-3 font-semibold mr-1">
            <Filter size={13} />
            <span>Filters:</span>
          </div>

          {/* Staff Filter */}
          {['sales', 'staff', 'discounts', 'orders'].includes(activeReport) && (
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="px-2.5 py-1 rounded-lg border text-xs"
              style={{ background: 'var(--paper-3)', borderColor: 'var(--line)', color: 'var(--ink)' }}
            >
              <option value="">All Staff</option>
              {(reportMeta?.staffMembers || []).map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.role})
                </option>
              ))}
            </select>
          )}

          {/* Payment Method Filter */}
          {['sales', 'payments'].includes(activeReport) && (
            <select
              value={selectedPaymentMethod}
              onChange={(e) => setSelectedPaymentMethod(e.target.value)}
              className="px-2.5 py-1 rounded-lg border text-xs"
              style={{ background: 'var(--paper-3)', borderColor: 'var(--line)', color: 'var(--ink)' }}
            >
              <option value="">All Payment Methods</option>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="other">Other</option>
            </select>
          )}

          {/* Category Filter */}
          {activeReport === 'items' && (
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-2.5 py-1 rounded-lg border text-xs"
              style={{ background: 'var(--paper-3)', borderColor: 'var(--line)', color: 'var(--ink)' }}
            >
              <option value="">All Categories</option>
              {(reportMeta?.categories || []).map((c: any) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          {/* Table Filter */}
          {['tables', 'orders'].includes(activeReport) && (
            <select
              value={selectedTableId}
              onChange={(e) => setSelectedTableId(e.target.value)}
              className="px-2.5 py-1 rounded-lg border text-xs"
              style={{ background: 'var(--paper-3)', borderColor: 'var(--line)', color: 'var(--ink)' }}
            >
              <option value="">All Tables</option>
              {(reportMeta?.tables || []).map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.label} ({t.seats} seats)
                </option>
              ))}
            </select>
          )}

          {/* Order Type Filter */}
          {['sales', 'discounts', 'orders'].includes(activeReport) && (
            <select
              value={selectedOrderType}
              onChange={(e) => setSelectedOrderType(e.target.value)}
              className="px-2.5 py-1 rounded-lg border text-xs"
              style={{ background: 'var(--paper-3)', borderColor: 'var(--line)', color: 'var(--ink)' }}
            >
              <option value="">All Order Types</option>
              <option value="dine_in">Dine In</option>
              <option value="takeaway">Takeaway</option>
            </select>
          )}

          {(selectedStaffId || selectedPaymentMethod || selectedCategory || selectedTableId || selectedOrderType) && (
            <button
              type="button"
              onClick={() => {
                setSelectedStaffId('');
                setSelectedPaymentMethod('');
                setSelectedCategory('');
                setSelectedTableId('');
                setSelectedOrderType('');
              }}
              className="text-[11px] font-bold text-amber-700 hover:underline ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>
      )}

      {/* ── Error Banner ── */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 text-red-800 border border-red-200 text-xs">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* ── 4. REPORT CONTENT DISPLAY ── */}
      {loading ? (
        <div className="p-12 text-center text-ink-3 text-sm card">
          <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-amber-600" />
          Loading {period} {activeReport} report data…
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* ========================================================================= */}
          {/* 1. SALES REPORT VIEW */}
          {/* ========================================================================= */}
          {activeReport === 'sales' && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Total Orders</span>
                  <span className="block text-xl font-bold font-mono mt-1">{reportData?.summary?.totalOrders ?? 0}</span>
                </div>
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Gross Sales</span>
                  <span className="block text-xl font-bold font-mono mt-1 text-emerald-700 dark:text-emerald-400">
                    {formatINR(reportData?.summary?.grossSalesPaise ?? 0)}
                  </span>
                </div>
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Discounts</span>
                  <span className="block text-xl font-bold font-mono mt-1 text-red-700 dark:text-red-400">
                    {formatINR(reportData?.summary?.discountPaise ?? 0)}
                  </span>
                </div>
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Tax</span>
                  <span className="block text-xl font-bold font-mono mt-1">
                    {formatINR(reportData?.summary?.taxPaise ?? 0)}
                  </span>
                </div>
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Net Sales</span>
                  <span className="block text-xl font-bold font-mono mt-1 text-amber-700 dark:text-amber-400">
                    {formatINR(reportData?.summary?.netSalesPaise ?? 0)}
                  </span>
                </div>
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Refunds</span>
                  <span className="block text-xl font-bold font-mono mt-1 text-stone-600">
                    {formatINR(reportData?.summary?.refundsPaise ?? 0)}
                  </span>
                </div>
              </div>

              {/* Sales Ledger Table */}
              <section className="card p-5">
                <h4 className="font-bold text-sm mb-3">
                  {period === 'daily' ? 'Daily Sales Ledger' : period === 'weekly' ? 'Weekly Sales Breakdown' : 'Monthly Sales Ledger'}
                </h4>
                <div className="overflow-x-auto">
                  <table className="rtable w-full text-sm border-collapse text-left">
                    <thead>
                      <tr className="border-b" style={{ borderColor: 'var(--line)' }}>
                        <th className="pb-2">Date</th>
                        <th className="pb-2 text-right">Orders</th>
                        <th className="pb-2 text-right">Gross Sales</th>
                        <th className="pb-2 text-right">Discount</th>
                        <th className="pb-2 text-right">Tax</th>
                        <th className="pb-2 text-right">Net Sales</th>
                        <th className="pb-2 text-right">Refunds</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(reportData?.ledger || []).map((row: any, idx: number) => (
                        <tr key={idx} className="border-b hover:bg-black/5 dark:hover:bg-white/5 transition" style={{ borderColor: 'var(--line-2)' }}>
                          <td className="py-2.5 font-medium">{row.label}</td>
                          <td className="py-2.5 font-mono text-right">{row.orders}</td>
                          <td className="py-2.5 font-mono text-right">{formatINR(row.grossSalesPaise)}</td>
                          <td className="py-2.5 font-mono text-right text-red-600">{formatINR(row.discountPaise)}</td>
                          <td className="py-2.5 font-mono text-right">{formatINR(row.taxPaise)}</td>
                          <td className="py-2.5 font-mono text-right font-bold text-amber-700 dark:text-amber-400">{formatINR(row.netSalesPaise)}</td>
                          <td className="py-2.5 font-mono text-right text-stone-500">{formatINR(row.refundsPaise)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="font-bold border-t-2" style={{ borderColor: 'var(--line)', background: 'var(--paper-3)' }}>
                        <td className="py-2.5">Total</td>
                        <td className="py-2.5 font-mono text-right">{reportData?.summary?.totalOrders ?? 0}</td>
                        <td className="py-2.5 font-mono text-right text-emerald-700">{formatINR(reportData?.summary?.grossSalesPaise ?? 0)}</td>
                        <td className="py-2.5 font-mono text-right text-red-600">{formatINR(reportData?.summary?.discountPaise ?? 0)}</td>
                        <td className="py-2.5 font-mono text-right">{formatINR(reportData?.summary?.taxPaise ?? 0)}</td>
                        <td className="py-2.5 font-mono text-right text-amber-700 dark:text-amber-400">{formatINR(reportData?.summary?.netSalesPaise ?? 0)}</td>
                        <td className="py-2.5 font-mono text-right text-stone-500">{formatINR(reportData?.summary?.refundsPaise ?? 0)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>
            </>
          )}

          {/* ========================================================================= */}
          {/* 2. ITEMS / TOP ITEMS REPORT VIEW */}
          {/* ========================================================================= */}
          {activeReport === 'items' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Total Units Sold</span>
                  <span className="block text-xl font-bold font-mono mt-1">{reportData?.summary?.totalItemsSold ?? 0}</span>
                </div>
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Total Item Revenue</span>
                  <span className="block text-xl font-bold font-mono mt-1 text-emerald-700 dark:text-emerald-400">
                    {formatINR(reportData?.summary?.totalRevenuePaise ?? 0)}
                  </span>
                </div>
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Distinct Items Sold</span>
                  <span className="block text-xl font-bold font-mono mt-1">{reportData?.summary?.uniqueItemCount ?? 0}</span>
                </div>
              </div>

              <section className="card p-5">
                <h4 className="font-bold text-sm mb-3">Top Selling Products ({period.toUpperCase()})</h4>
                <div className="overflow-x-auto">
                  <table className="rtable w-full text-sm border-collapse text-left">
                    <thead>
                      <tr className="border-b" style={{ borderColor: 'var(--line)' }}>
                        <th className="pb-2">Product Name</th>
                        <th className="pb-2">Category</th>
                        <th className="pb-2 text-right">Quantity Sold</th>
                        <th className="pb-2 text-right">Average Price</th>
                        <th className="pb-2 text-right">Gross Revenue</th>
                        <th className="pb-2 text-right">Share %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(reportData?.items || []).map((item: any, idx: number) => (
                        <tr key={idx} className="border-b hover:bg-black/5 dark:hover:bg-white/5 transition" style={{ borderColor: 'var(--line-2)' }}>
                          <td className="py-2.5 font-bold">{item.name}</td>
                          <td className="py-2.5 text-ink-3">{item.category}</td>
                          <td className="py-2.5 font-mono text-right">{item.qty}</td>
                          <td className="py-2.5 font-mono text-right">{formatINR(item.avgPricePaise)}</td>
                          <td className="py-2.5 font-mono text-right font-bold">{formatINR(item.revenuePaise)}</td>
                          <td className="py-2.5 font-mono text-right text-amber-700">{item.sharePct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {/* ========================================================================= */}
          {/* 3. GST / TAX REPORT VIEW */}
          {/* ========================================================================= */}
          {activeReport === 'gst' && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Total Tax Collected</span>
                  <span className="block text-xl font-bold font-mono mt-1 text-amber-700 dark:text-amber-400">
                    {formatINR(reportData?.summary?.totalTaxPaise ?? 0)}
                  </span>
                </div>
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Taxable Sales</span>
                  <span className="block text-xl font-bold font-mono mt-1">{formatINR(reportData?.summary?.taxableSalesPaise ?? 0)}</span>
                </div>
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Non-Taxable / Exempt Sales</span>
                  <span className="block text-xl font-bold font-mono mt-1">{formatINR(reportData?.summary?.nonTaxableSalesPaise ?? 0)}</span>
                </div>
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Effective Tax Rate</span>
                  <span className="block text-xl font-bold font-mono mt-1">{reportData?.summary?.effectiveTaxRate ?? 0}%</span>
                </div>
              </div>

              <section className="card p-5">
                <h4 className="font-bold text-sm mb-3">GST Breakdown by Rate Slab</h4>
                <div className="overflow-x-auto">
                  <table className="rtable w-full text-sm border-collapse text-left">
                    <thead>
                      <tr className="border-b" style={{ borderColor: 'var(--line)' }}>
                        <th className="pb-2">GST Slab</th>
                        <th className="pb-2 text-right">Taxable Amount</th>
                        <th className="pb-2 text-right">CGST</th>
                        <th className="pb-2 text-right">SGST</th>
                        <th className="pb-2 text-right">IGST</th>
                        <th className="pb-2 text-right">Total Tax</th>
                        <th className="pb-2 text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(reportData?.byRate || []).map((slab: any, idx: number) => (
                        <tr key={idx} className="border-b" style={{ borderColor: 'var(--line-2)' }}>
                          <td className="py-2.5 font-bold">{slab.slab}</td>
                          <td className="py-2.5 font-mono text-right">{formatINR(slab.taxablePaise)}</td>
                          <td className="py-2.5 font-mono text-right">{formatINR(slab.cgstPaise)}</td>
                          <td className="py-2.5 font-mono text-right">{formatINR(slab.sgstPaise)}</td>
                          <td className="py-2.5 font-mono text-right">{formatINR(slab.igstPaise)}</td>
                          <td className="py-2.5 font-mono text-right font-bold text-amber-700">{formatINR(slab.totalTaxPaise)}</td>
                          <td className="py-2.5 font-mono text-right">{formatINR(slab.revenuePaise)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {/* ========================================================================= */}
          {/* 4. PAYMENTS REPORT VIEW */}
          {/* ========================================================================= */}
          {activeReport === 'payments' && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Total Collection</span>
                  <span className="block text-xl font-bold font-mono mt-1 text-emerald-700">
                    {formatINR(reportData?.summary?.totalCollectionPaise ?? 0)}
                  </span>
                </div>
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Cash Collection</span>
                  <span className="block text-xl font-bold font-mono mt-1">{formatINR(reportData?.summary?.cashCollectionPaise ?? 0)}</span>
                </div>
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">UPI Collection</span>
                  <span className="block text-xl font-bold font-mono mt-1 text-amber-700">{formatINR(reportData?.summary?.upiCollectionPaise ?? 0)}</span>
                </div>
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Total Transactions</span>
                  <span className="block text-xl font-bold font-mono mt-1">{reportData?.summary?.totalTransactions ?? 0}</span>
                </div>
              </div>

              <section className="card p-5">
                <h4 className="font-bold text-sm mb-3">Payment Method Breakdown</h4>
                <div className="overflow-x-auto">
                  <table className="rtable w-full text-sm border-collapse text-left">
                    <thead>
                      <tr className="border-b" style={{ borderColor: 'var(--line)' }}>
                        <th className="pb-2">Payment Method</th>
                        <th className="pb-2 text-right">Transactions</th>
                        <th className="pb-2 text-right">Gross Collection</th>
                        <th className="pb-2 text-right">Refunds</th>
                        <th className="pb-2 text-right">Net Collection</th>
                        <th className="pb-2 text-right">Share %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(reportData?.methods || []).map((m: any, idx: number) => (
                        <tr key={idx} className="border-b" style={{ borderColor: 'var(--line-2)' }}>
                          <td className="py-2.5 font-bold">{m.label}</td>
                          <td className="py-2.5 font-mono text-right">{m.count}</td>
                          <td className="py-2.5 font-mono text-right">{formatINR(m.grossPaise)}</td>
                          <td className="py-2.5 font-mono text-right text-red-600">{formatINR(m.refundPaise)}</td>
                          <td className="py-2.5 font-mono text-right font-bold text-emerald-700">{formatINR(m.netPaise)}</td>
                          <td className="py-2.5 font-mono text-right text-amber-700">{m.sharePct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {/* ========================================================================= */}
          {/* 5. EXPENSES REPORT VIEW */}
          {/* ========================================================================= */}
          {activeReport === 'expenses' && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Total Expenses</span>
                  <span className="block text-xl font-bold font-mono mt-1 text-red-700">
                    {formatINR(reportData?.summary?.totalExpensesPaise ?? 0)}
                  </span>
                </div>
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Cash Expenses</span>
                  <span className="block text-xl font-bold font-mono mt-1">{formatINR(reportData?.summary?.cashExpensesPaise ?? 0)}</span>
                </div>
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Bank/UPI Expenses</span>
                  <span className="block text-xl font-bold font-mono mt-1">{formatINR(reportData?.summary?.bankExpensesPaise ?? 0)}</span>
                </div>
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Expense Entries</span>
                  <span className="block text-xl font-bold font-mono mt-1">{reportData?.summary?.expenseCount ?? 0}</span>
                </div>
              </div>

              {/* By Category */}
              <section className="card p-5">
                <h4 className="font-bold text-sm mb-3">Expenses by Category</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                  {(reportData?.byCategory || []).map((c: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-xl border" style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }}>
                      <span className="text-xs text-ink-3 font-semibold">{c.category}</span>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="text-base font-bold font-mono">{formatINR(c.amountPaise)}</span>
                        <span className="text-[11px] text-amber-700 font-bold">{c.sharePct}%</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="overflow-x-auto">
                  <table className="rtable w-full text-sm border-collapse text-left">
                    <thead>
                      <tr className="border-b" style={{ borderColor: 'var(--line)' }}>
                        <th className="pb-2">Date</th>
                        <th className="pb-2">Category</th>
                        <th className="pb-2">Vendor</th>
                        <th className="pb-2 text-right">Amount</th>
                        <th className="pb-2 text-right">Method</th>
                        <th className="pb-2">Status</th>
                        <th className="pb-2">Reference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(reportData?.expenses || []).map((e: any, idx: number) => (
                        <tr key={idx} className="border-b" style={{ borderColor: 'var(--line-2)' }}>
                          <td className="py-2 font-mono text-xs">{e.date}</td>
                          <td className="py-2 font-medium">{e.category}</td>
                          <td className="py-2 text-ink-3">{e.vendor}</td>
                          <td className="py-2 font-mono text-right font-bold text-red-600">{formatINR(e.amountPaise)}</td>
                          <td className="py-2 font-mono text-xs text-right">{e.method.toUpperCase()}</td>
                          <td className="py-2 text-xs">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                              {e.status}
                            </span>
                          </td>
                          <td className="py-2 text-xs text-ink-3">{e.reference}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {/* ========================================================================= */}
          {/* 6. STAFF REPORT VIEW */}
          {/* ========================================================================= */}
          {activeReport === 'staff' && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Active Staff</span>
                  <span className="block text-xl font-bold font-mono mt-1">{reportData?.summary?.activeStaffCount ?? 0}</span>
                </div>
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Total Sales by Staff</span>
                  <span className="block text-xl font-bold font-mono mt-1 text-emerald-700">
                    {formatINR(reportData?.summary?.totalStaffSalesPaise ?? 0)}
                  </span>
                </div>
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Orders Handled</span>
                  <span className="block text-xl font-bold font-mono mt-1">{reportData?.summary?.totalOrdersHandled ?? 0}</span>
                </div>
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Discounts Authorized</span>
                  <span className="block text-xl font-bold font-mono mt-1 text-red-600">
                    {formatINR(reportData?.summary?.totalDiscountsGivenPaise ?? 0)}
                  </span>
                </div>
              </div>

              <section className="card p-5">
                <h4 className="font-bold text-sm mb-3">Staff Performance Activity</h4>
                <div className="overflow-x-auto">
                  <table className="rtable w-full text-sm border-collapse text-left">
                    <thead>
                      <tr className="border-b" style={{ borderColor: 'var(--line)' }}>
                        <th className="pb-2">Staff Name</th>
                        <th className="pb-2">Role</th>
                        <th className="pb-2 text-right">Orders Handled</th>
                        <th className="pb-2 text-right">Gross Sales</th>
                        <th className="pb-2 text-right">Discounts</th>
                        <th className="pb-2 text-right">Refunds</th>
                        <th className="pb-2 text-right">AOV</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(reportData?.staff || []).map((s: any, idx: number) => (
                        <tr key={idx} className="border-b" style={{ borderColor: 'var(--line-2)' }}>
                          <td className="py-2.5 font-bold">{s.name}</td>
                          <td className="py-2.5 text-xs text-ink-3 capitalize">{s.role}</td>
                          <td className="py-2.5 font-mono text-right">{s.orders}</td>
                          <td className="py-2.5 font-mono text-right font-bold text-emerald-700">{formatINR(s.grossSalesPaise)}</td>
                          <td className="py-2.5 font-mono text-right text-red-600">{formatINR(s.discountsPaise)}</td>
                          <td className="py-2.5 font-mono text-right text-stone-500">{formatINR(s.refundsPaise)}</td>
                          <td className="py-2.5 font-mono text-right">{formatINR(s.aovPaise)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {/* ========================================================================= */}
          {/* 7. DISCOUNTS REPORT VIEW */}
          {/* ========================================================================= */}
          {activeReport === 'discounts' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Total Discounts Given</span>
                  <span className="block text-xl font-bold font-mono mt-1 text-red-600">
                    {formatINR(reportData?.summary?.totalDiscountPaise ?? 0)}
                  </span>
                </div>
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Discounted Orders</span>
                  <span className="block text-xl font-bold font-mono mt-1">{reportData?.summary?.discountedOrdersCount ?? 0}</span>
                </div>
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Avg Discount per Order</span>
                  <span className="block text-xl font-bold font-mono mt-1">
                    {formatINR(reportData?.summary?.avgDiscountPerOrderPaise ?? 0)}
                  </span>
                </div>
              </div>

              <section className="card p-5">
                <h4 className="font-bold text-sm mb-3">Top Discounted Orders</h4>
                <div className="overflow-x-auto">
                  <table className="rtable w-full text-sm border-collapse text-left">
                    <thead>
                      <tr className="border-b" style={{ borderColor: 'var(--line)' }}>
                        <th className="pb-2">Order #</th>
                        <th className="pb-2">Date</th>
                        <th className="pb-2">Type</th>
                        <th className="pb-2">Cashier / Staff</th>
                        <th className="pb-2 text-right">Subtotal</th>
                        <th className="pb-2 text-right">Discount</th>
                        <th className="pb-2 text-right">Final Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(reportData?.orders || []).map((o: any, idx: number) => (
                        <tr key={idx} className="border-b" style={{ borderColor: 'var(--line-2)' }}>
                          <td className="py-2.5 font-bold font-mono">#{o.number}</td>
                          <td className="py-2.5 text-xs text-ink-3">{o.date}</td>
                          <td className="py-2.5 text-xs">{o.type}</td>
                          <td className="py-2.5 text-xs">{o.staffName}</td>
                          <td className="py-2.5 font-mono text-right">{formatINR(o.subtotalPaise)}</td>
                          <td className="py-2.5 font-mono text-right font-bold text-red-600">-{formatINR(o.discountPaise)}</td>
                          <td className="py-2.5 font-mono text-right font-bold">{formatINR(o.totalPaise)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {/* ========================================================================= */}
          {/* 8. REFUNDS REPORT VIEW */}
          {/* ========================================================================= */}
          {activeReport === 'refunds' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Total Refunds</span>
                  <span className="block text-xl font-bold font-mono mt-1 text-red-700">
                    {formatINR(reportData?.summary?.totalRefundPaise ?? 0)}
                  </span>
                </div>
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Cash Refunds</span>
                  <span className="block text-xl font-bold font-mono mt-1">{formatINR(reportData?.summary?.cashRefundsPaise ?? 0)}</span>
                </div>
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Digital Refunds (UPI/Card)</span>
                  <span className="block text-xl font-bold font-mono mt-1">{formatINR(reportData?.summary?.digitalRefundsPaise ?? 0)}</span>
                </div>
              </div>

              <section className="card p-5">
                <h4 className="font-bold text-sm mb-3">Refunds Ledger</h4>
                <div className="overflow-x-auto">
                  <table className="rtable w-full text-sm border-collapse text-left">
                    <thead>
                      <tr className="border-b" style={{ borderColor: 'var(--line)' }}>
                        <th className="pb-2">Date</th>
                        <th className="pb-2">Order #</th>
                        <th className="pb-2 text-right">Amount</th>
                        <th className="pb-2">Payment Method</th>
                        <th className="pb-2">Reason</th>
                        <th className="pb-2">Approved By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(reportData?.refunds || []).map((r: any, idx: number) => (
                        <tr key={idx} className="border-b" style={{ borderColor: 'var(--line-2)' }}>
                          <td className="py-2.5 text-xs text-ink-3">{r.date}</td>
                          <td className="py-2.5 font-mono font-bold">#{r.orderNumber}</td>
                          <td className="py-2.5 font-mono text-right font-bold text-red-600">{formatINR(r.amountPaise)}</td>
                          <td className="py-2.5 font-mono text-xs">{r.method}</td>
                          <td className="py-2.5 text-xs">{r.reason}</td>
                          <td className="py-2.5 text-xs text-ink-3">{r.approvedByName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {/* ========================================================================= */}
          {/* 9. TABLES REPORT VIEW */}
          {/* ========================================================================= */}
          {activeReport === 'tables' && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Total Tables</span>
                  <span className="block text-xl font-bold font-mono mt-1">{reportData?.summary?.totalTables ?? 0}</span>
                </div>
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Active Tables with Sales</span>
                  <span className="block text-xl font-bold font-mono mt-1">{reportData?.summary?.activeTablesWithOrders ?? 0}</span>
                </div>
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Total Table Sales</span>
                  <span className="block text-xl font-bold font-mono mt-1 text-emerald-700">
                    {formatINR(reportData?.summary?.totalTableSalesPaise ?? 0)}
                  </span>
                </div>
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Average per Table</span>
                  <span className="block text-xl font-bold font-mono mt-1">
                    {formatINR(reportData?.summary?.avgSalesPerTablePaise ?? 0)}
                  </span>
                </div>
              </div>

              <section className="card p-5">
                <h4 className="font-bold text-sm mb-3">Table Revenue & Utilization</h4>
                <div className="overflow-x-auto">
                  <table className="rtable w-full text-sm border-collapse text-left">
                    <thead>
                      <tr className="border-b" style={{ borderColor: 'var(--line)' }}>
                        <th className="pb-2">Table Label</th>
                        <th className="pb-2 text-right">Seating Capacity</th>
                        <th className="pb-2 text-right">Orders Served</th>
                        <th className="pb-2 text-right">Total Revenue</th>
                        <th className="pb-2 text-right">Average Order Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(reportData?.tables || []).map((t: any, idx: number) => (
                        <tr key={idx} className="border-b" style={{ borderColor: 'var(--line-2)' }}>
                          <td className="py-2.5 font-bold">{t.label}</td>
                          <td className="py-2.5 font-mono text-right">{t.seats} seats</td>
                          <td className="py-2.5 font-mono text-right">{t.orders}</td>
                          <td className="py-2.5 font-mono text-right font-bold text-emerald-700">{formatINR(t.salesPaise)}</td>
                          <td className="py-2.5 font-mono text-right">{formatINR(t.aovPaise)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {/* ========================================================================= */}
          {/* 10. KOT / KITCHEN REPORT VIEW */}
          {/* ========================================================================= */}
          {activeReport === 'kot' && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Total KOTs</span>
                  <span className="block text-xl font-bold font-mono mt-1">{reportData?.summary?.totalKots ?? 0}</span>
                </div>
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Completed / Served</span>
                  <span className="block text-xl font-bold font-mono mt-1 text-emerald-700">
                    {reportData?.summary?.completedKots ?? 0}
                  </span>
                </div>
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Queued / Preparing</span>
                  <span className="block text-xl font-bold font-mono mt-1 text-amber-600">
                    {reportData?.summary?.queuedKots ?? 0}
                  </span>
                </div>
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Cancelled KOTs</span>
                  <span className="block text-xl font-bold font-mono mt-1 text-red-600">
                    {reportData?.summary?.cancelledKots ?? 0}
                  </span>
                </div>
              </div>

              <section className="card p-5">
                <h4 className="font-bold text-sm mb-3">Kitchen Station Activity</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  {(reportData?.byStation || []).map((s: any, idx: number) => (
                    <div key={idx} className="p-3.5 rounded-xl border" style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }}>
                      <span className="text-xs font-bold text-amber-700">{s.station}</span>
                      <div className="flex justify-between items-baseline mt-1 text-sm">
                        <span>Total: <b>{s.total}</b></span>
                        <span className="text-emerald-700 font-bold">Done: {s.completed}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <h5 className="font-bold text-xs mb-2 text-ink-3">Top Items Prepared in Kitchen</h5>
                <div className="overflow-x-auto">
                  <table className="rtable w-full text-sm border-collapse text-left">
                    <thead>
                      <tr className="border-b" style={{ borderColor: 'var(--line)' }}>
                        <th className="pb-2">Item Name</th>
                        <th className="pb-2 text-right">Quantity Ordered</th>
                        <th className="pb-2 text-right">Kitchen Station</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(reportData?.topKitchenItems || []).map((i: any, idx: number) => (
                        <tr key={idx} className="border-b" style={{ borderColor: 'var(--line-2)' }}>
                          <td className="py-2.5 font-bold">{i.name}</td>
                          <td className="py-2.5 font-mono text-right">{i.qty}</td>
                          <td className="py-2.5 font-mono text-xs text-right text-ink-3">{i.station}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {/* ========================================================================= */}
          {/* 11. CASH DRAWER REPORT VIEW */}
          {/* ========================================================================= */}
          {activeReport === 'cash_drawer' && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Opening Cash Float</span>
                  <span className="block text-xl font-bold font-mono mt-1">{formatINR(reportData?.summary?.openingCashPaise ?? 0)}</span>
                </div>
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Cash Sales</span>
                  <span className="block text-xl font-bold font-mono mt-1 text-emerald-700">
                    {formatINR(reportData?.summary?.cashSalesPaise ?? 0)}
                  </span>
                </div>
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Expected Closing Cash</span>
                  <span className="block text-xl font-bold font-mono mt-1 text-amber-700">
                    {formatINR(reportData?.summary?.expectedClosingCashPaise ?? 0)}
                  </span>
                </div>
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Reconciliation Variance</span>
                  <span className={`block text-xl font-bold font-mono mt-1 ${
                    (reportData?.summary?.differencePaise ?? 0) === 0 ? 'text-emerald-700' : 'text-red-600'
                  }`}>
                    {formatINR(reportData?.summary?.differencePaise ?? 0)}
                  </span>
                </div>
              </div>

              <section className="card p-5">
                <h4 className="font-bold text-sm mb-3">Day Closings in Period</h4>
                <div className="overflow-x-auto">
                  <table className="rtable w-full text-sm border-collapse text-left">
                    <thead>
                      <tr className="border-b" style={{ borderColor: 'var(--line)' }}>
                        <th className="pb-2">Date</th>
                        <th className="pb-2">Status</th>
                        <th className="pb-2 text-right">Opening Cash</th>
                        <th className="pb-2 text-right">Cash Sales</th>
                        <th className="pb-2 text-right">Cash Expenses</th>
                        <th className="pb-2 text-right">Expected Cash</th>
                        <th className="pb-2 text-right">Actual Cash</th>
                        <th className="pb-2 text-right">Variance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(reportData?.closings || []).map((c: any, idx: number) => (
                        <tr key={idx} className="border-b" style={{ borderColor: 'var(--line-2)' }}>
                          <td className="py-2.5 font-mono text-xs">{c.businessDate}</td>
                          <td className="py-2.5 text-xs">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              c.status === 'closed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {c.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-2.5 font-mono text-right">{formatINR(c.openingCashPaise)}</td>
                          <td className="py-2.5 font-mono text-right">{formatINR(c.cashSalesPaise)}</td>
                          <td className="py-2.5 font-mono text-right text-red-600">{formatINR(c.cashExpensesPaise)}</td>
                          <td className="py-2.5 font-mono text-right">{formatINR(c.expectedCashPaise)}</td>
                          <td className="py-2.5 font-mono text-right font-bold">{formatINR(c.actualCashPaise)}</td>
                          <td className={`py-2.5 font-mono text-right font-bold ${c.cashVariancePaise === 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                            {formatINR(c.cashVariancePaise)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {/* ========================================================================= */}
          {/* 12. ORDERS / ORDER SUMMARY REPORT VIEW */}
          {/* ========================================================================= */}
          {activeReport === 'orders' && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Total Orders Booked</span>
                  <span className="block text-xl font-bold font-mono mt-1">{reportData?.summary?.totalOrders ?? 0}</span>
                </div>
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Settled Orders</span>
                  <span className="block text-xl font-bold font-mono mt-1 text-emerald-700">
                    {reportData?.summary?.settledOrders ?? 0}
                  </span>
                </div>
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Dine In vs Takeaway</span>
                  <span className="block text-sm font-bold font-mono mt-1">
                    {reportData?.summary?.dineInOrders ?? 0} / {reportData?.summary?.takeawayOrders ?? 0}
                  </span>
                </div>
                <div className="card p-3.5">
                  <span className="block text-[11px] text-ink-3">Average Order Value</span>
                  <span className="block text-xl font-bold font-mono mt-1 text-amber-700">
                    {formatINR(reportData?.summary?.aovPaise ?? 0)}
                  </span>
                </div>
              </div>

              <section className="card p-5">
                <h4 className="font-bold text-sm mb-3">Recent Orders Activity</h4>
                <div className="overflow-x-auto">
                  <table className="rtable w-full text-sm border-collapse text-left">
                    <thead>
                      <tr className="border-b" style={{ borderColor: 'var(--line)' }}>
                        <th className="pb-2">Order #</th>
                        <th className="pb-2">Date</th>
                        <th className="pb-2">Type</th>
                        <th className="pb-2">Table</th>
                        <th className="pb-2">Staff</th>
                        <th className="pb-2 text-right">Subtotal</th>
                        <th className="pb-2 text-right">Discount</th>
                        <th className="pb-2 text-right">Tax</th>
                        <th className="pb-2 text-right">Total</th>
                        <th className="pb-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(reportData?.orders || []).map((o: any, idx: number) => (
                        <tr key={idx} className="border-b" style={{ borderColor: 'var(--line-2)' }}>
                          <td className="py-2.5 font-mono font-bold">#{o.number}</td>
                          <td className="py-2.5 text-xs text-ink-3">{o.date}</td>
                          <td className="py-2.5 text-xs">{o.type}</td>
                          <td className="py-2.5 text-xs font-semibold">{o.tableLabel}</td>
                          <td className="py-2.5 text-xs text-ink-3">{o.staffName}</td>
                          <td className="py-2.5 font-mono text-right">{formatINR(o.subtotalPaise)}</td>
                          <td className="py-2.5 font-mono text-right text-red-600">-{formatINR(o.discountPaise)}</td>
                          <td className="py-2.5 font-mono text-right">{formatINR(o.taxPaise)}</td>
                          <td className="py-2.5 font-mono text-right font-bold text-emerald-700">{formatINR(o.totalPaise)}</td>
                          <td className="py-2.5 text-xs">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              o.status === 'SETTLED' ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-700'
                            }`}>
                              {o.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {/* ========================================================================= */}
          {/* ADVANCED MODULE VIEWS (Analytics & Forecast) */}
          {/* ========================================================================= */}
          {isAdvanced && activeReport === 'analytics' && (
            <div className="card p-5">
              <h4 className="font-bold text-sm mb-3">Advanced Sales Trend</h4>
              <div className="flex items-end justify-between gap-2 h-44 mt-4">
                {initialTrend.map((t, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-1.5">
                    <div
                      className="w-full rounded-t transition-all hover:opacity-80"
                      style={{
                        height: `${Math.max(8, Math.round((t.grossPaise / Math.max(...initialTrend.map((x) => x.grossPaise || 1))) * 140))}px`,
                        background: 'var(--turmeric)',
                      }}
                      title={`${t.label}: ${formatINR(t.grossPaise)} (${t.orders} orders)`}
                    />
                    <span className="text-[11px] font-bold text-ink-3">{t.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isAdvanced && activeReport === 'forecast' && (
            <div className="card p-5 text-center py-12">
              <CheckCircle2 size={32} className="mx-auto text-emerald-600 mb-2" />
              <h4 className="font-bold text-base">Demand Forecast Model</h4>
              <p className="text-xs text-ink-3 max-w-md mx-auto mt-1">
                Machine learning forecast based on previous 30-day velocity, day-of-week trends, and seasonality.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
