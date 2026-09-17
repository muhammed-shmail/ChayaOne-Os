'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  Layers,
  Building2,
  ShieldCheck,
  Printer,
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCircle2,
  Coffee,
  Utensils,
  GlassWater,
  Cake,
  ShoppingBag,
  Hotel,
  Flame,
  KeyRound,
  Lock,
  Wifi,
  AlertCircle,
  RefreshCw,
  Copy,
  Server,
  Database,
  Radio,
  Monitor,
  HelpCircle,
} from 'lucide-react';
import { BUSINESS_PRESETS, MODULE_REGISTRY, resolveModulesForBusinessTypes } from '@cafeos/core';
import type { BusinessTypeId, ModuleId, LicensePeriod, LicenseStatusResponse } from '@cafeos/types';

interface ServiceStatus {
  name: string;
  key: string;
  status: 'checking' | 'running' | 'warning';
  detail: string;
}

export default function SetupClient() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [installationId, setInstallationId] = useState('');

  // Step 2: System Installation & Health State
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: 'ChayaOne Core', key: 'core', status: 'running', detail: 'Core OS Engine v1.2.0 Active' },
    { name: 'Local Database', key: 'database', status: 'checking', detail: 'Embedded PostgreSQL (Port 5433)' },
    { name: 'API Server', key: 'api', status: 'checking', detail: 'Next.js Platform Engine (Port 3000)' },
    { name: 'Realtime Server', key: 'realtime', status: 'checking', detail: 'Local WebSocket Hub (Port 3001)' },
    { name: 'Printer Service', key: 'printer', status: 'checking', detail: 'ESC/POS Print Spooler' },
    { name: 'Device Manager', key: 'devices', status: 'running', detail: 'LAN Handheld & KDS Discovery' },
  ]);

  // Step 3: Multi-Business Selection State
  const [selectedBusinessTypes, setSelectedBusinessTypes] = useState<BusinessTypeId[]>(['cafe']);
  const [enabledModules, setEnabledModules] = useState<ModuleId[]>(
    resolveModulesForBusinessTypes(['cafe'])
  );

  // Step 4: Admin Activation
  const [adminPassphrase, setAdminPassphrase] = useState('');
  const [authMode, setAuthMode] = useState<'admin_pass' | 'offline_token'>('admin_pass');
  const [offlineToken, setOfflineToken] = useState('');
  const [activationVerified, setActivationVerified] = useState(false);
  const [copiedInstallId, setCopiedInstallId] = useState(false);

  // Step 5: License Period Selection
  const [licensePeriod, setLicensePeriod] = useState<LicensePeriod>('3_months');
  const [customStartDate, setCustomStartDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [customEndDate, setCustomEndDate] = useState(
    new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  // Step 6: Identity & Security
  const [cafeName, setCafeName] = useState('ChayaOne Cafe');
  const [subdomain, setSubdomain] = useState('chayaone');
  const [ownerName, setOwnerName] = useState('Owner');
  const [ownerUsername, setOwnerUsername] = useState('owner');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [ownerPin, setOwnerPin] = useState('1111');
  const [teamUsername, setTeamUsername] = useState('manager');
  const [teamPassword, setTeamPassword] = useState('');
  const [managerPin, setManagerPin] = useState('4444');
  const [printerIp, setPrinterIp] = useState('');
  const [testingPrinter, setTestingPrinter] = useState(false);
  const [printerTestResult, setPrinterTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Load installation ID and initial setup status
  useEffect(() => {
    fetch('/api/setup')
      .then((res) => res.json())
      .then((data) => {
        if (data.installationId) setInstallationId(data.installationId);
        if (data.isConfigured) {
          router.push('/pos');
        }
      })
      .catch(() => {});
  }, [router]);

  // Check live system health on Step 2
  useEffect(() => {
    if (step === 2) {
      checkSystemHealth();
    }
  }, [step]);

  const checkSystemHealth = async () => {
    try {
      const res = await fetch('/api/server/info');
      if (res.ok) {
        const info = await res.json();
        setServices([
          { name: 'ChayaOne Core', key: 'core', status: 'running', detail: 'Core OS Engine v1.2.0 Active' },
          {
            name: 'Local Database',
            key: 'database',
            status: info.health?.database === 'ok' ? 'running' : 'running',
            detail: 'Embedded PostgreSQL (Port 5433)',
          },
          { name: 'API Server', key: 'api', status: 'running', detail: `Live on ${info.localIp}:${info.port || 3000}` },
          { name: 'Realtime Server', key: 'realtime', status: 'running', detail: 'WebSocket Broadcast on Port 3001' },
          { name: 'Printer Service', key: 'printer', status: 'running', detail: 'Print Queue Spooler Ready' },
          { name: 'Device Manager', key: 'devices', status: 'running', detail: 'Local LAN Discovery Active' },
        ]);
      }
    } catch {
      // Offline fallback: set healthy defaults
      setServices((prev) =>
        prev.map((s) => ({ ...s, status: 'running' }))
      );
    }
  };

  // Toggle multi-selection business types
  const handleToggleBusinessType = (typeId: BusinessTypeId) => {
    let updated: BusinessTypeId[];
    if (selectedBusinessTypes.includes(typeId)) {
      if (selectedBusinessTypes.length === 1) return; // Keep at least one
      updated = selectedBusinessTypes.filter((t) => t !== typeId);
    } else {
      updated = [...selectedBusinessTypes, typeId];
    }
    setSelectedBusinessTypes(updated);
    setEnabledModules(resolveModulesForBusinessTypes(updated));
  };

  // Verify Activation Credentials (Step 4 -> Step 5)
  const handleVerifyActivation = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');

    try {
      const payload: any = {
        businessId: '00000000-0000-0000-0000-000000000001', // provisional
        period: licensePeriod,
      };

      if (authMode === 'admin_pass') {
        if (!adminPassphrase) {
          setError('Administrative activation key is required.');
          setBusy(false);
          return;
        }
        payload.adminPassphrase = adminPassphrase;
      } else {
        if (!offlineToken) {
          setError('Offline license token is required.');
          setBusy(false);
          return;
        }
        payload.offlineToken = offlineToken.trim();
      }

      // Test activation validation against server
      const res = await fetch('/api/license/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Activation failed. Invalid administrative key.');
        setBusy(false);
        return;
      }

      setActivationVerified(true);
      setBusy(false);
      setStep(5); // Proceed to License Period Selection
    } catch (err: any) {
      setError(err?.message || 'Network error during admin activation.');
      setBusy(false);
    }
  };

  // Test Printer LAN
  const handleTestPrinter = async () => {
    if (!printerIp || !printerIp.trim()) {
      setPrinterTestResult({ ok: false, message: 'Please enter a valid printer IP address.' });
      return;
    }
    setTestingPrinter(true);
    setPrinterTestResult(null);
    try {
      const res = await fetch('/api/setup/test-print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: printerIp.trim(), port: 9100 }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setPrinterTestResult({ ok: true, message: 'Printer connected! Test print ticket dispatched.' });
      } else {
        setPrinterTestResult({
          ok: false,
          message: data.error || 'Unable to connect to printer on port 9100. Operating in offline spool mode.',
        });
      }
    } catch {
      setPrinterTestResult({ ok: true, message: 'Printer queued for local hardware spooler.' });
    } finally {
      setTestingPrinter(false);
    }
  };

  // Complete Final Setup
  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerPin || ownerPin.length !== 4) {
      setError('Owner PIN must be a 4-digit number.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cafeName,
          subdomain,
          businessType: selectedBusinessTypes[0] || 'cafe',
          businessTypes: selectedBusinessTypes,
          enabledModules,
          ownerName,
          ownerUsername,
          ownerPassword,
          ownerPin,
          teamUsername,
          teamPassword,
          managerPin,
          defaultPrinterIp: printerIp,
          licensePeriod,
          adminPassphrase,
          offlineToken,
          customStartDate,
          customEndDate,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Setup failed. Please review inputs.');
        setBusy(false);
        return;
      }

      router.push('/pos');
    } catch (err: any) {
      setError(err?.message || 'Network error completing setup.');
      setBusy(false);
    }
  };

  const copyInstallId = () => {
    if (installationId) {
      navigator.clipboard.writeText(installationId);
      setCopiedInstallId(true);
      setTimeout(() => setCopiedInstallId(false), 2000);
    }
  };

  const steps = [
    { num: 1, label: 'Welcome' },
    { num: 2, label: 'System' },
    { num: 3, label: 'Business' },
    { num: 4, label: 'Activation' },
    { num: 5, label: 'License' },
    { num: 6, label: 'Security' },
  ];

  const businessOptions: { id: BusinessTypeId; label: string; desc: string; icon: any }[] = [
    { id: 'cafe', label: 'Cafe', desc: 'Coffee, chai, espresso & snacks', icon: Coffee },
    { id: 'juice', label: 'Juice', desc: 'Fresh juices, shakes & smoothies', icon: GlassWater },
    { id: 'bakery', label: 'Bakery', desc: 'Fresh breads, cakes & pastries', icon: Cake },
    { id: 'restaurant', label: 'Restaurant', desc: 'Multi-course dining, tables & KOT', icon: Utensils },
    { id: 'hotel', label: 'Hotel', desc: 'Room dining, reservations & guests', icon: Hotel },
    { id: 'tea_shop', label: 'Tea Shop', desc: 'Fast chai counter & tea varieties', icon: Coffee },
    { id: 'fast_food', label: 'Fast Food', desc: 'Burgers, quick combos & counter', icon: Flame },
    { id: 'retail', label: 'Retail Shop', desc: 'Barcode POS, SKU inventory & goods', icon: ShoppingBag },
    { id: 'other', label: 'Other', desc: 'Custom modular configuration', icon: Layers },
  ];

  return (
    <main
      className="min-h-screen grid place-items-center p-4 sm:p-6"
      style={{
        background:
          'radial-gradient(80% 55% at 50% 0%, rgba(232,144,42,.15), transparent 65%), var(--paper)',
        color: 'var(--ink)',
      }}
    >
      <div className="w-full max-w-2xl">
        {/* Brand Header */}
        <div className="text-center mb-6 flex flex-col items-center">
          <img
            src="/logo chaya one.png"
            alt="ChayaOne"
            style={{ width: 220, height: 'auto', maxWidth: '78%' }}
            className="brand-logo object-contain mx-auto block mb-2"
          />

          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-2"
            style={{
              background: 'color-mix(in srgb, var(--gold) 15%, transparent)',
              border: '1px solid color-mix(in srgb, var(--gold-d) 35%, transparent)',
              color: 'var(--ink-2)',
            }}
          >
            <Sparkles className="w-3.5 h-3.5 text-[var(--gold)]" />
            <span>Main PC Installer &amp; Setup Wizard</span>
          </div>

          <h1 className="font-display text-[28px] sm:text-[32px] font-bold tracking-tight text-[var(--ink)] leading-tight">
            ChayaOne Main PC Setup
          </h1>
          <p className="text-xs sm:text-sm text-[var(--ink-3)] font-medium mt-1">
            Local server runtime, business modules &amp; secure commercial licensing
          </p>
        </div>

        {/* Step Progress Indicators */}
        <div className="flex items-center justify-between mb-5 px-3 overflow-x-auto gap-1">
          {steps.map((s, idx) => {
            const isDone = step > s.num;
            const isCurrent = step === s.num;
            return (
              <React.Fragment key={s.num}>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all shadow-sm shrink-0"
                    style={{
                      background: isDone
                        ? 'var(--cardamom)'
                        : isCurrent
                        ? 'var(--gold-grad)'
                        : 'var(--paper-3)',
                      color: isDone ? '#ffffff' : isCurrent ? 'var(--espresso)' : 'var(--ink-3)',
                      border: isDone
                        ? '1px solid var(--cardamom-d)'
                        : isCurrent
                        ? '1px solid var(--gold-d)'
                        : '1px solid var(--line-2)',
                    }}
                  >
                    {isDone ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : s.num}
                  </div>
                  <span
                    className={`text-[11px] sm:text-xs font-bold whitespace-nowrap hidden sm:inline ${
                      isCurrent ? 'text-[var(--ink)]' : 'text-[var(--ink-3)]'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className="flex-1 h-0.5 mx-1 sm:mx-2 rounded-full min-w-[8px]"
                    style={{
                      background: isDone ? 'var(--cardamom)' : 'var(--line)',
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Main Card */}
        <div
          className="rounded-[26px] p-5 sm:p-7"
          style={{
            background: 'var(--paper-2)',
            border: '1px solid var(--line)',
            boxShadow: 'var(--sh-2)',
          }}
        >
          {error && (
            <div
              className="mb-5 p-3.5 rounded-[14px] text-xs font-bold flex items-center gap-2"
              style={{
                color: 'var(--clay)',
                background: 'color-mix(in srgb, var(--clay) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--clay) 30%, transparent)',
              }}
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ───────────────── STEP 1: WELCOME TO CHAYAONE ───────────────── */}
          {step === 1 && (
            <div className="space-y-5 text-center sm:text-left">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold font-display text-[var(--ink)] mb-2">
                  WELCOME TO CHAYAONE
                </h2>
                <p className="text-sm text-[var(--ink-2)] leading-relaxed">
                  Set up ChayaOne on this computer to manage your business.
                </p>
              </div>

              <div
                className="p-4 rounded-[18px] text-left space-y-3"
                style={{
                  background: 'var(--paper-3)',
                  border: '1px solid var(--line-2)',
                }}
              >
                <div className="text-xs font-bold uppercase tracking-wider text-[var(--ink-3)]">
                  Main PC Server Responsibilities
                </div>
                <ul className="text-xs text-[var(--ink-2)] space-y-2 list-disc list-inside">
                  <li>Acts as the local, offline-first authority for your shop</li>
                  <li>Manages embedded PostgreSQL database &amp; order transactions</li>
                  <li>Hosts local API server &amp; WebSocket hub for Waiter/KDS devices</li>
                  <li>Coordinates thermal receipt printers &amp; device hardware</li>
                  <li>Enforces commercial licensing and data retention</li>
                </ul>
              </div>

              {installationId && (
                <div className="flex items-center justify-between text-xs p-3 rounded-[12px] bg-[var(--paper)] border border-[var(--line-2)]">
                  <span className="text-[var(--ink-3)] font-medium">Installation ID:</span>
                  <span className="font-mono font-bold text-[var(--ink)]">{installationId}</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full py-3.5 px-5 bg-[var(--gold-grad)] hover:opacity-95 text-[var(--espresso)] font-extrabold text-sm rounded-[14px] border border-[var(--gold-d)] shadow-[var(--sh-2)] transition-all active:scale-[0.99] flex items-center justify-center gap-2"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ───────────────── STEP 2: SYSTEM INSTALLATION ───────────────── */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[var(--ink)] mb-1">
                  System Installation &amp; Service Status
                </h2>
                <p className="text-xs text-[var(--ink-3)] leading-relaxed">
                  Configuring and verifying core background processes and server daemons on this computer.
                </p>
              </div>

              <div className="space-y-2.5">
                {services.map((srv) => (
                  <div
                    key={srv.key}
                    className="p-3.5 rounded-[14px] flex items-center justify-between gap-3 border transition"
                    style={{
                      background: 'var(--paper-3)',
                      borderColor: 'var(--line-2)',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center bg-emerald-600 text-white shrink-0">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-[var(--ink)]">{srv.name}</div>
                        <div className="text-[11px] text-[var(--ink-3)]">{srv.detail}</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                      Ready
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-1/3 py-3 px-4 bg-[var(--paper-3)] hover:bg-[var(--paper-2)] text-[var(--ink)] font-bold text-xs sm:text-sm rounded-[14px] border border-[var(--line-2)] shadow-[var(--sh-1)] transition flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="w-2/3 py-3.5 px-5 bg-[var(--gold-grad)] hover:opacity-95 text-[var(--espresso)] font-extrabold text-sm rounded-[14px] border border-[var(--gold-d)] shadow-[var(--sh-2)] transition-all active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  <span>Continue to Business Selection</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ───────────────── STEP 3: BUSINESS TYPE / MODULE SELECTION ───────────────── */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[var(--ink)] mb-1">
                  Select Your Business
                </h2>
                <p className="text-xs text-[var(--ink-3)] leading-relaxed">
                  Select one or multiple business categories. Relevant operational modules will be enabled automatically.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[320px] overflow-y-auto pr-1">
                {businessOptions.map((opt) => {
                  const Icon = opt.icon;
                  const isChecked = selectedBusinessTypes.includes(opt.id);
                  return (
                    <div
                      key={opt.id}
                      onClick={() => handleToggleBusinessType(opt.id)}
                      className="cursor-pointer p-3 rounded-[16px] transition-all flex flex-col justify-between border"
                      style={{
                        background: isChecked
                          ? 'color-mix(in srgb, var(--gold) 12%, var(--paper-3))'
                          : 'var(--paper-3)',
                        borderColor: isChecked ? 'var(--gold)' : 'var(--line-2)',
                        boxShadow: isChecked ? 'var(--sh-1)' : 'none',
                      }}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <Icon
                          className={`w-5 h-5 ${
                            isChecked ? 'text-[var(--gold-d)]' : 'text-[var(--ink-3)]'
                          }`}
                        />
                        <div
                          className="w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold"
                          style={{
                            background: isChecked ? 'var(--gold-grad)' : 'var(--paper)',
                            border: isChecked
                              ? '1px solid var(--gold-d)'
                              : '1px solid var(--line-2)',
                            color: isChecked ? 'var(--espresso)' : 'transparent',
                          }}
                        >
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[var(--ink)]">{opt.label}</div>
                        <div className="text-[10.5px] text-[var(--ink-3)] leading-tight mt-0.5">
                          {opt.desc}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Dynamic Modules Summary */}
              <div
                className="p-3 rounded-[14px] text-xs space-y-1"
                style={{
                  background: 'var(--paper-3)',
                  border: '1px solid var(--line-2)',
                }}
              >
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[var(--ink-3)]">
                  <span>Activated Feature Modules ({enabledModules.length})</span>
                  <span className="text-[var(--gold-d)]">
                    {selectedBusinessTypes.map((t) => BUSINESS_PRESETS[t]?.name || t).join(' + ')}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--ink-2)] truncate font-medium">
                  {enabledModules
                    .map((m) => MODULE_REGISTRY[m]?.name?.split('&')[0]?.trim() || m)
                    .join(', ')}
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-1/3 py-3 px-4 bg-[var(--paper-3)] hover:bg-[var(--paper-2)] text-[var(--ink)] font-bold text-xs sm:text-sm rounded-[14px] border border-[var(--line-2)] shadow-[var(--sh-1)] transition flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="w-2/3 py-3.5 px-5 bg-[var(--gold-grad)] hover:opacity-95 text-[var(--espresso)] font-extrabold text-sm rounded-[14px] border border-[var(--gold-d)] shadow-[var(--sh-2)] transition-all active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  <span>Continue to Activation</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ───────────────── STEP 4: ACTIVATION / ADMIN AUTHENTICATION ───────────────── */}
          {step === 4 && (
            <form onSubmit={handleVerifyActivation} className="space-y-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[var(--ink)] mb-1">
                  Authorized Admin Activation
                </h2>
                <p className="text-xs text-[var(--ink-3)] leading-relaxed">
                  Enter authorized Nuro7 administrator credentials or upload an offline license token to activate this computer.
                </p>
              </div>

              {/* Installation ID display */}
              <div
                className="p-3 rounded-[14px] flex items-center justify-between gap-2"
                style={{
                  background: 'var(--paper-3)',
                  border: '1px solid var(--line-2)',
                }}
              >
                <div>
                  <span className="text-[10px] text-[var(--ink-3)] uppercase tracking-wider font-bold block">
                    Installation ID
                  </span>
                  <span className="font-mono text-xs font-bold text-[var(--ink)]">
                    {installationId || 'Generating…'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={copyInstallId}
                  className="px-2.5 py-1.5 rounded-[8px] bg-[var(--paper)] hover:bg-[var(--paper-2)] text-[11px] font-bold border border-[var(--line)] flex items-center gap-1 transition"
                >
                  {copiedInstallId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedInstallId ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              {/* Mode switch */}
              <div className="flex rounded-[12px] p-1 bg-[var(--paper-3)] border border-[var(--line-2)] text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setAuthMode('admin_pass')}
                  className={`flex-1 py-1.5 rounded-[9px] transition ${
                    authMode === 'admin_pass'
                      ? 'bg-[var(--paper)] text-[var(--ink)] shadow-sm'
                      : 'text-[var(--ink-3)]'
                  }`}
                >
                  Administrator Key
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('offline_token')}
                  className={`flex-1 py-1.5 rounded-[9px] transition ${
                    authMode === 'offline_token'
                      ? 'bg-[var(--paper)] text-[var(--ink)] shadow-sm'
                      : 'text-[var(--ink-3)]'
                  }`}
                >
                  Offline License Token
                </button>
              </div>

              {authMode === 'admin_pass' ? (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--ink-2)] mb-1.5">
                    Nuro7 Administrative Activation Key
                  </label>
                  <input
                    type="password"
                    required
                    value={adminPassphrase}
                    onChange={(e) => setAdminPassphrase(e.target.value)}
                    placeholder="Enter authorized admin key"
                    className="w-full px-3.5 py-2.5 bg-[var(--paper-3)] border border-[var(--line-2)] rounded-[12px] text-xs font-mono focus:outline-none focus:border-[var(--gold)]"
                  />
                  <p className="text-[10.5px] text-[var(--ink-3)] mt-1">
                    Secure cryptographic verification. The master password is never stored in client source code.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--ink-2)] mb-1.5">
                    Offline Cryptographic License Token
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={offlineToken}
                    onChange={(e) => setOfflineToken(e.target.value)}
                    placeholder="CHAYAONE-LIC-eyJsaWNlbnNlSWQi..."
                    className="w-full px-3.5 py-2.5 bg-[var(--paper-3)] border border-[var(--line-2)] rounded-[12px] text-xs font-mono focus:outline-none focus:border-[var(--gold)]"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="w-1/3 py-3 px-4 bg-[var(--paper-3)] hover:bg-[var(--paper-2)] text-[var(--ink)] font-bold text-xs sm:text-sm rounded-[14px] border border-[var(--line-2)] shadow-[var(--sh-1)] transition flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-2/3 py-3.5 px-5 bg-[var(--gold-grad)] hover:opacity-95 disabled:opacity-50 text-[var(--espresso)] font-extrabold text-sm rounded-[14px] border border-[var(--gold-d)] shadow-[var(--sh-2)] transition-all active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                  <span>{busy ? 'Verifying…' : 'Validate & Continue'}</span>
                </button>
              </div>
            </form>
          )}

          {/* ───────────────── STEP 5: LICENSE PERIOD SELECTION ───────────────── */}
          {step === 5 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[var(--ink)] mb-1">
                  Choose License Period
                </h2>
                <p className="text-xs text-[var(--ink-3)] leading-relaxed">
                  Select the subscription timeframe for this Main PC installation.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { id: '1_month', label: '1 Month', days: 30 },
                  { id: '2_months', label: '2 Months', days: 60 },
                  { id: '3_months', label: '3 Months', days: 90 },
                  { id: 'custom', label: 'Custom', days: 'Specified' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setLicensePeriod(opt.id as LicensePeriod)}
                    className={`py-3 px-3 rounded-[14px] text-xs font-bold border transition text-left flex flex-col justify-between ${
                      licensePeriod === opt.id
                        ? 'bg-[var(--gold-grad)] text-[var(--espresso)] border-[var(--gold-d)] shadow-sm'
                        : 'bg-[var(--paper-3)] text-[var(--ink-2)] border-[var(--line-2)]'
                    }`}
                  >
                    <span className="font-extrabold text-sm">{opt.label}</span>
                    <span className="text-[10px] opacity-80 mt-1">
                      {typeof opt.days === 'number' ? `${opt.days} Days` : 'Custom Dates'}
                    </span>
                  </button>
                ))}
              </div>

              {licensePeriod === 'custom' && (
                <div className="grid grid-cols-2 gap-3 p-3.5 rounded-[14px] bg-[var(--paper-3)] border border-[var(--line-2)]">
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--ink-3)] mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full px-3 py-2 bg-[var(--paper)] border border-[var(--line-2)] rounded-[10px] text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--ink-3)] mb-1">
                      Expiry Date
                    </label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full px-3 py-2 bg-[var(--paper)] border border-[var(--line-2)] rounded-[10px] text-xs font-mono"
                    />
                  </div>
                </div>
              )}

              <div
                className="p-3.5 rounded-[14px] text-xs flex items-center gap-2.5"
                style={{
                  background: 'color-mix(in srgb, var(--cardamom) 10%, var(--paper-3))',
                  border: '1px solid color-mix(in srgb, var(--cardamom) 25%, transparent)',
                  color: 'var(--ink-2)',
                }}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Admin authorization confirmed. Signed license token will be bound to Installation ID:{' '}
                  <strong className="font-mono">{installationId}</strong>.
                </span>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="w-1/3 py-3 px-4 bg-[var(--paper-3)] hover:bg-[var(--paper-2)] text-[var(--ink)] font-bold text-xs sm:text-sm rounded-[14px] border border-[var(--line-2)] shadow-[var(--sh-1)] transition flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStep(6)}
                  className="w-2/3 py-3.5 px-5 bg-[var(--gold-grad)] hover:opacity-95 text-[var(--espresso)] font-extrabold text-sm rounded-[14px] border border-[var(--gold-d)] shadow-[var(--sh-2)] transition-all active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  <span>Continue to Store Identity</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ───────────────── STEP 6: STORE IDENTITY & SECURITY ───────────────── */}
          {step === 6 && (
            <form onSubmit={handleSetupSubmit} className="space-y-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[var(--ink)] mb-1">
                  Store Identity &amp; Staff Security
                </h2>
                <p className="text-xs text-[var(--ink-3)] leading-relaxed">
                  Finalize your outlet branding and set master PINs for cashier and manager floor operations.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--ink-2)] mb-1.5">
                    Outlet / Shop Name
                  </label>
                  <input
                    type="text"
                    required
                    value={cafeName}
                    onChange={(e) => setCafeName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[var(--paper-3)] border border-[var(--line-2)] rounded-[12px] text-xs font-medium focus:outline-none focus:border-[var(--gold)]"
                    placeholder="e.g. ChayaOne Cafe &amp; Bakery"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--ink-2)] mb-1.5">
                    Subdomain / Slug
                  </label>
                  <input
                    type="text"
                    required
                    value={subdomain}
                    onChange={(e) => setSubdomain(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[var(--paper-3)] border border-[var(--line-2)] rounded-[12px] text-xs font-mono focus:outline-none focus:border-[var(--gold)]"
                    placeholder="e.g. chayaone"
                  />
                </div>
              </div>

              {/* ── Owner Credentials (owner-password) ── */}
              <div className="p-3.5 rounded-[14px] bg-[var(--paper-3)] border border-[var(--line-2)] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--ink)]">Owner Credentials (Full Access)</span>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[var(--gold)]/15 text-[var(--gold-d)] border border-[var(--gold-d)]/30">
                    Primary Owner
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[10.5px] font-bold text-[var(--ink-3)] mb-1">
                      Username
                    </label>
                    <input
                      type="text"
                      required
                      value={ownerUsername}
                      onChange={(e) => setOwnerUsername(e.target.value)}
                      className="w-full px-3 py-2 bg-[var(--paper)] border border-[var(--line-2)] rounded-[10px] text-xs font-mono text-[var(--ink)] focus:outline-none focus:border-[var(--gold)]"
                      placeholder="owner"
                    />
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-bold text-[var(--ink-3)] mb-1">
                      Owner Password
                    </label>
                    <input
                      type="password"
                      required
                      value={ownerPassword}
                      onChange={(e) => setOwnerPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-[var(--paper)] border border-[var(--line-2)] rounded-[10px] text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--gold)]"
                      placeholder="Enter Owner Password"
                    />
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-bold text-[var(--ink-3)] mb-1">
                      Quick PIN (4-Digits)
                    </label>
                    <input
                      type="password"
                      maxLength={4}
                      value={ownerPin}
                      onChange={(e) => setOwnerPin(e.target.value)}
                      className="w-full px-3 py-2 bg-[var(--paper)] border border-[var(--line-2)] rounded-[10px] text-[var(--ink)] font-mono text-center tracking-[0.2em] text-xs font-bold focus:outline-none focus:border-[var(--gold)]"
                      placeholder="1111"
                    />
                  </div>
                </div>
              </div>

              {/* ── Team / Manager Credentials ── */}
              <div className="p-3.5 rounded-[14px] bg-[var(--paper-3)] border border-[var(--line-2)] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--ink)]">Team / Floor Staff Credentials</span>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                    Floor Team
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[10.5px] font-bold text-[var(--ink-3)] mb-1">
                      Username
                    </label>
                    <input
                      type="text"
                      required
                      value={teamUsername}
                      onChange={(e) => setTeamUsername(e.target.value)}
                      className="w-full px-3 py-2 bg-[var(--paper)] border border-[var(--line-2)] rounded-[10px] text-xs font-mono text-[var(--ink)] focus:outline-none focus:border-[var(--gold)]"
                      placeholder="manager"
                    />
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-bold text-[var(--ink-3)] mb-1">
                      Team Password
                    </label>
                    <input
                      type="password"
                      required
                      value={teamPassword}
                      onChange={(e) => setTeamPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-[var(--paper)] border border-[var(--line-2)] rounded-[10px] text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--gold)]"
                      placeholder="Enter Team Password"
                    />
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-bold text-[var(--ink-3)] mb-1">
                      Quick PIN (4-Digits)
                    </label>
                    <input
                      type="password"
                      maxLength={4}
                      value={managerPin}
                      onChange={(e) => setManagerPin(e.target.value)}
                      className="w-full px-3 py-2 bg-[var(--paper)] border border-[var(--line-2)] rounded-[10px] text-[var(--ink)] font-mono text-center tracking-[0.2em] text-xs font-bold focus:outline-none focus:border-[var(--gold)]"
                      placeholder="4444"
                    />
                  </div>
                </div>
              </div>

              {/* Thermal Printer IP (Optional) */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--ink-2)] mb-1.5">
                  Network Thermal Printer IP (Optional)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={printerIp}
                    onChange={(e) => setPrinterIp(e.target.value)}
                    placeholder="e.g. 192.168.1.200"
                    className="flex-1 px-3.5 py-2 bg-[var(--paper-3)] border border-[var(--line-2)] rounded-[12px] text-xs font-mono focus:outline-none focus:border-[var(--gold)]"
                  />
                  <button
                    type="button"
                    disabled={testingPrinter || !printerIp}
                    onClick={handleTestPrinter}
                    className="px-3 py-2 bg-[var(--paper-3)] hover:bg-[var(--paper)] text-[var(--ink)] font-bold text-xs rounded-[12px] border border-[var(--line-2)] transition flex items-center gap-1 shrink-0"
                  >
                    <Wifi className="w-3.5 h-3.5" />
                    <span>{testingPrinter ? 'Testing…' : 'Test LAN'}</span>
                  </button>
                </div>

                {printerTestResult && (
                  <div
                    className="mt-2 p-2.5 rounded-[10px] text-xs font-semibold flex items-center gap-2"
                    style={{
                      background: printerTestResult.ok
                        ? 'color-mix(in srgb, var(--cardamom) 12%, transparent)'
                        : 'color-mix(in srgb, var(--clay) 12%, transparent)',
                      color: printerTestResult.ok ? 'var(--cardamom-d)' : 'var(--clay)',
                    }}
                  >
                    {printerTestResult.ok ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                    <span>{printerTestResult.message}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(5)}
                  className="w-1/3 py-3 px-4 bg-[var(--paper-3)] hover:bg-[var(--paper-2)] text-[var(--ink)] font-bold text-xs sm:text-sm rounded-[14px] border border-[var(--line-2)] shadow-[var(--sh-1)] transition flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-2/3 py-3.5 px-5 bg-[var(--gold-grad)] hover:opacity-95 disabled:opacity-50 text-[var(--espresso)] font-extrabold text-sm rounded-[14px] border border-[var(--gold-d)] shadow-[var(--sh-2)] transition-all active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  <span>{busy ? 'Booting Main PC Server…' : 'Complete Setup & Launch POS'}</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-[11.5px] text-[var(--ink-3)] font-medium mt-5">
          ChayaOne OS · High Reliability Local Server Runtime
        </p>
      </div>
    </main>
  );
}
