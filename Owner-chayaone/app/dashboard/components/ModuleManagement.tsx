'use client';

import React, { useState, useMemo } from 'react';
import {
  Store, CheckCircle2, AlertCircle, ShieldAlert, Sparkles, RefreshCw,
  Package, ChefHat, Users, Smartphone, BarChart3, HelpCircle, Layers,
  ChevronRight, ArrowRight, Info, Sliders, Check
} from 'lucide-react';
import type {
  ModuleId,
  BusinessTypeId,
  ModuleMetadata,
  ModuleSystemConfig,
  BusinessPresetDef,
} from '@cafeos/types';
import {
  MODULE_REGISTRY,
  BUSINESS_PRESETS,
  resolveModuleDependencies,
  canDisableModule,
} from '@cafeos/core';

interface ModuleManagementProps {
  moduleConfig: ModuleSystemConfig;
  onConfigUpdated: (newConfig: ModuleSystemConfig) => void;
  flashMessage?: (msg: string) => void;
}

const MODULE_ICONS: Record<ModuleId, React.ComponentType<any>> = {
  core: Store,
  cafe: Store,
  restaurant: ChefHat,
  hotel: Layers,
  juice: Sparkles,
  meals: ChefHat,
  inventory: Package,
  customer_qr: Smartphone,
  waiter: Users,
  kds: ChefHat,
  crm: Users,
  loyalty: Sparkles,
  advanced_reports: BarChart3,
};

