'use client';

import { useState } from 'react';
import { Plus, Minus, Trash2, ShoppingBag, ArrowRight, ShieldCheck } from 'lucide-react';
import confetti from 'canvas-confetti';

export interface CartLine {
  lineId: string;
  itemId: string;
  name: string;
  pricePaise: number;
  qty: number;
  modifiers: { name: string; pricePaise: number }[];
  notes: string;
}

interface CustomerCartProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartLine[];
  onUpdateQty: (lineId: string, delta: number) => void;
  onRemoveLine: (lineId: string) => void;
  tableToken: string;
  onOrderPlaced: (order: any) => void;
}

export function CustomerCart({
  isOpen,
  onClose,
  cart,
  onUpdateQty,
  onRemoveLine,
  tableToken,
  onOrderPlaced,
}: CustomerCartProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const totalItemsCount = cart.reduce((acc, line) => acc + line.qty, 0);
  const subtotalPaise = cart.reduce((acc, line) => acc + line.pricePaise * line.qty, 0);
  const estimatedGstPaise = Math.round(subtotalPaise * 0.05); // 5% estimate
  const totalPaise = subtotalPaise + estimatedGstPaise;

  const handlePlaceOrder = async () => {
    if (cart.length === 0 || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const lines = cart.map((c) => ({
        itemId: c.itemId,
        qty: c.qty,
        modifiers: c.modifiers,
        notes: c.notes || undefined,
      }));

      const clientUuid = crypto.randomUUID();
      const res = await fetch('/api/qr-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          t: tableToken,
          clientUuid,
          lines,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not place order. Please try again.');
        setSubmitting(false);
        return;
      }

      // Trigger Confetti Celebration!
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch (e) {
        // ignore
      }

      onOrderPlaced(data.order);
      onClose();
    } catch (err: any) {
      setError('Network error placing order');
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-t-3xl sm:rounded-3xl p-5 max-h-[88vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-sky-400" />
            <h2 className="text-base font-bold text-white">Your Cart ({totalItemsCount})</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-800 text-gray-400 hover:text-white flex items-center justify-center font-bold text-sm"
          >
            ✕
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mt-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium text-center">
            {error}
          </div>
        )}

        {/* Cart List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
          {cart.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-xs">Your cart is empty.</div>
          ) : (
            cart.map((line) => (
              <div
                key={line.lineId}
                className="p-3.5 rounded-2xl bg-gray-800/40 border border-gray-800/80 flex items-center justify-between gap-2"
              >
                <div className="flex-1 min-w-0 pr-2">
                  <h4 className="text-xs font-bold text-gray-100 truncate">{line.name}</h4>
                  {line.modifiers.length > 0 && (
                    <p className="text-[10px] text-sky-400 mt-0.5 truncate">
                      {line.modifiers.map((m) => m.name).join(', ')}
                    </p>
                  )}
                  {line.notes && (
                    <p className="text-[10px] text-amber-400/80 italic mt-0.5 truncate">
                      "{line.notes}"
                    </p>
                  )}
                  <span className="text-xs font-bold text-white tnum mt-1 block">
                    ₹{((line.pricePaise * line.qty) / 100).toFixed(0)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => onUpdateQty(line.lineId, -1)}
                    className="w-7 h-7 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 flex items-center justify-center text-xs transition-colors"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-6 text-center text-xs font-bold text-white tnum">
                    {line.qty}
                  </span>
                  <button
                    onClick={() => onUpdateQty(line.lineId, 1)}
                    className="w-7 h-7 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 flex items-center justify-center text-xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onRemoveLine(line.lineId)}
                    className="w-7 h-7 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 flex items-center justify-center text-xs ml-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Bill Breakdown & Place Order */}
        {cart.length > 0 && (
          <div className="pt-3 border-t border-gray-800 space-y-3">
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-gray-400">
                <span>Items Subtotal</span>
                <span className="font-semibold text-gray-200 tnum">
                  ₹{(subtotalPaise / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>GST (Est. 5%)</span>
                <span className="font-semibold text-gray-200 tnum">
                  ₹{(estimatedGstPaise / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm font-bold text-white pt-1 border-t border-gray-800/60">
                <span>Total to Pay</span>
                <span className="text-base font-black text-sky-400 tnum">
                  ₹{(totalPaise / 100).toFixed(2)}
                </span>
              </div>
            </div>

            <button
              onClick={handlePlaceOrder}
              disabled={submitting || cart.length === 0}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500 hover:from-sky-600 hover:to-purple-600 active:scale-98 text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-sky-500/25 transition-all disabled:opacity-50"
            >
              {submitting ? (
                <span>Placing your order...</span>
              ) : (
                <>
                  <span>Confirm & Send Order</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <p className="text-[10px] text-gray-500 text-center flex items-center justify-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>Directly sent to the kitchen · Pay at table later</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
