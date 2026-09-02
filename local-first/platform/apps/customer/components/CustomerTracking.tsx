'use client';

import { CheckCircle2, Clock, ChefHat, Sparkles, Bell, Receipt, Utensils } from 'lucide-react';

interface OrderItemSummary {
  name: string;
  qty: number;
  pricePaise: number;
}

interface CustomerTrackingProps {
  orderNumber: number;
  status: string; // 'pending_approval' | 'approved' | 'in_kitchen' | 'ready' | 'served' | 'settled'
  items: OrderItemSummary[];
  tableLabel: string;
  totalPaise: number;
  onOpenAssistance: () => void;
  onOpenBill: () => void;
}

const STEPS = [
  { key: 'placed', label: 'Order Received', icon: Clock },
  { key: 'approved', label: 'KOT Sent', icon: CheckCircle2 },
  { key: 'in_kitchen', label: 'Preparing in Kitchen', icon: ChefHat },
  { key: 'ready', label: 'Ready to Serve', icon: Sparkles },
  { key: 'served', label: 'Served at Table', icon: Utensils },
];

export function CustomerTracking({
  orderNumber,
  status,
  items,
  tableLabel,
  totalPaise,
  onOpenAssistance,
  onOpenBill,
}: CustomerTrackingProps) {
  const getActiveStepIndex = () => {
    switch (status) {
      case 'pending_approval':
      case 'open':
        return 0;
      case 'approved':
        return 1;
      case 'in_kitchen':
        return 2;
      case 'ready':
        return 3;
      case 'served':
      case 'settled':
        return 4;
      default:
        return 1;
    }
  };

  const activeIndex = getActiveStepIndex();

  return (
    <div className="p-4 rounded-3xl bg-gray-900/80 border border-sky-500/30 shadow-2xl space-y-5">
      {/* Tracker Header */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-3">
        <div>
          <span className="text-[11px] font-bold text-sky-400 uppercase tracking-wider">
            Live Order Status
          </span>
          <h3 className="text-base font-black text-white">Order #{orderNumber} · Table {tableLabel}</h3>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-sky-500/20 text-sky-300 text-xs font-bold capitalize">
          {status.replace('_', ' ')}
        </span>
      </div>

      {/* 5-Step Timeline Visualizer */}
      <div className="relative py-2">
        <div className="space-y-4">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isCompleted = idx < activeIndex;
            const isCurrent = idx === activeIndex;
            const isPending = idx > activeIndex;

            return (
              <div key={step.key} className="flex items-start gap-3.5 relative">
                {/* Connecting Line */}
                {idx < STEPS.length - 1 && (
                  <div
                    className={`absolute left-4 top-8 w-0.5 h-6 transition-all duration-300 ${
                      idx < activeIndex ? 'bg-sky-400' : 'bg-gray-800'
                    }`}
                  />
                )}

                {/* Step Circle */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                    isCompleted
                      ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30'
                      : isCurrent
                      ? 'bg-sky-400 text-gray-950 font-bold ring-4 ring-sky-500/20 animate-pulse'
                      : 'bg-gray-800 text-gray-500'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>

                {/* Step Label */}
                <div className="flex-1 pt-1">
                  <h4
                    className={`text-xs font-bold leading-tight ${
                      isCurrent
                        ? 'text-sky-300 font-extrabold text-sm'
                        : isCompleted
                        ? 'text-gray-200'
                        : 'text-gray-500'
                    }`}
                  >
                    {step.label}
                  </h4>
                  {isCurrent && (
                    <p className="text-[11px] text-gray-400 mt-0.5 animate-pulse">
                      {idx === 0 && 'Awaiting waiter check-in'}
                      {idx === 1 && 'Order fired to station printers'}
                      {idx === 2 && 'Our chefs are crafting your food fresh'}
                      {idx === 3 && 'Plated and ready to be brought to table'}
                      {idx === 4 && 'Enjoy your meal!'}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Item Summary Accordion */}
      {items.length > 0 && (
        <div className="p-3 rounded-2xl bg-gray-800/40 border border-gray-800 space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-gray-400 pb-1 border-b border-gray-800/60 font-semibold">
            <span>Ordered Items</span>
            <span>₹{(totalPaise / 100).toFixed(0)}</span>
          </div>
          {items.map((it, idx) => (
            <div key={idx} className="flex justify-between text-gray-300">
              <span>
                {it.qty}× {it.name}
              </span>
              <span className="text-gray-400 tnum">₹{((it.pricePaise * it.qty) / 100).toFixed(0)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          onClick={onOpenAssistance}
          className="py-3 px-3 rounded-2xl bg-gray-800/80 hover:bg-gray-700 text-amber-400 border border-amber-500/20 text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95"
        >
          <Bell className="w-3.5 h-3.5" />
          <span>Call Waiter</span>
        </button>
        <button
          onClick={onOpenBill}
          className="py-3 px-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-purple-600/20 transition-all active:scale-95"
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>View Bill & Pay</span>
        </button>
      </div>
    </div>
  );
}
