'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Calendar,
  History,
  Printer,
  FileSpreadsheet,
  Search,
  Eye,
  ArrowLeft,
  RefreshCw,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { formatINR } from '@cafeos/core';
import { DayClosingPrintReport } from '@/components/finance/DayClosingPrintReport';

export default function DayClosingHistoryPage() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedReport, setSelectedReport] = useState<any | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (search) params.set('search', search);

      const res = await fetch(`/api/finance/day-closing/history?${params.toString()}`);
      const json = await res.json();
      if (res.ok) {
        setRecords(json.records || []);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openReport = async (closingId: string) => {
    try {
      const res = await fetch(`/api/finance/day-closing/${closingId}`);
      const json = await res.json();
      if (res.ok) {
        setSelectedReport(json.report);
      }
    } catch (err) {
      alert('Failed to load detailed report');
    }
  };

  const exportCSV = () => {
    if (records.length === 0) return;
    const headers = [
      'Business Date',
      'Closing ID',
      'Gross Sales',
      'Net Sales',
      'Cash',
      'UPI',
      'Card',
      'Expenses',
      'Variance',
      'Variance Reason',
      'Tomorrow Opening Float',
      'Cash Deposited',
      'Closed By',
      'Closed At',
      'Status',
    ];

    const rows = records.map((r) => [
      r.date,
      r.closingId,
      (r.totalSalesPaise / 100).toFixed(2),
      (r.netSalesPaise / 100).toFixed(2),
      (r.cashPaise / 100).toFixed(2),
      (r.upiPaise / 100).toFixed(2),
      (r.cardPaise / 100).toFixed(2),
      (r.expensesPaise / 100).toFixed(2),
      (r.variancePaise / 100).toFixed(2),
      r.varianceReason || '',
      (r.tomorrowOpeningCashPaise / 100).toFixed(2),
      (r.cashRemovedPaise / 100).toFixed(2),
      r.closedBy,
      r.closedAt ? new Date(r.closedAt).toLocaleString('en-IN') : '',
      r.status,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((row) => row.map((c) => `"${c}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `DayClosings_History_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)] p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <Link href="/finance/day-closing" className="hover:text-slate-800 transition flex items-center gap-1 font-bold">
                <ArrowLeft size={12} /> Day Closing
              </Link>
              <span>/</span>
              <span className="font-extrabold text-amber-600">History &amp; Audit Logs</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black font-display text-slate-900 tracking-tight flex items-center gap-2.5">
              <History className="text-amber-500" />
              Day Closing History
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Historical business day reconciliations, cash floats, variances, and audit snapshots.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              disabled={records.length === 0}
              className="btn btn-sm btn-ghost border text-xs gap-1.5 font-bold"
            >
              <FileSpreadsheet size={14} /> Export CSV
            </button>
            <Link href="/finance/day-closing" className="btn btn-sm btn-primary text-xs gap-1.5 font-bold">
              Current Day Closing →
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="card p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3" style={{ background: 'var(--paper-2)' }}>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by Closing ID, date, or manager name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchHistory()}
              className="inp pl-9 text-xs h-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="inp text-xs h-9 py-1"
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="inp text-xs h-9 py-1"
              />
            </div>
            <button onClick={fetchHistory} className="btn btn-sm btn-dark text-xs gap-1.5 h-9">
              <RefreshCw size={12} /> Filter
            </button>
          </div>
        </div>

        {/* Records Table */}
        <div className="card p-5 overflow-hidden" style={{ background: 'var(--paper-2)' }}>
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">
              <RefreshCw className="animate-spin w-6 h-6 mx-auto mb-2 text-amber-500" />
              Loading closing records...
            </div>
          ) : records.length === 0 ? (
            <div className="p-12 text-center border rounded-xl border-dashed text-slate-400 text-xs">
              No historical Day Closing records found matching your filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b text-slate-400 font-bold" style={{ borderColor: 'var(--line)' }}>
                    <th className="py-3">Business Date</th>
                    <th className="py-3">Closing ID</th>
                    <th className="py-3 text-right">Net Sales</th>
                    <th className="py-3 text-right">Cash</th>
                    <th className="py-3 text-right">UPI</th>
                    <th className="py-3 text-right">Card</th>
                    <th className="py-3 text-right">Expenses</th>
                    <th className="py-3 text-right">Variance</th>
                    <th className="py-3 text-right">Tomorrow Float</th>
                    <th className="py-3">Closed By</th>
                    <th className="py-3 text-center">Status</th>
                    <th className="py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-b hover:bg-slate-50/50 transition" style={{ borderColor: 'var(--line)' }}>
                      <td className="py-3 font-mono font-bold text-slate-900">{r.date}</td>
                      <td className="py-3 font-mono text-emerald-700 font-bold">{r.closingId}</td>
                      <td className="py-3 text-right font-mono font-bold">{formatINR(r.netSalesPaise || r.totalSalesPaise)}</td>
                      <td className="py-3 text-right font-mono text-slate-600">{formatINR(r.cashPaise)}</td>
                      <td className="py-3 text-right font-mono text-slate-600">{formatINR(r.upiPaise)}</td>
                      <td className="py-3 text-right font-mono text-slate-600">{formatINR(r.cardPaise)}</td>
                      <td className="py-3 text-right font-mono text-rose-600">−{formatINR(r.expensesPaise)}</td>
                      <td
                        className={`py-3 text-right font-mono font-bold ${
                          r.variancePaise === 0
                            ? 'text-slate-400'
                            : r.variancePaise > 0
                            ? 'text-emerald-600'
                            : 'text-rose-600'
                        }`}
                      >
                        {r.variancePaise >= 0 ? '+' : ''}
                        {formatINR(r.variancePaise)}
                      </td>
                      <td className="py-3 text-right font-mono text-emerald-800 font-bold">
                        {formatINR(r.tomorrowOpeningCashPaise)}
                      </td>
                      <td className="py-3 text-slate-700 font-medium">{r.closedBy}</td>
                      <td className="py-3 text-center">
                        <span
                          className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                            r.status === 'closed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openReport(r.id)}
                            title="Print / View Report"
                            className="btn btn-xs btn-ghost border text-[11px] gap-1"
                          >
                            <Eye size={12} /> View
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal for viewing detailed printable report */}
        {selectedReport && (
          <DayClosingPrintReport
            reportData={selectedReport}
            onClose={() => setSelectedReport(null)}
          />
        )}
      </div>
    </div>
  );
}
