/**
 * ChayaOne OS — Core Module Registry & Dependency Management
 *
 * Implements the single source of truth for all business modules,
 * dependency resolution, business presets, and non-destructive activation rules.
 */

import type {
  ModuleId,
  BusinessTypeId,
  ModuleMetadata,
  BusinessPresetDef,
  ModuleSystemConfig,
} from '@cafeos/types';

export const MODULE_REGISTRY: Record<ModuleId, ModuleMetadata> = {
  core: {
    id: 'core',
    name: 'Core POS & System Infrastructure',
    description: 'Essential POS till, billing engine, staff RBAC, table map, printers, devices, updates & local database.',
    version: '1.2.0',
    dependencies: [],
    optional: false,
    category: 'core',
    licenseRequired: false,
  },
  cafe: {
    id: 'cafe',
    name: 'Cafe & Tea Shop',
    description: 'Specialized cafe workflows: tea & chai varieties, espresso, brewing customizations, bakery & quick snacks.',
    version: '1.2.0',
    dependencies: ['core'],
    optional: true,
    category: 'business',
  },
  restaurant: {
    id: 'restaurant',
    name: 'Restaurant & Dining',
    description: 'Multi-course dining, table management, cover counts, kitchen service courses & dining room workflows.',
    version: '1.2.0',
    dependencies: ['core'],
    optional: true,
    category: 'business',
  },
  hotel: {
    id: 'hotel',
    name: 'Hotel Management',
    description: 'Hotel room dining, resident guest billing, hospitality service integration & multi-area charge routing.',
    version: '1.2.0',
    dependencies: ['core', 'restaurant'],
    optional: true,
    category: 'business',
  },
  juice: {
    id: 'juice',
    name: 'Juice & Beverages',
    description: 'High-speed counter order builder for juices, fruit shakes, smoothies, mojitos, sweetness & topping customizations.',
    version: '1.2.0',
    dependencies: ['core'],
    optional: true,
    category: 'business',
  },
  meals: {
    id: 'meals',
    name: 'Meals & Rice Shop',
    description: 'High-volume meals service: daily thali, biriyani batches, rice combos, curry stations & parcel packaging.',
    version: '1.2.0',
    dependencies: ['core'],
    optional: true,
    category: 'business',
  },
  inventory: {
    id: 'inventory',
    name: 'Inventory & Recipe Stock',
    description: 'Raw materials, recipe auto-deduction on sales, purchase orders, wastage logging & low-stock alerts.',
    version: '1.2.0',
    dependencies: ['core'],
    optional: true,
    category: 'operations',
  },
  customer_qr: {
    id: 'customer_qr',
    name: 'Customer QR Ordering',
    description: 'Table QR code scanning, digital storefront menu, self-service cart, live status tracking & bill request.',
    version: '1.2.0',
    dependencies: ['core'],
    optional: true,
    category: 'engagement',
  },
  waiter: {
    id: 'waiter',
    name: 'Waiter App & Floor Operations',
    description: 'Handheld waiter ordering, digital table transfer/split/merge, table calling alerts & QR order approval.',
    version: '1.2.0',
    dependencies: ['core'],
    optional: true,
    category: 'operations',
  },
  kds: {
    id: 'kds',
    name: 'Kitchen Display System (KDS)',
    description: 'Paperless kitchen order screens, prep station dispatch, item bump bars & kitchen timing analytics.',
    version: '1.2.0',
    dependencies: ['core'],
    optional: true,
    category: 'operations',
  },
  crm: {
    id: 'crm',
    name: 'Customer Directory & CRM',
    description: 'Customer contact directory, visit history, purchase preferences, customer segmentation & targeted communication.',
    version: '1.2.0',
    dependencies: ['core'],
    optional: true,
    category: 'engagement',
  },
  loyalty: {
    id: 'loyalty',
    name: 'Loyalty Points & Rewards',
    description: 'Points earn & burn rules, cashback wallets, tier badges, rewards redemption catalog & spin games.',
    version: '1.2.0',
    dependencies: ['core'],
    optional: true,
    category: 'engagement',
  },
  advanced_reports: {
    id: 'advanced_reports',
    name: 'Advanced Analytics & Reports',
    description: 'In-depth sales analytics, hourly heatmaps, dish profitability, staff performance metrics & automated exports.',
    version: '1.2.0',
    dependencies: ['core'],
    optional: true,
    category: 'intelligence',
  },
};

