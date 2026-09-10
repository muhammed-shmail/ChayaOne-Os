/**
 * ChayaOne OS — Server-Side Module Runtime & Route Guards
 *
 * Provides:
 * 1. Dual-persistence module configuration (PostgreSQL Outlet.settings + ProgramData config file).
 * 2. In-memory caching for zero-latency hot-path checks.
 * 3. Reusable API route guards (requireModule) returning 403 MODULE_NOT_ENABLED.
 * 4. Safe enable/disable semantics: Core can never be disabled, dependencies are auto-resolved,
 *    and data is never deleted when a module is disabled.
 */

import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { prisma, type Prisma } from '@cafeos/db';
import type {
  ModuleId,
  BusinessTypeId,
  ModuleSystemConfig,
  ModuleStatePayload,
} from '@cafeos/types';
import {
  MODULE_REGISTRY,
  BUSINESS_PRESETS,
  resolveModuleDependencies,
  createDefaultModuleConfig,
  canDisableModule,
} from '@cafeos/core';
import { resolveSystemPaths } from './system/paths';

const TTL_MS = 15_000;
const configCache = new Map<string, { config: ModuleSystemConfig; at: number }>();

function getLocalConfigPath(): string {
  try {
    const paths = resolveSystemPaths();
    return path.join(paths.configDir, 'modules-config.json');
  } catch {
    return path.resolve(process.cwd(), '.chayaone-data', 'config', 'modules-config.json');
  }
}

export function readLocalModuleConfigFile(): ModuleSystemConfig | null {
  const filePath = getLocalConfigPath();
  if (!fs.existsSync(filePath)) return null;
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(content);
    if (parsed && Array.isArray(parsed.enabledModules)) {
      return {
        businessType: parsed.businessType || 'cafe',
        enabledModules: resolveModuleDependencies(parsed.enabledModules),
        installedModules: Object.keys(MODULE_REGISTRY) as ModuleId[],
        updatedAt: parsed.updatedAt || new Date().toISOString(),
        version: parsed.version || '1.2.0',
        moduleSettings: parsed.moduleSettings || {},
      };
    }
  } catch (err) {
    console.warn('[MODULES] Failed to parse modules-config.json:', err);
  }
  return null;
}

export function writeLocalModuleConfigFile(config: ModuleSystemConfig): void {
  const filePath = getLocalConfigPath();
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf8');
  } catch (err) {
    console.warn('[MODULES] Failed to write modules-config.json:', err);
  }
}

/**
 * Reads module settings from environment variables if present.
 */
function readEnvModuleConfig(): ModuleSystemConfig | null {
  const envBusiness = process.env.CHAYAONE_BUSINESS_TYPE as BusinessTypeId | undefined;
  const envModulesStr = process.env.CHAYAONE_ENABLED_MODULES;

  if (envBusiness || envModulesStr) {
    const businessType: BusinessTypeId =
      envBusiness && BUSINESS_PRESETS[envBusiness] ? envBusiness : 'cafe';
    let enabledModules: ModuleId[] = [];

    if (envModulesStr) {
      enabledModules = envModulesStr
        .split(',')
        .map((m) => m.trim().toLowerCase() as ModuleId)
        .filter((m) => !!MODULE_REGISTRY[m]);
    } else {
      enabledModules = BUSINESS_PRESETS[businessType]?.defaultModules || ['core', 'cafe'];
    }

    return {
      businessType,
      enabledModules: resolveModuleDependencies(enabledModules),
      installedModules: Object.keys(MODULE_REGISTRY) as ModuleId[],
      updatedAt: new Date().toISOString(),
      version: '1.2.0',
      moduleSettings: {},
    };
  }
  return null;
}

/**
 * Retrieve the active module configuration for an outlet (or default).
 */
export async function getModuleConfig(outletId?: string): Promise<ModuleSystemConfig> {
  const cacheKey = outletId || 'default';
  const hit = configCache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return hit.config;
  }

  // 1. Try PostgreSQL Outlet.settings.modules if outletId is available
  if (outletId) {
    try {
      const outlet = await prisma.outlet.findUnique({
        where: { id: outletId },
        select: { settings: true },
      });

      const settings = (outlet?.settings ?? {}) as Record<string, any>;
      const modSettings = settings.modules;

      if (modSettings && Array.isArray(modSettings.enabledModules)) {
        const config: ModuleSystemConfig = {
          businessType: modSettings.businessType || 'cafe',
          enabledModules: resolveModuleDependencies(modSettings.enabledModules),
          installedModules: Object.keys(MODULE_REGISTRY) as ModuleId[],
          updatedAt: modSettings.updatedAt || new Date().toISOString(),
          version: modSettings.version || '1.2.0',
          moduleSettings: modSettings.moduleSettings || {},
        };
        configCache.set(cacheKey, { config, at: Date.now() });
        return config;
      }
    } catch {
      // Fall through to file/env config if DB query fails
    }
  }

  // 2. Try local modules-config.json file
  const fileConfig = readLocalModuleConfigFile();
  if (fileConfig) {
    configCache.set(cacheKey, { config: fileConfig, at: Date.now() });
    return fileConfig;
  }

  // 3. Try environment variables
  const envConfig = readEnvModuleConfig();
  if (envConfig) {
    configCache.set(cacheKey, { config: envConfig, at: Date.now() });
    return envConfig;
  }

  // 4. Default fallback: Cafe preset
  const defaultConfig = createDefaultModuleConfig('cafe');
  configCache.set(cacheKey, { config: defaultConfig, at: Date.now() });
  return defaultConfig;
}

