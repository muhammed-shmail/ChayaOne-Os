'use client';

import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { OwnerContext, Store } from '@/types';

/**
 * Global tenant context for the Owner Dashboard.
 * Holds the resolved owner context (org + authorized stores) and the currently
 * selected store (or null = "All Stores").
 *
 * This context is for UI state ONLY. Security is enforced server-side.
 * The selected store drives which API calls are made, but the server
 * always re-validates access before returning data.
 */

interface TenantContextValue {
  ownerContext:       OwnerContext | null;
  selectedStore:      Store | null;   // null = All Stores
  setOwnerContext:    (ctx: OwnerContext) => void;
  setSelectedStore:   (store: Store | null) => void;
  /** True if the user has access to more than one store */
  isMultiStore:       boolean;
}

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({ children }: { children: ReactNode }) {
  const [ownerContext, setOwnerContextState] = useState<OwnerContext | null>(null);
  const [selectedStore, setSelectedStoreState] = useState<Store | null>(null);

  const setOwnerContext = useCallback((ctx: OwnerContext) => {
    setOwnerContextState(ctx);
    // If user has only one store, auto-select it
    if (ctx.stores.length === 1) {
      setSelectedStoreState(ctx.stores[0] ?? null);
    } else {
      // Multi-store: default to "All Stores" view
      setSelectedStoreState(null);
    }
  }, []);

  const setSelectedStore = useCallback((store: Store | null) => {
    setSelectedStoreState(store);
  }, []);

  const isMultiStore = (ownerContext?.stores.length ?? 0) > 1;

  return (
    <TenantContext.Provider value={{
      ownerContext,
      selectedStore,
      setOwnerContext,
      setSelectedStore,
      isMultiStore,
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within TenantProvider');
  return ctx;
}

/** Convenience hook — returns currently selected store ID or null (all stores) */
export function useSelectedOutletId(): string | null {
  const { selectedStore } = useTenant();
  return selectedStore?.id ?? null;
}

/** Returns outlet IDs the current user is authorized to access */
export function useAuthorizedOutletIds(): string[] {
  const { ownerContext } = useTenant();
  return ownerContext?.stores.map((s) => s.id) ?? [];
}