export const BUSINESS_PRESETS: Record<BusinessTypeId, BusinessPresetDef> = {
  cafe: {
    id: 'cafe',
    name: 'Cafe / Tea Shop',
    description: 'Optimized for coffee shops, chai points, and quick-service cafes.',
    defaultModules: ['core', 'cafe'],
    suggestedCategories: ['Chai & Tea', 'Coffee', 'Coolers', 'All-Day Snacks', 'Bakery', 'Desserts'],
  },
  restaurant: {
    id: 'restaurant',
    name: 'Restaurant / Hotel',
    description: 'Full-service dining with waiter devices, table management, and kitchen display.',
    defaultModules: ['core', 'restaurant', 'waiter', 'kds'],
    suggestedCategories: ['Starters', 'Main Course', 'Breads & Roti', 'Rice & Biriyani', 'Beverages', 'Desserts'],
  },
  hotel: {
    id: 'hotel',
    name: 'Hotel Management',
    description: 'Hotel property dining, room service, waiter tablets, customer QR and inventory control.',
    defaultModules: ['core', 'restaurant', 'hotel', 'waiter', 'kds', 'customer_qr', 'inventory'],
    suggestedCategories: ['Room Dining', 'Restaurant Starters', 'Mains & Curries', 'Breakfast Specials', 'Beverages'],
  },
  juice_shop: {
    id: 'juice_shop',
    name: 'Juice Shop',
    description: 'Rapid point-of-sale for fresh juices, smoothies, shakes, and quick counter takeaways.',
    defaultModules: ['core', 'juice'],
    suggestedCategories: ['Fresh Fruit Juices', 'Milkshakes', 'Thick Shakes', 'Mojitos & Mocktails', 'Fruit Bowls', 'Ice Creams'],
  },
  meals_shop: {
    id: 'meals_shop',
    name: 'Meals / Rice Shop',
    description: 'High-speed billing for thali, biriyani, and batch-prepared meal counters.',
    defaultModules: ['core', 'meals', 'kds'],
    suggestedCategories: ['Thali & Meals', 'Special Biriyani', 'Rice Items', 'Curries & Gravies', 'Side Dishes', 'Coolers'],
  },
  multi_category: {
    id: 'multi_category',
    name: 'Multi-category (Hybrid)',
    description: 'For venues serving a combination of cafe, restaurant, fresh beverages, and customer QR ordering.',
    defaultModules: ['core', 'cafe', 'restaurant', 'juice', 'waiter', 'kds', 'customer_qr'],
    suggestedCategories: ['Chai & Coffee', 'Fresh Juices & Shakes', 'Quick Bites & Starters', 'Meals & Biriyani', 'Desserts'],
  },
  custom: {
    id: 'custom',
    name: 'Custom Selection',
    description: 'Manually select exact modules needed for your bespoke operations.',
    defaultModules: ['core'],
    suggestedCategories: ['General Menu'],
  },
};

/**
 * Automatically resolve and include all required dependencies for selected modules.
 * Core is ALWAYS included.
 */
export function resolveModuleDependencies(selectedModules: ModuleId[]): ModuleId[] {
  const result = new Set<ModuleId>(['core']); // Core is always mandatory

  for (const modId of selectedModules) {
    if (MODULE_REGISTRY[modId]) {
      result.add(modId);
    }
  }

  // Iterate to fix-point to resolve multi-level dependencies (e.g. hotel -> restaurant -> core)
  let changed = true;
  while (changed) {
    changed = false;
    for (const modId of Array.from(result)) {
      const def = MODULE_REGISTRY[modId];
      if (def?.dependencies) {
        for (const dep of def.dependencies) {
          if (!result.has(dep)) {
            result.add(dep);
            changed = true;
          }
        }
      }
    }
  }

  // Preserve stable registry ordering
  const registryOrder = Object.keys(MODULE_REGISTRY) as ModuleId[];
  return registryOrder.filter((id) => result.has(id));
}

/**
 * Validate that an enabled modules set does not have any missing dependencies.
 */
export function validateModuleDependencies(enabledModules: ModuleId[]): {
  valid: boolean;
  missing: Record<ModuleId, ModuleId[]>;
} {
  const enabledSet = new Set<ModuleId>(enabledModules);
  const missing: Record<ModuleId, ModuleId[]> = {} as any;
  let valid = true;

  if (!enabledSet.has('core')) {
    valid = false;
    missing.core = ['core'];
  }

  for (const modId of enabledModules) {
    const def = MODULE_REGISTRY[modId];
    if (def?.dependencies) {
      const missingDeps = def.dependencies.filter((dep) => !enabledSet.has(dep));
      if (missingDeps.length > 0) {
        valid = false;
        missing[modId] = missingDeps;
      }
    }
  }

  return { valid, missing };
}

/**
 * Check whether a module can be safely disabled without breaking other active modules.
 */
export function canDisableModule(
  moduleId: ModuleId,
  currentEnabled: ModuleId[],
): { canDisable: boolean; reason?: string; blockingDependents?: ModuleId[] } {
  if (moduleId === 'core') {
    return {
      canDisable: false,
      reason: 'The Core POS & System Infrastructure module is required and can never be disabled.',
    };
  }

  const blocking: ModuleId[] = [];
  for (const modId of currentEnabled) {
    if (modId === moduleId) continue;
    const def: ModuleMetadata | undefined = MODULE_REGISTRY[modId];
    if (def?.dependencies?.includes(moduleId)) {
      blocking.push(modId);
    }
  }

  if (blocking.length > 0) {
    const dependentNames = blocking.map((b) => MODULE_REGISTRY[b]?.name || b).join(', ');
    return {
      canDisable: false,
      reason: `Cannot disable ${MODULE_REGISTRY[moduleId]?.name || moduleId} because ${dependentNames} depend(s) on it. Disable those modules first.`,
      blockingDependents: blocking,
    };
  }

  return { canDisable: true };
}

/**
 * Build default ModuleSystemConfig for a given business type.
 */
export function createDefaultModuleConfig(businessType: BusinessTypeId = 'cafe'): ModuleSystemConfig {
  const preset = BUSINESS_PRESETS[businessType] || BUSINESS_PRESETS.cafe;
  const enabled = resolveModuleDependencies(preset.defaultModules);
  const allModules = Object.keys(MODULE_REGISTRY) as ModuleId[];

  return {
    businessType,
    enabledModules: enabled,
    installedModules: allModules, // All modules are shipped in ChayaOne unified package
    updatedAt: new Date().toISOString(),
    version: '1.2.0',
    moduleSettings: {},
  };
}
