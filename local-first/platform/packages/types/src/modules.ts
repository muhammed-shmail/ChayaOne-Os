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
  | 'bakery'
  | 'retail'
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
  'bakery',
  'retail',
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
  | 'juice'
  | 'bakery'
  | 'restaurant'
  | 'hotel'
  | 'tea_shop'
  | 'fast_food'
  | 'retail'
  | 'other'
  | 'juice_shop'
  | 'meals_shop'
  | 'multi_category'
  | 'custom';

export const ALL_BUSINESS_TYPES: readonly BusinessTypeId[] = [
  'cafe',
  'juice',
  'bakery',
  'restaurant',
  'hotel',
  'tea_shop',
  'fast_food',
  'retail',
  'other',
  'juice_shop',
  'meals_shop',
  'multi_category',
  'custom',
] as const;

export const BUSINESS_TYPE_LABELS: Record<BusinessTypeId, string> = {
  cafe: 'Cafe',
  juice: 'Juice',
  bakery: 'Bakery',
  restaurant: 'Restaurant',
  hotel: 'Hotel',
  tea_shop: 'Tea Shop',
  fast_food: 'Fast Food',
  retail: 'Retail',
  other: 'Other',
  juice_shop: 'Juice Shop',
  meals_shop: 'Meals / Rice',
  multi_category: 'Multi-category',
  custom: 'Custom',
};

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
  businessTypes?: BusinessTypeId[];
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

// ===================== COMMERCIAL LICENSE TYPES =====================
export type LicenseStatus = 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'SUSPENDED' | 'REVOKED';

export type LicensePeriod = '1_month' | '2_months' | '3_months' | 'custom';

export interface LicenseRecord {
  id: string;
  licenseId: string;
  businessId: string;
  installationId: string;
  deviceId?: string | null;
  licenseType: string;
  startDate: string;
  expiryDate: string;
  status: LicenseStatus;
  signature: string;
  lastValidatedAt: string;
  lastServerTime?: string | null;
  activatedAt: string;
  activatedBy?: string | null;
  meta?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface LicenseStatusResponse {
  isConfigured: boolean;
  license: LicenseRecord | null;
  installationId: string;
  businessId: string | null;
  status: LicenseStatus;
  daysRemaining: number;
  hoursRemaining: number;
  isExpiringSoon: boolean; // <= 10 days
  isExpired: boolean;
  clockTampered: boolean;
  isOfflineGraceActive: boolean;
  offlineGraceRemainingHours: number;
  serverTime: string;
}