/**
 * Check if a specific module is currently enabled for an outlet.
 * Core POS is ALWAYS enabled.
 */
export async function isModuleEnabled(moduleId: ModuleId, outletId?: string): Promise<boolean> {
  if (moduleId === 'core') return true;
  const config = await getModuleConfig(outletId);
  return config.enabledModules.includes(moduleId);
}

/**
 * Mutate the module configuration for an outlet (Owner / Admin only).
 * Non-destructive: Existing database tables and rows are completely retained.
 */
export async function setModuleConfig(
  outletId: string,
  patch: {
    businessType?: BusinessTypeId;
    enabledModules?: ModuleId[];
    moduleSettings?: Record<string, Record<string, unknown>>;
  },
): Promise<ModuleSystemConfig> {
  const current = await getModuleConfig(outletId);

  let newBusinessType: BusinessTypeId = patch.businessType || current.businessType;
  if (!BUSINESS_PRESETS[newBusinessType]) {
    newBusinessType = 'cafe';
  }

  let requestedModules: ModuleId[];
  if (patch.enabledModules) {
    requestedModules = patch.enabledModules;
  } else if (patch.businessType && patch.businessType !== current.businessType) {
    // If business type changed without explicit modules, apply preset
    requestedModules = BUSINESS_PRESETS[newBusinessType].defaultModules;
  } else {
    requestedModules = current.enabledModules;
  }

  // Auto-resolve dependencies and ensure core is active
  const resolved = resolveModuleDependencies(requestedModules);

  // Validate disabling rules against the final set
  for (const mod of current.enabledModules) {
    if (!resolved.includes(mod)) {
      const check = canDisableModule(mod, resolved);
      if (!check.canDisable) {
        throw new Error(check.reason);
      }
    }
  }

  const newConfig: ModuleSystemConfig = {
    businessType: newBusinessType,
    enabledModules: resolved,
    installedModules: Object.keys(MODULE_REGISTRY) as ModuleId[],
    updatedAt: new Date().toISOString(),
    version: '1.2.0',
    moduleSettings: { ...(current.moduleSettings || {}), ...(patch.moduleSettings || {}) },
  };

  // 1. Update PostgreSQL
  try {
    const outlet = await prisma.outlet.findUnique({
      where: { id: outletId },
      select: { settings: true },
    });
    const existingSettings = ((outlet?.settings as Record<string, unknown>) ?? {});
    const mergedSettings = {
      ...existingSettings,
      modules: newConfig,
    };
    await prisma.outlet.update({
      where: { id: outletId },
      data: { settings: mergedSettings as unknown as Prisma.InputJsonValue },
    });
  } catch (err) {
    console.error('[MODULES] Failed to save module config to database:', err);
  }

  // 2. Synchronize to local config file
  writeLocalModuleConfigFile(newConfig);

  // 3. Invalidate caches
  configCache.delete(outletId);
  configCache.delete('default');

  return newConfig;
}

/**
 * Reusable Next.js API route guard.
 * Returns 403 MODULE_NOT_ENABLED if the requested module is inactive.
 */
export async function requireModule(
  moduleId: ModuleId,
  outletId?: string,
): Promise<{ ok: boolean; response?: NextResponse }> {
  if (moduleId === 'core') return { ok: true };

  const enabled = await isModuleEnabled(moduleId, outletId);
  if (!enabled) {
    const meta = MODULE_REGISTRY[moduleId];
    const moduleName = meta?.name || moduleId;
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'MODULE_NOT_ENABLED',
          module: moduleId,
          message: `The ${moduleName} module is currently disabled for this venue. It can be enabled in Settings → Modules without reinstalling.`,
        },
        { status: 403 },
      ),
    };
  }

  return { ok: true };
}

/**
 * Returns full module state payload for administration UI.
 */
export async function getModuleStatePayload(outletId?: string): Promise<ModuleStatePayload> {
  const config = await getModuleConfig(outletId);
  return {
    config,
    availableModules: Object.values(MODULE_REGISTRY),
    presets: Object.values(BUSINESS_PRESETS),
  };
}
