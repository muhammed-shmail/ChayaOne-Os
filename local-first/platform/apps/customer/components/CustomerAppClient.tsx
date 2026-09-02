'use client';

import { useState, useEffect } from 'react';
import { CustomerHeader } from './CustomerHeader';
import { CustomerMenu, type MenuCategory, type MenuItem } from './CustomerMenu';
import { CustomerCart, type CartLine } from './CustomerCart';
import { CustomerTracking } from './CustomerTracking';
import { CustomerAssistanceModal } from './CustomerAssistanceModal';
import { CustomerBillModal } from './CustomerBillModal';
import { CustomerFeedbackModal } from './CustomerFeedbackModal';
import { RefreshCw, Utensils, AlertCircle } from 'lucide-react';

interface CustomerAppClientProps {
  initialToken?: string | null;
}

export function CustomerAppClient({ initialToken }: CustomerAppClientProps) {
  const [token, setToken] = useState<string | null>(initialToken || null);
  const [outletName, setOutletName] = useState('ChayaOne Cafe');
  const [tableLabel, setTableLabel] = useState('T1');
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAssistanceOpen, setIsAssistanceOpen] = useState(false);
  const [isBillOpen, setIsBillOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  // Read query params if initialToken was not passed directly
  useEffect(() => {
    if (!token && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const t = urlParams.get('t');
      if (t) setToken(t);
    }
  }, [token]);

  // Load customer context and menu
  const loadContextAndMenu = async () => {
    try {
      const effectiveToken = token || 't1'; // fallback default demo table
      const [ctxRes, menuRes] = await Promise.all([
        fetch(`/api/customer/context?t=${effectiveToken}`),
        fetch('/api/menu'),
      ]);

      if (ctxRes.ok) {
        const ctxData = await ctxRes.json();
        if (ctxData.outlet) setOutletName(ctxData.outlet.name || 'ChayaOne Cafe');
        if (ctxData.table) setTableLabel(ctxData.table.label || 'T1');
        if (ctxData.activeOrder) {
          setActiveOrder(ctxData.activeOrder);
        }
      }

      if (menuRes.ok) {
        const menuData = await menuRes.json();
        setCategories(menuData.categories || []);
      }
    } catch (err: any) {
      console.error('Failed to load customer experience', err);
      setError('Could not connect to cafe local server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContextAndMenu();
    // Poll for order status updates
    const interval = setInterval(loadContextAndMenu, 4000);
    return () => clearInterval(interval);
  }, [token]);

  const handleAddToCart = (
    item: MenuItem,
    chosenMods: { name: string; pricePaise: number }[],
    notes: string
  ) => {
    const extraPrice = chosenMods.reduce((sum, m) => sum + m.pricePaise, 0);
    const unitPrice = item.pricePaise + extraPrice;

    const modKey = JSON.stringify(chosenMods.map((m) => m.name).sort());
    const existingIndex = cart.findIndex(
      (c) =>
        c.itemId === item.id &&
        JSON.stringify(c.modifiers.map((m) => m.name).sort()) === modKey &&
        c.notes === notes
    );

    const updated = [...cart];
    if (existingIndex >= 0 && updated[existingIndex]) {
      const existing = updated[existingIndex]!;
      updated[existingIndex] = { ...existing, qty: existing.qty + 1 };
      setCart(updated);
    } else {
      const newLine: CartLine = {
        lineId: Math.random().toString(36).substring(7),
        itemId: item.id,
        name: item.name,
        pricePaise: unitPrice,
        qty: 1,
        modifiers: chosenMods,
        notes,
      };
      setCart([...cart, newLine]);
    }
  };

  const handleUpdateQty = (lineId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.lineId === lineId) {
            const nextQty = l.qty + delta;
            return nextQty > 0 ? { ...l, qty: nextQty } : null;
          }
          return l;
        })
        .filter(Boolean) as CartLine[]
    );
  };

  const handleRemoveLine = (lineId: string) => {
    setCart((prev) => prev.filter((l) => l.lineId !== lineId));
  };

  const handleOrderPlaced = (newOrder: any) => {
    setActiveOrder(newOrder);
    setCart([]);
    loadContextAndMenu();
  };

  const totalCartCount = cart.reduce((acc, line) => acc + line.qty, 0);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
        <RefreshCw className="w-8 h-8 text-sky-400 animate-spin mb-3" />
        <p className="text-sm font-bold text-white">Opening Cafe Menu...</p>
        <p className="text-xs text-gray-500 mt-1">Connecting to table {tableLabel}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <CustomerHeader
        outletName={outletName}
        tableLabel={tableLabel}
        cartCount={totalCartCount}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenAssistance={() => setIsAssistanceOpen(true)}
        onOpenBill={() => setIsBillOpen(true)}
        hasActiveOrder={!!activeOrder}
      />

      <main className="max-w-lg mx-auto py-4 space-y-5">
        {/* Active Order Live Tracker */}
        {activeOrder && (
          <div className="px-4">
            <CustomerTracking
              orderNumber={activeOrder.number}
              status={activeOrder.status}
              items={
                activeOrder.items?.map((i: any) => ({
                  name: i.nameSnapshot || i.name,
                  qty: i.qty,
                  pricePaise: i.unitPricePaise,
                })) || []
              }
              tableLabel={tableLabel}
              totalPaise={activeOrder.totalPaise}
              onOpenAssistance={() => setIsAssistanceOpen(true)}
              onOpenBill={() => setIsBillOpen(true)}
            />
          </div>
        )}

        {/* Menu Catalog */}
        <CustomerMenu categories={categories} onAddToCart={handleAddToCart} />
      </main>

      {/* Floating Bottom Cart trigger if items in cart and cart drawer closed */}
      {totalCartCount > 0 && !isCartOpen && (
        <div className="fixed bottom-4 left-4 right-4 z-40 max-w-lg mx-auto">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-black text-sm uppercase tracking-wider shadow-2xl flex items-center justify-between active:scale-98 transition-all"
          >
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-white text-gray-900 text-xs font-black flex items-center justify-center">
                {totalCartCount}
              </span>
              <span>View Cart & Checkout</span>
            </div>
            <span className="text-base font-extrabold tnum">
              ₹
              {(
                cart.reduce((sum, line) => sum + line.pricePaise * line.qty, 0) / 100
              ).toFixed(0)}
            </span>
          </button>
        </div>
      )}

      {/* Cart Drawer */}
      <CustomerCart
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onUpdateQty={handleUpdateQty}
        onRemoveLine={handleRemoveLine}
        tableToken={token || 't1'}
        onOrderPlaced={handleOrderPlaced}
      />

      {/* Assistance Modal */}
      <CustomerAssistanceModal
        isOpen={isAssistanceOpen}
        onClose={() => setIsAssistanceOpen(false)}
        tableToken={token || 't1'}
        tableLabel={tableLabel}
      />

      {/* Bill & Pay Modal */}
      <CustomerBillModal
        isOpen={isBillOpen}
        onClose={() => setIsBillOpen(false)}
        tableToken={token || 't1'}
        onOpenFeedback={() => setIsFeedbackOpen(true)}
      />

      {/* Feedback & Rewards Modal */}
      <CustomerFeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        tableToken={token || 't1'}
        tableLabel={tableLabel}
      />
    </div>
  );
}
