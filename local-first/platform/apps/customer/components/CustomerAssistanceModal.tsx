'use client';

import { useState } from 'react';
import { Bell, Droplets, Receipt, Sparkles, Check, Send } from 'lucide-react';

interface CustomerAssistanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableToken: string;
  tableLabel: string;
}

export function CustomerAssistanceModal({
  isOpen,
  onClose,
  tableToken,
  tableLabel,
}: CustomerAssistanceModalProps) {
  const [selectedType, setSelectedType] = useState<'call_waiter' | 'water' | 'bill'>('call_waiter');
  const [customNote, setCustomNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSendRequest = async (type: 'call_waiter' | 'water' | 'bill') => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/customer/assistance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          t: tableToken,
          requestType: type,
          notes: customNote || undefined,
        }),
      });

      if (res.ok) {
        setSentSuccess(true);
        setTimeout(() => {
          setSentSuccess(false);
          onClose();
        }, 1800);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl animate-in slide-in-from-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-800">
          <div>
            <h2 className="text-base font-bold text-white">Need Assistance?</h2>
            <p className="text-xs text-sky-400">Table {tableLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-800 text-gray-400 hover:text-white flex items-center justify-center font-bold text-sm"
          >
            ✕
          </button>
        </div>

        {sentSuccess ? (
          <div className="py-8 text-center space-y-2 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/30">
              <Check className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-white">Request Sent to Waiter!</h3>
            <p className="text-xs text-gray-400">Our floor staff is on the way to your table.</p>
          </div>
        ) : (
          <div className="py-4 space-y-3">
            <div className="grid grid-cols-1 gap-2.5">
              <button
                onClick={() => handleSendRequest('call_waiter')}
                disabled={submitting}
                className="p-4 rounded-2xl bg-gray-800/60 hover:bg-sky-500/10 active:bg-sky-500/20 border border-gray-700/80 hover:border-sky-500/40 flex items-center justify-between transition-all active:scale-98"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <h4 className="text-xs font-bold text-white">Call Waiter</h4>
                    <p className="text-[11px] text-gray-400">Notify floor staff to attend Table {tableLabel}</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleSendRequest('water')}
                disabled={submitting}
                className="p-4 rounded-2xl bg-gray-800/60 hover:bg-sky-500/10 active:bg-sky-500/20 border border-gray-700/80 hover:border-sky-500/40 flex items-center justify-between transition-all active:scale-98"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20">
                    <Droplets className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <h4 className="text-xs font-bold text-white">Water & Cutlery</h4>
                    <p className="text-[11px] text-gray-400">Request drinking water, glasses, or extra spoons</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleSendRequest('bill')}
                disabled={submitting}
                className="p-4 rounded-2xl bg-gray-800/60 hover:bg-purple-500/10 active:bg-purple-500/20 border border-gray-700/80 hover:border-purple-500/40 flex items-center justify-between transition-all active:scale-98"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <h4 className="text-xs font-bold text-white">Request Bill</h4>
                    <p className="text-[11px] text-gray-400">Ready to pay? Alert cashier to prepare your check</p>
                  </div>
                </div>
              </button>
            </div>

            {/* Custom message input */}
            <div className="space-y-1 pt-2">
              <label className="text-xs font-bold text-gray-400">Add a custom note (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Extra napkins, clean table, bill split..."
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-gray-800/80 border border-gray-700 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
