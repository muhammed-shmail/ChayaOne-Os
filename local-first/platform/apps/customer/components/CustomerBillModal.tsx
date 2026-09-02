'use client';

import { useState, useEffect } from 'react';
import { Receipt, QrCode, CreditCard, Banknote, RefreshCw, CheckCircle2, Heart } from 'lucide-react';

interface CustomerBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableToken: string;
  onOpenFeedback: () => void;
}

export function CustomerBillModal({
  isOpen,
  onClose,
  tableToken,
  onOpenFeedback,
}: CustomerBillModalProps) {
  const [billData, setBillData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [payMethod, setPayMethod] = useState<'upi' | 'cash'>('upi');
  const [cashNotified, setCashNotified] = useState(false);

  const fetchBill = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/customer/bill?t=${tableToken}`);
      if (res.ok) {
        const data = await res.json();
        setBillData(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchBill();
    }
  }, [isOpen, tableToken]);

  if (!isOpen) return null;

  const handleNotifyCash = async () => {
    try {
      await fetch('/api/customer/assistance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          t: tableToken,
          requestType: 'bill',
          notes: 'Customer paying with CASH at table/counter.',
        }),
      });
      setCashNotified(true);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-t-3xl sm:rounded-3xl p-5 max-h-[90vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-purple-400" />
            <div>
              <h2 className="text-base font-bold text-white">Your Check & Bill</h2>
              <p className="text-[11px] text-gray-400">Table {billData?.tableLabel || ''}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-800 text-gray-400 hover:text-white flex items-center justify-center font-bold text-sm"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-3 space-y-4">
          {loading ? (
            <div className="text-center py-12 text-gray-400 text-xs flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-purple-400" />
              <span>Calculating authoritative bill...</span>
            </div>
          ) : !billData || billData.orderCount === 0 ? (
            <div className="text-center py-12 text-gray-500 text-xs">
              No active orders found for this table.
            </div>
          ) : (
            <>
              {/* Itemized list */}
              <div className="p-3.5 rounded-2xl bg-gray-800/40 border border-gray-800 space-y-2 text-xs">
                <div className="flex justify-between text-gray-400 font-semibold pb-1 border-b border-gray-800/60 text-[11px]">
                  <span>Item</span>
                  <span>Amount</span>
                </div>
                {billData.items?.map((it: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-gray-200">
                    <div>
                      <span>
                        {it.qty}× {it.name}
                      </span>
                      {it.modifiers?.length > 0 && (
                        <p className="text-[10px] text-gray-400">
                          {it.modifiers.map((m: any) => m.name).join(', ')}
                        </p>
                      )}
                    </div>
                    <span className="font-semibold text-white tnum">
                      ₹{(it.totalPaise / 100).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Financials Breakdown */}
              <div className="p-3.5 rounded-2xl bg-gray-800/60 border border-gray-800 space-y-1.5 text-xs">
                <div className="flex justify-between text-gray-400">
                  <span>Subtotal</span>
                  <span className="font-semibold text-gray-200 tnum">
                    ₹{billData.financials?.subtotalRupees}
                  </span>
                </div>
                {Number(billData.financials?.discountRupees) > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Discount</span>
                    <span className="font-semibold tnum">
                      -₹{billData.financials?.discountRupees}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-gray-400">
                  <span>Taxes (GST)</span>
                  <span className="font-semibold text-gray-200 tnum">
                    ₹{billData.financials?.taxRupees}
                  </span>
                </div>
                <div className="flex justify-between text-base font-black text-white pt-2 border-t border-gray-700/80">
                  <span>Grand Total</span>
                  <span className="text-purple-400 tnum text-lg">
                    ₹{billData.financials?.totalRupees}
                  </span>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPayMethod('upi')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      payMethod === 'upi'
                        ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                        : 'bg-gray-800/40 border-gray-800 text-gray-400'
                    }`}
                  >
                    <QrCode className="w-4 h-4" />
                    <span>UPI Scan & Pay</span>
                  </button>
                  <button
                    onClick={() => setPayMethod('cash')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      payMethod === 'cash'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-gray-800/40 border-gray-800 text-gray-400'
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    <span>Pay with Cash</span>
                  </button>
                </div>

                {payMethod === 'upi' && billData.upi?.upiString && (
                  <div className="p-4 rounded-2xl bg-gray-950 border border-purple-500/30 text-center space-y-3">
                    <p className="text-xs font-bold text-gray-300">Scan QR to pay with any UPI App</p>
                    <div className="w-44 h-44 mx-auto bg-white p-2.5 rounded-2xl shadow-lg flex items-center justify-center">
                      {/* Generates UPI QR representation */}
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                          billData.upi.upiString
                        )}`}
                        alt="UPI Payment QR"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <p className="text-[10px] text-gray-400">
                      Supports GPay, PhonePe, Paytm, BHIM, Cred
                    </p>
                    <a
                      href={billData.upi.upiString}
                      className="block w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-purple-600/20"
                    >
                      Open UPI App on Phone
                    </a>
                  </div>
                )}

                {payMethod === 'cash' && (
                  <div className="p-4 rounded-2xl bg-gray-950 border border-gray-800 text-center space-y-3">
                    <p className="text-xs text-gray-300 leading-relaxed">
                      You can pay ₹{billData.financials?.totalRupees} in cash directly to our floor waiter or at the cashier counter.
                    </p>
                    {cashNotified ? (
                      <div className="py-2.5 px-4 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Staff notified to collect cash!</span>
                      </div>
                    ) : (
                      <button
                        onClick={handleNotifyCash}
                        className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider"
                      >
                        Notify Waiter for Cash Collection
                      </button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer Feedback Trigger */}
        <div className="pt-3 border-t border-gray-800">
          <button
            onClick={() => {
              onClose();
              onOpenFeedback();
            }}
            className="w-full py-3 rounded-2xl bg-gray-800/80 hover:bg-gray-700 text-sky-400 font-bold text-xs flex items-center justify-center gap-2 transition-all"
          >
            <Heart className="w-4 h-4 text-rose-500" />
            <span>Rate Your Experience & Win Rewards</span>
          </button>
        </div>
      </div>
    </div>
  );
}
