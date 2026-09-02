'use client';

import { useState } from 'react';
import { Search, Plus, Sparkles, Flame, Check, Utensils } from 'lucide-react';

export interface ModifierOption {
  id: string;
  name: string;
  pricePaise: number;
}

export interface ModifierGroup {
  id: string;
  name: string;
  min: number;
  max: number;
  options: ModifierOption[];
}

export interface MenuItem {
  id: string;
  name: string;
  pricePaise: number;
  gstRate: number;
  station: string | null;
  tags: string[];
  modifierGroups?: ModifierGroup[];
}

export interface MenuCategory {
  id: string;
  name: string;
  items: MenuItem[];
}

interface CustomerMenuProps {
  categories: MenuCategory[];
  onAddToCart: (
    item: MenuItem,
    chosenMods: { name: string; pricePaise: number }[],
    notes: string
  ) => void;
}

export function CustomerMenu({ categories, onAddToCart }: CustomerMenuProps) {
  const [selectedCatId, setSelectedCatId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dietaryFilter, setDietaryFilter] = useState<'all' | 'veg' | 'non-veg' | 'bestseller'>('all');

  // Customizer Modal
  const [activeItem, setActiveItem] = useState<MenuItem | null>(null);
  const [selectedMods, setSelectedMods] = useState<Record<string, string[]>>({});
  const [itemNote, setItemNote] = useState('');

  const allItems: MenuItem[] = categories.flatMap((c) => c.items);

  const filterByDiet = (item: MenuItem) => {
    const isVeg = item.tags.some((t) => t.toLowerCase() === 'veg');
    const isNonVeg = item.tags.some((t) => t.toLowerCase() === 'non-veg' || t.toLowerCase() === 'nonveg');
    const isBest = item.tags.some((t) => t.toLowerCase().includes('best') || t.toLowerCase().includes('special'));

    if (dietaryFilter === 'veg') return isVeg;
    if (dietaryFilter === 'non-veg') return isNonVeg;
    if (dietaryFilter === 'bestseller') return isBest;
    return true;
  };

  const displayedItems = (
    selectedCatId === 'all'
      ? allItems
      : categories.find((c) => c.id === selectedCatId)?.items || []
  )
    .filter(filterByDiet)
    .filter((i) => i.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleItemAddClick = (item: MenuItem) => {
    if (item.modifierGroups && item.modifierGroups.length > 0) {
      setActiveItem(item);
      setSelectedMods({});
      setItemNote('');
    } else {
      onAddToCart(item, [], '');
    }
  };

  const handleConfirmModifiers = () => {
    if (!activeItem) return;
    const chosenMods: { name: string; pricePaise: number }[] = [];

    activeItem.modifierGroups?.forEach((group) => {
      const selectedOptionIds = selectedMods[group.id] || [];
      group.options.forEach((opt) => {
        if (selectedOptionIds.includes(opt.id)) {
          chosenMods.push({ name: opt.name, pricePaise: opt.pricePaise });
        }
      });
    });

    onAddToCart(activeItem, chosenMods, itemNote);
    setActiveItem(null);
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="px-4">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search our handcrafted menu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-gray-900/80 border border-gray-800 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-sky-500 transition-all shadow-inner"
          />
        </div>
      </div>

      {/* Dietary Filters */}
      <div className="px-4 flex items-center gap-2 overflow-x-auto no-scrollbar">
        {[
          { key: 'all', label: 'All Dishes' },
          { key: 'veg', label: '🟢 Pure Veg' },
          { key: 'non-veg', label: '🔴 Non-Veg' },
          { key: 'bestseller', label: '⭐ Chef Specials' },
        ].map((d) => (
          <button
            key={d.key}
            onClick={() => setDietaryFilter(d.key as any)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              dietaryFilter === d.key
                ? 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-md'
                : 'bg-gray-900/60 text-gray-400 hover:text-gray-200 border border-gray-800'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Category Pills */}
      <div className="px-4 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setSelectedCatId('all')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            selectedCatId === 'all'
              ? 'bg-gray-100 text-gray-900 shadow'
              : 'bg-gray-900/60 text-gray-400 hover:text-gray-200 border border-gray-800'
          }`}
        >
          All Categories
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedCatId(c.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedCatId === c.id
                ? 'bg-gray-100 text-gray-900 shadow'
                : 'bg-gray-900/60 text-gray-400 hover:text-gray-200 border border-gray-800'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Food Items List */}
      <div className="px-4 space-y-3">
        {displayedItems.length === 0 ? (
          <div className="text-center py-16 text-gray-500 text-xs">
            No menu items found in this section.
          </div>
        ) : (
          displayedItems.map((item) => {
            const isVeg = item.tags.some((t) => t.toLowerCase() === 'veg');
            const hasCustomizations = item.modifierGroups && item.modifierGroups.length > 0;

            return (
              <div
                key={item.id}
                className="p-4 rounded-2xl bg-gray-900/70 border border-gray-800 hover:border-gray-700/80 transition-all flex items-center justify-between gap-4 shadow-sm"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-3.5 h-3.5 rounded-[4px] border flex items-center justify-center p-0.5 ${
                        isVeg ? 'border-emerald-500' : 'border-rose-500'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isVeg ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                      />
                    </span>
                    <h3 className="text-sm font-bold text-gray-100 leading-snug">{item.name}</h3>
                  </div>

                  <p className="text-xs font-black text-white tnum pt-0.5">
                    ₹{(item.pricePaise / 100).toFixed(0)}
                  </p>

                  {hasCustomizations && (
                    <span className="text-[10px] text-sky-400 font-semibold flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      <span>Customizable</span>
                    </span>
                  )}
                </div>

                <button
                  onClick={() => handleItemAddClick(item)}
                  className="px-4 py-2 rounded-xl bg-sky-500/10 hover:bg-sky-500 active:bg-sky-600 text-sky-400 hover:text-white border border-sky-500/30 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Modifier Customization Sheet */}
      {activeItem && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setActiveItem(null)}
        >
          <div
            className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-t-3xl sm:rounded-3xl p-5 max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <div>
                <h3 className="text-base font-bold text-white">{activeItem.name}</h3>
                <p className="text-xs text-sky-400">
                  Base: ₹{(activeItem.pricePaise / 100).toFixed(0)}
                </p>
              </div>
              <button
                onClick={() => setActiveItem(null)}
                className="w-8 h-8 rounded-full bg-gray-800 text-gray-400 hover:text-white flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-4">
              {activeItem.modifierGroups?.map((group) => {
                const isSingle = group.max === 1;
                const currentSelected = selectedMods[group.id] || [];

                return (
                  <div key={group.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wide">
                        {group.name}
                      </h4>
                      <span className="text-[10px] text-gray-400">
                        {isSingle ? 'Choose 1' : `Max ${group.max}`}
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
                <label className="text-xs font-bold text-gray-300">Special Instructions</label>
                <input
                  type="text"
                  placeholder="e.g. Less ice, extra hot, sugar on the side..."
                  value={itemNote}
                  onChange={(e) => setItemNote(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-gray-800/80 border border-gray-700 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <button
              onClick={handleConfirmModifiers}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-sky-500/25"
            >
              Add to Order
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