export default function ModuleManagement({
  moduleConfig,
  onConfigUpdated,
  flashMessage,
}: ModuleManagementProps) {
  const [businessType, setBusinessType] = useState<BusinessTypeId>(moduleConfig.businessType || 'cafe');
  const [enabledModules, setEnabledModules] = useState<ModuleId[]>(
    resolveModuleDependencies(moduleConfig.enabledModules || ['core', 'cafe'])
  );
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'business' | 'operations' | 'engagement' | 'intelligence'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const allModules = useMemo(() => Object.values(MODULE_REGISTRY), []);
  const presets = useMemo(() => Object.values(BUSINESS_PRESETS), []);

  const hasChanges = useMemo(() => {
    if (businessType !== moduleConfig.businessType) return true;
    const curSet = new Set(moduleConfig.enabledModules);
    const newSet = new Set(enabledModules);
    if (curSet.size !== newSet.size) return true;
    for (const m of curSet) if (!newSet.has(m)) return true;
    return false;
  }, [businessType, enabledModules, moduleConfig]);

  const handleApplyPreset = (presetId: BusinessTypeId) => {
    const preset = BUSINESS_PRESETS[presetId];
    if (!preset) return;
    setBusinessType(presetId);
    const resolved = resolveModuleDependencies(preset.defaultModules);
    setEnabledModules(resolved);
    setErrorMessage(null);
    if (flashMessage) flashMessage(`Applied preset: ${preset.name}`);
  };

  const handleToggleModule = (moduleId: ModuleId) => {
    setErrorMessage(null);
    if (moduleId === 'core') {
      setErrorMessage('Core POS & System Infrastructure is mandatory and cannot be disabled.');
      return;
    }

    if (enabledModules.includes(moduleId)) {
      // Trying to disable
      const check = canDisableModule(moduleId, enabledModules);
      if (!check.canDisable) {
        setErrorMessage(check.reason || `Cannot disable ${moduleId}`);
        return;
      }
      setEnabledModules((prev) => prev.filter((id) => id !== moduleId));
      if (businessType !== 'custom') {
        setBusinessType('custom');
      }
    } else {
      // Enabling
      const nextModules = [...enabledModules, moduleId];
      const resolved = resolveModuleDependencies(nextModules);
      setEnabledModules(resolved);
      if (businessType !== 'custom') {
        setBusinessType('custom');
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/dashboard/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'modules_update',
          businessType,
          enabledModules,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message || data.error || 'Failed to update modules');
      }

      onConfigUpdated(data.config);
      if (flashMessage) flashMessage('Module configuration successfully updated!');
    } catch (err: any) {
      setErrorMessage(err.message || 'Error updating module settings');
    } finally {
      setSaving(false);
    }
  };

  const filteredModules = useMemo(() => {
    return allModules.filter((m) => {
      if (selectedFilter !== 'all' && m.category !== selectedFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          m.name.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q) ||
          m.id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allModules, selectedFilter, searchQuery]);

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl border" style={{ background: 'var(--paper-2)', borderColor: 'var(--line)' }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider" style={{ background: 'var(--paper-3)', color: 'var(--turmeric)' }}>
                ChayaOne Architecture
              </span>
              <span className="text-xs opacity-60">Unified Platform v1.2.0</span>
            </div>
            <h2 className="text-2xl font-display font-bold">Business Modules & Feature Configuration</h2>
            <p className="text-sm opacity-80 mt-1 max-w-2xl">
              Tailor ChayaOne to your specific operational format. Enable or disable modules on-demand without reinstalling.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="btn btn-primary px-5 py-2.5 rounded-xl font-semibold shadow-md flex items-center gap-2"
            >
              {saving ? <RefreshCw className="animate-spin" size={16} /> : <Check size={16} />}
              {saving ? 'Saving...' : hasChanges ? 'Save Changes' : 'All Changes Saved'}
            </button>
          </div>
        </div>

        {/* Non-Destructive Data Retention Notice */}
        <div className="mt-4 p-3.5 rounded-xl flex items-start gap-3 text-xs leading-relaxed" style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', color: '#059669' }}>
          <Info size={16} className="shrink-0 mt-0.5" />
          <div>
            <b>Non-Destructive Guarantee:</b> Disabling a module hides its menus and blocks unauthorized API access, but <b>never deletes your data</b>. When re-enabled later, your historical records, recipes, and logs become immediately accessible.
          </div>
        </div>

        {errorMessage && (
          <div className="mt-3 p-3.5 rounded-xl flex items-start gap-3 text-xs leading-relaxed" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#dc2626' }}>
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div><b>Action Blocked:</b> {errorMessage}</div>
          </div>
        )}
      </div>

      {/* Business Preset Selector */}
      <div className="p-5 rounded-2xl border flex flex-col gap-3" style={{ background: 'var(--paper-2)', borderColor: 'var(--line)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base flex items-center gap-2">
              <Sliders size={18} style={{ color: 'var(--turmeric)' }} />
              Business Type Presets
            </h3>
            <p className="text-xs opacity-70">
              Select a standard profile to automatically configure the recommended module suite.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg border" style={{ borderColor: 'var(--line)', background: 'var(--paper-1)' }}>
            Active Profile: <b className="capitalize text-amber-500">{businessType.replace('_', ' ')}</b>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 mt-1">
          {presets.map((preset) => {
            const isSelected = businessType === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleApplyPreset(preset.id)}
                className="flex flex-col p-3 rounded-xl text-left border transition-all relative overflow-hidden"
                style={{
                  background: isSelected ? 'var(--paper-3)' : 'var(--paper-1)',
                  borderColor: isSelected ? 'var(--turmeric)' : 'var(--line)',
                  boxShadow: isSelected ? '0 0 0 1px var(--turmeric)' : 'none',
                }}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="font-semibold text-xs tracking-tight">{preset.name}</span>
                  {isSelected && <CheckCircle2 size={14} className="text-amber-500" />}
                </div>
                <span className="text-[11px] opacity-70 line-clamp-2 leading-snug">{preset.description}</span>
                <div className="mt-2 text-[10px] opacity-60 font-mono">
                  {preset.defaultModules.length} module{preset.defaultModules.length > 1 ? 's' : ''}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Modules Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 rounded-xl border w-full sm:w-auto" style={{ background: 'var(--paper-2)', borderColor: 'var(--line)' }}>
          {(['all', 'business', 'operations', 'engagement', 'intelligence'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedFilter(cat)}
              className="px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors"
              style={{
                background: selectedFilter === cat ? 'var(--paper-3)' : 'transparent',
                color: selectedFilter === cat ? 'var(--turmeric)' : 'inherit',
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Search modules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs px-3 py-2 rounded-xl border outline-none"
            style={{ background: 'var(--paper-2)', borderColor: 'var(--line)' }}
          />
        </div>
      </div>

      {/* Module Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {filteredModules.map((mod) => {
          const Icon = MODULE_ICONS[mod.id] || Store;
          const isEnabled = enabledModules.includes(mod.id);
          const isCore = mod.id === 'core';

          return (
            <div
              key={mod.id}
              className="p-4 rounded-2xl border flex flex-col justify-between transition-all"
              style={{
                background: 'var(--paper-2)',
                borderColor: isEnabled ? (isCore ? 'var(--line)' : 'var(--line)') : 'var(--line)',
                opacity: isEnabled ? 1 : 0.75,
              }}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background: isEnabled ? 'var(--paper-3)' : 'var(--paper-1)',
                        color: isEnabled ? 'var(--turmeric)' : 'var(--ink-3)',
                      }}
                    >
                      <Icon size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm">{mod.name}</h4>
                        <span className="text-[10px] font-mono opacity-50">v{mod.version}</span>
                      </div>
                      <span className="text-[10px] font-medium uppercase tracking-wider opacity-60">
                        {mod.category}
                      </span>
                    </div>
                  </div>

                  {/* Toggle Switch or Required Badge */}
                  <div className="shrink-0">
                    {isCore ? (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        Required
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleToggleModule(mod.id)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          isEnabled ? 'bg-amber-500' : 'bg-slate-300'
                        }`}
                        role="switch"
                        aria-checked={isEnabled}
                      >
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                            isEnabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs opacity-75 leading-relaxed mb-3">
                  {mod.description}
                </p>
              </div>

              <div className="pt-2.5 border-t flex items-center justify-between text-[11px] opacity-60" style={{ borderColor: 'var(--line)' }}>
                <span>
                  {mod.dependencies.length > 0 ? (
                    <>Dependencies: <b className="font-mono">{mod.dependencies.join(', ')}</b></>
                  ) : (
                    'Standalone module'
                  )}
                </span>
                <span className={`font-semibold ${isEnabled ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {isEnabled ? '● Active' : '○ Disabled'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
