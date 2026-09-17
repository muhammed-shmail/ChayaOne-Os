import {
  getModuleConfig,
  setModuleConfig,
  getModuleStatePayload,
  isModuleEnabled,
  requireModule,
} from '../modules';
import {
  MODULE_REGISTRY,
  BUSINESS_PRESETS,
  resolveModuleDependencies,
  createDefaultModuleConfig,
  canDisableModule,
} from '@cafeos/core';
import type { ModuleId, BusinessTypeId, ModuleSystemConfig } from '@cafeos/types';

export class ModuleService {
  /**
   * Returns current active module configuration for an outlet.
   */
  static async getConfig(outletId?: string): Promise<ModuleSystemConfig> {
    return await getModuleConfig(outletId);
  }

  /**
   * Returns complete administrative module management payload.
   */
  static async getStatePayload(outletId?: string) {
    return await getModuleStatePayload(outletId);
  }

  /**
   * Updates enabled modules and/or business type with dependency resolution.
   */
  static async updateConfig(
    outletId: string,
    params: {
      businessType?: BusinessTypeId;
      enabledModules?: ModuleId[];
      moduleSettings?: Record<string, Record<string, any>>;
    }
  ) {
    return await setModuleConfig(outletId, params);
  }

  /**
   * Applies a business preset (e.g. cafe, restaurant, hotel, juice_shop).
   */
  static async applyPreset(outletId: string, businessType: BusinessTypeId) {
    const preset = BUSINESS_PRESETS[businessType] || BUSINESS_PRESETS.cafe;
    const resolvedModules = resolveModuleDependencies(preset.defaultModules);

    return await setModuleConfig(outletId, {
      businessType,
      enabledModules: resolvedModules,
    });
  }

  /**
   * Checks if a specific feature module is enabled.
   */
  static async isEnabled(moduleId: ModuleId, outletId?: string): Promise<boolean> {
    return await isModuleEnabled(moduleId, outletId);
  }

  /**
   * Reusable route guard checking if a module is active.
   */
  static async require(moduleId: ModuleId, outletId?: string) {
    return await requireModule(moduleId, outletId);
  }
}
