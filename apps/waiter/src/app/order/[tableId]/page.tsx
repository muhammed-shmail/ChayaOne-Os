'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Search,
  Plus,
  Minus,
  Trash2,
  Flame,
  Check,
  ShoppingBag,
  Info,
  X,
  Sparkles,
} from 'lucide-react';
import { randomUUID } from 'crypto';

interface ModifierOption {
  id: string;
  name: string;
  pricePaise: number;
}

interface ModifierGroup {
  id: string;
  name: string;
  min: number;
  max: number;
  options: ModifierOption[];
}

interface MenuItem {
  id: string;
  name: string;
  pricePaise: number;
  gstRate: number;
  station: string | null;
  tags: string[];
  modifierGroups?: ModifierGroup[];
}

interface MenuCategory {
  id: string;
  name: string;
  items: MenuItem[];
}

interface CartLine {
  lineId: string;
  itemId: string;
  name: string;
  pricePaise: number;
  qty: number;
  modifiers: { name: string; pricePaise: number }[];
  notes: string;
}

export default function WaiterOrderBuilderPage() {
  const router = useRouter();
  const params = useParams();
  const tableId = String(params.tableId);

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [tableLabel, setTableLabel] = useState<string>(`Table`);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Modifier Selection Modal
  const [activeModItem, setActiveModItem] = useState<MenuItem | null>(null);
  const [selectedMods, setSelectedMods] = useState<Record<string, string[]>>({});
  const [itemNote, setItemNote] = useState('');

  // Cart Drawer open on mobile
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [menuRes, tableRes] = await Promise.all([
          fetch('/api/menu'),
          fetch('/api/tables'),
        ]);

        if (menuRes.ok) {
          const menuData = await menuRes.json();
          setCategories(menuData.categories || []);
          if (menuData.categories?.length > 0) {
            setSelectedCatId(menuData.categories[0].id);
          }
        }

        if (tableRes.ok) {
          const tData = await tableRes.json();
          const matched = tData.tables?.find((t: any) => t.id === tableId);
          if (matched) setTableLabel(`Table ${matched.label}`);
        }
      } catch (err) {
        console.error('Failed to load menu data', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [tableId]);

  const handleItemClick = (item: MenuItem) => {
    if (item.modifierGroups && item.modifierGroups.length > 0) {
      // Open modifier modal
      setActiveModItem(item);
      setSelectedMods({});
      setItemNote('');
    } else {
      // Direct add to cart
      addToCart(item, [], '');
    }
  };

  const addToCart = (
    item: MenuItem,
    chosenMods: { name: string; pricePaise: number }[],
    notes: string
  ) => {
    const extraPrice = chosenMods.reduce((sum, m) => sum + m.pricePaise, 0);
    const unitPrice = item.pricePaise + extraPrice;

    // Check if identical line exists
    const modKey = JSON.stringify(chosenMods.map((m) => m.name).sort());
    const existingIndex = cart.findIndex(
      (c) => c.itemId === item.id && JSON.stringify(c.modifiers.map((m) => m.name).sort()) === modKey && c.notes === notes
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

    setActiveModItem(null);
  };

  const updateLineQty = (lineId: string, delta: number) => {
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

  const removeLine = (lineId: string) => {
    setCart((prev) => prev.filter((l) => l.lineId !== lineId));
  };

  const confirmModifiers = () => {
    if (!activeModItem) return;
    const chosenMods: { name: string; pricePaise: number }[] = [];

    activeModItem.modifierGroups?.forEach((group) => {
      const selectedOptionIds = selectedMods[group.id] || [];
      group.options.forEach((opt) => {
        if (selectedOptionIds.includes(opt.id)) {
          chosenMods.push({ name: opt.name, pricePaise: opt.pricePaise });
        }
      });
    });

    addToCart(activeModItem, chosenMods, itemNote);
  };

  const totalItemsCount = cart.reduce((acc, line) => acc + line.qty, 0);
  const totalSubtotalPaise = cart.reduce((acc, line) => acc + line.pricePaise * line.qty, 0);

  const handleSendKot = async () => {
    if (cart.length === 0 || submitting) return;
    setSubmitting(true);

    try {
      const lines = cart.map((c) => ({
        itemId: c.itemId,
        qty: c.qty,
        modifiers: c.modifiers,
        notes: c.notes || undefined,
      }));

      const clientUuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientUuid,
          type: 'dine_in',
          tableId,
          lines,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.message || 'Failed to send KOT');
        setSubmitting(false);
        return;
      }

      try {
        sessionStorage.setItem('chayaone_just_ordered_table', JSON.stringify({ tableId, tableLabel, time: Date.now() }));
      } catch {}

      setSuccessToast(`✓ KOT Sent for ${tableLabel}!`);
      setTimeout(() => {
        router.push('/tables');
      }, 350);
    } catch (err) {
      console.error('Error sending KOT', err);
      alert('Network error sending KOT');
      setSubmitting(false);
    }
  };

  const allItems: MenuItem[] = categories.flatMap((c) => c.items);
  const displayedItems = (selectedCatId === 'all'
    ? allItems
    : categories.find((c) => c.id === selectedCatId)?.items || []
  ).filter((i) => i.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="min-h-screen pb-32 flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-40 glass-panel px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/tables')}
            className="p-2 rounded-xl bg-gray-800/80 hover:bg-gray-700/80 text-gray-300"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-base font-bold text-white leading-tight">{tableLabel}</h1>
            <p className="text-[11px] text-sky-400 font-medium">Add Items & Send KOT</p>
          </div>
        </div>

        {cart.length > 0 && (
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative px-3 py-1.5 rounded-xl bg-sky-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-sky-500/20"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>{totalItemsCount} items</span>
          </button>
        )}
      </header>

      {/* Search Bar */}
      <div className="p-3">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search food, beverages, snacks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-gray-900/80 border border-gray-800 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-sky-500 transition-all"
          />
        </div>
      </div>

      {/* Category Tabs Carousel */}
      <div className="px-3 pb-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setSelectedCatId('all')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            selectedCatId === 'all'
              ? 'bg-sky-500 text-white shadow-md shadow-sky-500/25'
              : 'bg-gray-900/60 text-gray-400 hover:text-gray-200 border border-gray-800'
          }`}
        >
          All Items ({allItems.length})
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedCatId(c.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCatId === c.id
                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/25'
                : 'bg-gray-900/60 text-gray-400 hover:text-gray-200 border border-gray-800'
            }`}
          >
            {c.name} ({c.items.length})
          </button>
        ))}
      </div>

      {/* Item Cards Grid */}
      <main className="p-3 flex-1">
        {loading ? (
          <div className="text-center py-20 text-gray-400 text-xs">Loading menu...</div>
        ) : displayedItems.length === 0 ? (
          <div className="text-center py-16 text-gray-500 text-xs">No items match your search.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {displayedItems.map((item) => {
              const inCartCount = cart
                .filter((c) => c.itemId === item.id)
                .reduce((sum, c) => sum + c.qty, 0);

              return (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`p-3 rounded-2xl border transition-all duration-150 cursor-pointer active:scale-95 flex flex-col justify-between relative h-28 ${
                    inCartCount > 0
                      ? 'bg-sky-500/10 border-sky-500/40 shadow-sm'
                      : 'bg-gray-900/50 hover:bg-gray-900/80 border-gray-800'
                  }`}
                >
                  {inCartCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 px-2 py-0.5 rounded-full bg-sky-500 text-white text-[10px] font-bold shadow">
                      {inCartCount}
                    </span>
                  )}
                  <div>
                    <h3 className="text-xs font-bold text-gray-100 line-clamp-2 leading-tight">
                      {item.name}
                    </h3>
                    {item.station && (
                      <span className="text-[9px] text-gray-400 uppercase tracking-wider font-semibold">
                        {item.station}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs font-black text-white tnum">
                      ₹{(item.pricePaise / 100).toFixed(0)}
                    </span>
                    <button className="w-6 h-6 rounded-lg bg-sky-500/20 hover:bg-sky-500 text-sky-400 hover:text-white flex items-center justify-center text-xs transition-colors">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Bottom Cart Bar (when cart has items) */}
      {cart.length > 0 && !isCartOpen && (
        <div className="fixed bottom-3 left-3 right-3 z-40">
          <div
            onClick={() => setIsCartOpen(true)}
            className="p-3.5 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white shadow-2xl flex items-center justify-between cursor-pointer transition-all active:scale-98"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center font-bold text-sm">
                {totalItemsCount}
              </div>
              <div>
                <p className="text-xs font-bold leading-tight">
                  {cart.length} unique {cart.length === 1 ? 'item' : 'items'}
                </p>
                <p className="text-[11px] text-sky-100">Tap to review & Fire KOT</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-base font-extrabold tnum">
                ₹{(totalSubtotalPaise / 100).toFixed(0)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Cart Review Sheet */}
      {isCartOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setIsCartOpen(false)}
        >
          <div
            className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-t-3xl sm:rounded-3xl p-5 max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <div>
                <h2 className="text-lg font-bold text-white">Order Review — {tableLabel}</h2>
                <p className="text-xs text-gray-400">{totalItemsCount} total items</p>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-800 text-gray-400 hover:text-white flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto py-3 space-y-3">
              {cart.map((line) => (
                <div
                  key={line.lineId}
                  className="p-3 rounded-2xl bg-gray-800/40 border border-gray-800 flex items-center justify-between"
                >
                  <div className="flex-1 pr-2">
                    <h4 className="text-xs font-bold text-gray-100">{line.name}</h4>
                    {line.modifiers.length > 0 && (
                      <p className="text-[10px] text-sky-400 mt-0.5">
                        {line.modifiers.map((m) => m.name).join(', ')}
                      </p>
                    )}
                    {line.notes && (
                      <p className="text-[10px] text-amber-400/80 italic mt-0.5">&quot;{line.notes}&quot;</p>
                    )}
                    <span className="text-xs font-semibold text-gray-300 tnum mt-1 block">
                      ₹{((line.pricePaise * line.qty) / 100).toFixed(0)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateLineQty(line.lineId, -1)}
                      className="w-7 h-7 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 flex items-center justify-center text-xs"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-6 text-center text-xs font-bold text-white tnum">
                      {line.qty}
                    </span>
                    <button
                      onClick={() => updateLineQty(line.lineId, 1)}
                      className="w-7 h-7 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 flex items-center justify-center text-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => removeLine(line.lineId)}
                      className="w-7 h-7 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 flex items-center justify-center text-xs ml-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer Summary & Fire KOT */}
            <div className="pt-3 border-t border-gray-800">
              <div className="flex items-center justify-between mb-3 text-sm">
                <span className="text-gray-400">Total Bill Estimate</span>
                <span className="text-lg font-black text-white tnum">
                  ₹{(totalSubtotalPaise / 100).toFixed(0)}
                </span>
              </div>

              <button
                onClick={handleSendKot}
                disabled={submitting}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 active:scale-98 text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-rose-500/25 transition-all disabled:opacity-50"
              >
                {submitting ? (
                  <span>Printing & Sending KOT...</span>
                ) : (
                  <>
                    <Flame className="w-5 h-5 animate-pulse" />
                    <span>Fire KOT to Kitchen</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modifier Customization Modal */}
      {activeModItem && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setActiveModItem(null)}
        >
          <div
            className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-t-3xl sm:rounded-3xl p-5 max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <div>
                <h3 className="text-base font-bold text-white">{activeModItem.name}</h3>
                <p className="text-xs text-sky-400">
                  Base: ₹{(activeModItem.pricePaise / 100).toFixed(0)}
                </p>
              </div>
              <button
                onClick={() => setActiveModItem(null)}
                className="w-8 h-8 rounded-full bg-gray-800 text-gray-400 hover:text-white flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-4">
              {activeModItem.modifierGroups?.map((group) => {
                const isSingle = group.max === 1;
                const currentSelected = selectedMods[group.id] || [];

                return (
                  <div key={group.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wide">
                        {group.name}
                      </h4>
                      <span className="text-[10px] text-gray-400">
                        {isSingle ? 'Pick 1' : `Max ${group.max}`}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {group.options.map((opt) => {
                        const isChecked = currentSelected.includes(opt.id);

                        const toggleOption = () => {
                          if (isSingle) {
                            setSelectedMods({ ...selectedMods, [group.id]: [opt.id] });
                          } else {
                            if (isChecked) {
                              setSelectedMods({
                                ...selectedMods,
                                [group.id]: currentSelected.filter((id) => id !== opt.id),
                              });
                            } else {
                              if (currentSelected.length < group.max) {
                                setSelectedMods({
                                  ...selectedMods,
                                  [group.id]: [...currentSelected, opt.id],
                                });
                              }
                            }
                          }
                        };

                        return (
                          <div
                            key={opt.id}
                            onClick={toggleOption}
                            className={`p-2.5 rounded-xl border text-xs font-medium cursor-pointer transition-all flex items-center justify-between ${
                              isChecked
                                ? 'bg-sky-500/20 border-sky-500 text-white'
                                : 'bg-gray-800/40 border-gray-800 text-gray-300 hover:border-gray-700'
                            }`}
                          >
                            <span>{opt.name}</span>
                            {opt.pricePaise > 0 && (
                              <span className="text-[10px] text-sky-400 tnum">
                                +₹{(opt.pricePaise / 100).toFixed(0)}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Special Cooking Note */}
              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-bold text-gray-300">Kitchen Note / Request</label>
                <input
                  type="text"
                  placeholder="e.g. Less spicy, extra hot, no onions..."
                  value={itemNote}
                  onChange={(e) => setItemNote(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-gray-800/80 border border-gray-700 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <button
              onClick={confirmModifiers}
              className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs uppercase tracking-wider"
            >
              Add to Order
            </button>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {successToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 py-2.5 px-5 rounded-2xl bg-emerald-500 text-white font-bold text-xs shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top duration-200">
          <Check className="w-4 h-4" />
          <span>{successToast}</span>
        </div>
      )}
    </div>
  );
}
