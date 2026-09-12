/**
 * ChayaOne OS — Module System Types & Interfaces
 *
 * Defines stable module identifiers, business types, metadata, presets,
 * and runtime configuration schemas for the modular installation system.
 */

export type ModuleId =
  | 'core'
  | 'cafe'
  | 'restaurant'
  | 'hotel'
  | 'juice'
  | 'meals'
  | 'inventory'
  | 'customer_qr'
  | 'waiter'
  | 'kds'
  | 'crm'
  | 'loyalty'
  | 'advanced_reports';

export const ALL_MODULE_IDS: readonly ModuleId[] = [
  'core',
  'cafe',
  'restaurant',
  'hotel',
  'juice',
  'meals',
  'inventory',
  'customer_qr',
  'waiter',
  'kds',
  'crm',
  'loyalty',
  'advanced_reports',
] as const;

export type BusinessTypeId =
  | 'cafe'
  | 'restaurant'
  | 'hotel'
  | 'juice_shop'
  | 'meals_shop'
  | 'multi_category'
  | 'custom';

export const ALL_BUSINESS_TYPES: readonly BusinessTypeId[] = [
  'cafe',
  'restaurant',
  'hotel',
  'juice_shop',
  'meals_shop',
  'multi_category',
  'custom',
] as const;

export type ModuleCategory =
  | 'core'
  | 'business'
  | 'operations'
  | 'engagement'
  | 'intelligence';

export interface ModuleMetadata {
  id: ModuleId;
  name: string;
  description: string;
  version: string;
  dependencies: ModuleId[];
  optional: boolean;
  category: ModuleCategory;
  licenseRequired?: boolean;
  licenseStatus?: 'active' | 'expired' | 'trial' | 'none';
  licenseExpiresAt?: string | null;
}

export interface BusinessPresetDef {
  id: BusinessTypeId;
  name: string;
  description: string;
  defaultModules: ModuleId[];
  suggestedCategories: string[];
}

export interface ModuleSystemConfig {
  businessType: BusinessTypeId;
  enabledModules: ModuleId[];
  installedModules: ModuleId[];
  updatedAt: string;
  version: string;
  moduleSettings?: Record<string, Record<string, unknown>>;
}

export interface ModuleStatePayload {
  config: ModuleSystemConfig;
  availableModules: ModuleMetadata[];
  presets: BusinessPresetDef[];
}
