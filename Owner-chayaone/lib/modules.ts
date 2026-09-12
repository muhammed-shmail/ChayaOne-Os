import type { ModuleSystemConfig, ModuleId } from '@cafeos/types';

export async function getModuleConfig(outletId?: string): Promise<ModuleSystemConfig> {
  return {
    businessType: 'cafe',
    enabledModules: ['core', 'cafe', 'restaurant', 'inventory', 'customer_qr', 'crm', 'loyalty', 'advanced_reports'] as ModuleId[],
    installedModules: ['core', 'cafe', 'restaurant', 'hotel', 'juice', 'meals', 'inventory', 'customer_qr', 'waiter', 'kds', 'crm', 'loyalty', 'advanced_reports'] as ModuleId[],
    updatedAt: new Date().toISOString(),
    version: '1.2.0',
    moduleSettings: {},
  };
}

export async function updateModuleConfig(outletId: string, config: any): Promise<any> {
  return config;
}

export function isModuleEnabled(config: ModuleSystemConfig, mod: string): boolean {
  return config.enabledModules.includes(mod as any);
}
