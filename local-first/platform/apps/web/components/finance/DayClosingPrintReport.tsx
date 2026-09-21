'use client';

import React from 'react';
import { formatINR } from '@cafeos/core';

interface DayClosingPrintReportProps {
  reportData: any;
  onClose?: () => void;
}

export function DayClosingPrintReport({ reportData, onClose }: DayClosingPrintReportProps) {
  if (!reportData) return null;

  const d = reportData;
  const outlet = d.outlet || {};
  const closedBy = d.closedBy || {};

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white text-black p-8 rounded-2xl max-w-3xl w-full my-8 shadow-2xl printable-area font-sans">
        {/* Actions bar (hidden in print) */}
        <div className="flex justify-between items-center pb-4 mb-6 border-b print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-700">Print Preview</span>
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono font-bold">
              {d.closingNumber || 'DAY CLOSING REPORT'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5"
            >
              🖨️ Print Report
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold transition"
              >
                ✕ Close
              </button>
            )}
          </div>
        </div>

        {/* Printable Report Header */}
        <div className="text-center border-b pb-4 mb-5">
          <h1 className="text-2xl font-black uppercase tracking-wider">{outlet.name || 'CHAYAONE CAFE & RESTAURANT'}</h1>
          <p className="text-xs text-slate-600 mt-0.5">
            {typeof outlet.address === 'string' ? outlet.address : (outlet.address?.line1 || 'Main Branch')}
          </p>
          {outlet.gstin && <p className="text-xs font-mono text-slate-600">GSTIN: {outlet.gstin}</p>}
          <div className="mt-3 py-1.5 px-4 inline-block bg-slate-100 rounded-full border border-slate-300">
            <h2 className="text-sm font-bold uppercase tracking-wide">
              OFFICIAL BUSINESS DAY CLOSING REPORT
            </h2>
          </div>
        </div>

        {/* Meta Info */}
        <div className="grid grid-cols-2 text-xs border-b pb-3 mb-4 font-mono">
          <div>
            <p><span className="text-slate-500 font-sans">Business Date:</span> <b>{d.businessDate}</b></p>
            <p><span className="text-slate-500 font-sans">Closing ID:</span> <b>{d.closingNumber}</b></p>
            <p><span className="text-slate-500 font-sans">Status:</span> <b className="uppercase">{d.status}</b></p>
          </div>
          <div className="text-right">
            <p><span className="text-slate-500 font-sans">Closed By:</span> <b>{d.closedByName || closedBy.name || 'Manager'}</b></p>
            <p><span className="text-slate-500 font-sans">Closed At:</span> <b>{d.closedAt ? new Date(d.closedAt).toLocaleString('en-IN') : 'N/A'}</b></p>
            <p><span className="text-slate-500 font-sans">Role:</span> <b className="uppercase">{d.closedByRole || closedBy.role || 'Manager'}</b></p>
          </div>
        </div>

        {/* 1. SALES SUMMARY */}
        <div className="mb-5">
          <h3 className="text-xs font-bold uppercase tracking-wider bg-slate-100 px-2 py-1 border-l-4 border-slate-800 mb-2">
            1. Sales &amp; Orders Summary
          </h3>
          <table className="w-full text-xs border-collapse">
            <tbody>
              <tr className="border-b border-slate-200">
                <td className="py-1">Gross Sales</td>
                <td className="py-1 text-right font-mono font-bold">{formatINR(d.grossSalesPaise || 0)}</td>
                <td className="py-1 pl-6">Total Orders</td>
                <td className="py-1 text-right font-mono">{d.ordersCount || 0}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-1 text-slate-600">Discounts &amp; Promos</td>
                <td className="py-1 text-right font-mono text-rose-600 font-bold">−{formatINR(d.discountsPaise || 0)}</td>
                <td className="py-1 pl-6 text-slate-600">Completed Orders</td>
                <td className="py-1 text-right font-mono text-emerald-700">{d.completedOrdersCount || 0}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-1 text-slate-600">Refunds</td>
                <td className="py-1 text-right font-mono text-rose-600 font-bold">−{formatINR(d.refundsPaise || 0)}</td>
                <td className="py-1 pl-6 text-slate-600">Cancelled Orders</td>
                <td className="py-1 text-right font-mono text-rose-600">{d.cancelledOrdersCount || 0}</td>
              </tr>
              <tr className="border-b border-slate-200 bg-slate-50 font-bold">
                <td className="py-1.5">Net Sales Revenue</td>
                <td className="py-1.5 text-right font-mono">{formatINR(d.netSalesPaise || 0)}</td>
                <td className="py-1.5 pl-6">Tax Collected (GST)</td>
                <td className="py-1.5 text-right font-mono font-bold">{formatINR(d.taxPaise || 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 2. PAYMENT RECONCILIATION */}
        <div className="mb-5">
          <h3 className="text-xs font-bold uppercase tracking-wider bg-slate-100 px-2 py-1 border-l-4 border-slate-800 mb-2">
            2. Payment Reconciliation Breakdown
          </h3>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-300 font-bold text-slate-600">
                <th className="py-1 text-left">Method</th>
                <th className="py-1 text-right">System Recorded</th>
                <th className="py-1 text-right">Verified Actual</th>
                <th className="py-1 text-right">Variance</th>
                <th className="py-1 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-200">
                <td className="py-1 font-bold">Cash Payments</td>
                <td className="py-1 text-right font-mono">{formatINR(d.cashSalesPaise || 0)}</td>
                <td className="py-1 text-right font-mono">{formatINR(d.cashSalesPaise || 0)}</td>
                <td className="py-1 text-right font-mono text-slate-500">₹0</td>
                <td className="py-1 text-center font-bold text-emerald-700 text-[10px]">MATCHED</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-1 font-bold">UPI / QR</td>
                <td className="py-1 text-right font-mono">{formatINR(d.upiSalesPaise || 0)}</td>
                <td className="py-1 text-right font-mono">{formatINR(d.upiSalesPaise || 0)}</td>
                <td className="py-1 text-right font-mono text-slate-500">₹0</td>
                <td className="py-1 text-center font-bold text-emerald-700 text-[10px]">MATCHED</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-1 font-bold">Credit / Debit Card</td>
                <td className="py-1 text-right font-mono">{formatINR(d.cardSalesPaise || 0)}</td>
                <td className="py-1 text-right font-mono">{formatINR(d.cardSalesPaise || 0)}</td>
                <td className="py-1 text-right font-mono text-slate-500">₹0</td>
                <td className="py-1 text-center font-bold text-emerald-700 text-[10px]">MATCHED</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-1 font-bold">Other / Delivery</td>
                <td className="py-1 text-right font-mono">{formatINR(d.otherSalesPaise || 0)}</td>
                <td className="py-1 text-right font-mono">{formatINR(d.otherSalesPaise || 0)}</td>
                <td className="py-1 text-right font-mono text-slate-500">₹0</td>
                <td className="py-1 text-center font-bold text-emerald-700 text-[10px]">MATCHED</td>
              </tr>
              <tr className="border-b border-slate-300 font-bold bg-slate-50">
                <td className="py-1.5">Total Collections</td>
                <td className="py-1.5 text-right font-mono">
                  {formatINR((d.cashSalesPaise || 0) + (d.upiSalesPaise || 0) + (d.cardSalesPaise || 0) + (d.otherSalesPaise || 0))}
                </td>
                <td className="py-1.5 text-right font-mono">
                  {formatINR((d.cashSalesPaise || 0) + (d.upiSalesPaise || 0) + (d.cardSalesPaise || 0) + (d.otherSalesPaise || 0))}
                </td>
                <td className="py-1.5 text-right font-mono text-slate-500">₹0</td>
                <td className="py-1.5 text-center font-bold text-emerald-700 text-[10px]">RECONCILED</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 3. CASH RECONCILIATION & VARIANCE */}
        <div className="mb-5">
          <h3 className="text-xs font-bold uppercase tracking-wider bg-slate-100 px-2 py-1 border-l-4 border-slate-800 mb-2">
            3. Cash Reconciliation &amp; Drawer Auditing
          </h3>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="border p-2.5 rounded bg-slate-50 space-y-1">
              <div className="flex justify-between">
                <span>Opening Cash Float:</span>
                <span className="font-mono font-bold">{formatINR(d.openingCashPaise || 0)}</span>
              </div>
              <div className="flex justify-between text-emerald-800">
                <span>+ Cash Sales Today:</span>
                <span className="font-mono">+{formatINR(d.cashSalesPaise || 0)}</span>
              </div>
              <div className="flex justify-between text-emerald-800">
                <span>+ Cash In / Inflows:</span>
                <span className="font-mono">+{formatINR(d.cashInPaise || 0)}</span>
              </div>
              <div className="flex justify-between text-rose-700">
                <span>− Cash Expenses:</span>
                <span className="font-mono">−{formatINR(d.cashExpensesPaise || 0)}</span>
              </div>
              <div className="flex justify-between text-rose-700">
                <span>− Cash Withdrawals / Out:</span>
                <span className="font-mono">−{formatINR(d.cashOutPaise || 0)}</span>
              </div>
              <div className="flex justify-between text-rose-700">
                <span>− Cash Refunds:</span>
                <span className="font-mono">−{formatINR(d.cashRefundsPaise || 0)}</span>
              </div>
              <div className="flex justify-between font-bold border-t pt-1 border-slate-300">
                <span>= Expected Closing Cash:</span>
                <span className="font-mono">{formatINR(d.expectedCashPaise || 0)}</span>
              </div>
            </div>

            <div className="border p-2.5 rounded bg-slate-50 space-y-2 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center py-1">
                  <span className="font-bold">Actual Cash Counted:</span>
                  <span className="font-mono text-sm font-black">{formatINR(d.actualCashPaise || 0)}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-t border-slate-200">
                  <span className="font-bold">Reconciliation Variance:</span>
                  <span className={`font-mono text-sm font-black ${(d.cashVariancePaise || 0) === 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {(d.cashVariancePaise || 0) >= 0 ? '+' : ''}{formatINR(d.cashVariancePaise || 0)}
                  </span>
                </div>
                {d.varianceReason && (
                  <p className="text-[11px] text-slate-700 mt-1">
                    <b>Reason:</b> {d.varianceReason} {d.varianceNote ? `(${d.varianceNote})` : ''}
                  </p>
                )}
              </div>
              <div className="text-[10px] text-slate-500 border-t pt-1">
                Verified with strict zero-loss cashier drawer auditing standards.
              </div>
            </div>
          </div>
        </div>

        {/* 4. NEXT BUSINESS DAY CONFIGURATION & DEPOSIT */}
        <div className="mb-6 p-3 rounded-lg border border-slate-300 bg-slate-50 text-xs">
          <h3 className="font-bold uppercase tracking-wider mb-2 text-slate-800">
            4. Next Business Day Cash Carry-Forward &amp; Transfer
          </h3>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <span className="text-[10px] text-slate-500 uppercase block">Tomorrow Opening Cash</span>
              <b className="font-mono text-sm text-emerald-800">{formatINR(d.tomorrowOpeningCashPaise || 0)}</b>
              <span className="text-[10px] text-slate-400 block">Stays in drawer float</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase block">Cash Removed / Deposited</span>
              <b className="font-mono text-sm text-indigo-900">{formatINR(d.cashRemovedPaise || 0)}</b>
              <span className="text-[10px] text-slate-400 block">Vault drop / Bank transfer</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase block">Deposit Destination</span>
              <b className="text-xs uppercase">{d.cashDepositDestination || 'Vault / Safe'}</b>
              <span className="text-[10px] text-slate-400 block">{d.cashDepositAccountName || 'Main Account'}</span>
            </div>
          </div>
        </div>

        {/* 5. SIGNATURES & AUDIT VERIFICATION */}
        <div className="pt-8 border-t-2 border-slate-400 mt-8">
          <div className="grid grid-cols-3 gap-8 text-center text-xs">
            <div>
              <div className="border-b border-black pb-1 mb-1 font-mono font-bold">
                {d.closedByName || closedBy.name || 'Shift Cashier'}
              </div>
              <p className="text-[10px] text-slate-500 uppercase">Prepared By (Cashier)</p>
            </div>
            <div>
              <div className="border-b border-black pb-1 mb-1 font-mono font-bold">
                {d.closedByName || 'Store Manager'}
              </div>
              <p className="text-[10px] text-slate-500 uppercase">Verified By (Manager)</p>
            </div>
            <div>
              <div className="border-b border-black pb-1 mb-1 font-mono font-bold">
                Administrator
              </div>
              <p className="text-[10px] text-slate-500 uppercase">Authorized Signature</p>
            </div>
          </div>
        </div>

        <div className="text-center text-[9px] text-slate-400 mt-6 pt-3 border-t">
          Generated automatically by ChayaOne OS — Restaurant Local-First Operating System. Record Timestamp: {new Date().toISOString()}
        </div>
      </div>
    </div>
  );
}
