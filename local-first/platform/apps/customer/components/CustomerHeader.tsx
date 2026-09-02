'use client';

import { Utensils, Bell, Receipt, ShoppingBag } from 'lucide-react';

interface CustomerHeaderProps {
  outletName: string;
  tableLabel: string;
  cartCount: number;
  onOpenCart: () => void;
  onOpenAssistance: () => void;
  onOpenBill: () => void;
  hasActiveOrder?: boolean;
}

export function CustomerHeader({
  outletName,
  tableLabel,
  cartCount,
  onOpenCart,
  onOpenAssistance,
  onOpenBill,
  hasActiveOrder = false,
}: CustomerHeaderProps) {
  return (
    <header className="sticky top-0 z-40 glass-panel px-4 py-3 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-500 p-0.5 shadow-md shadow-sky-500/20">
          <div className="w-full h-full bg-gray-900 rounded-[10px] flex items-center justify-center">
            <Utensils className="w-4 h-4 text-sky-400" />
          </div>
        </div>
        <div>
          <h1 className="text-sm font-black text-white leading-tight">{outletName || 'Cafe Menu'}</h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="px-2 py-0.5 rounded-full bg-sky-500/20 border border-sky-500/40 text-sky-300 text-[10px] font-extrabold tracking-wide uppercase">
              Table {tableLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Call Waiter Button */}
        <button
          onClick={onOpenAssistance}
          className="p-2 rounded-xl bg-gray-800/80 hover:bg-gray-700/80 text-amber-400 border border-amber-500/20 transition-all flex items-center gap-1 text-xs font-semibold active:scale-95"
          title="Call Waiter / Assistance"
        >
          <Bell className="w-4 h-4" />
          <span className="hidden sm:inline">Call Waiter</span>
        </button>

        {/* View Bill Button */}
        {hasActiveOrder && (
          <button
            onClick={onOpenBill}
            className="p-2 rounded-xl bg-gray-800/80 hover:bg-gray-700/80 text-purple-400 border border-purple-500/20 transition-all flex items-center gap-1 text-xs font-semibold active:scale-95"
            title="View Bill & Pay"
          >
            <Receipt className="w-4 h-4" />
            <span className="hidden sm:inline">Bill</span>
          </button>
        )}

        {/* Cart Trigger */}
        {cartCount > 0 && (
          <button
            onClick={onOpenCart}
            className="relative px-3 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-sky-500/25 active:scale-95 transition-all"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>{cartCount}</span>
          </button>
        )}
      </div>
    </header>
  );
}
