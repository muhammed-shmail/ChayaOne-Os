'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Store, ShieldCheck, Printer, ArrowRight, ArrowLeft, Check, Sparkles } from 'lucide-react';

export default function SetupClient() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [cafeName, setCafeName] = useState('ChayaOne Cafe');
  const [subdomain, setSubdomain] = useState('chayaone');
  const [ownerName, setOwnerName] = useState('Owner');
  const [ownerPin, setOwnerPin] = useState('1111');
  const [managerPin, setManagerPin] = useState('4444');
  const [printerIp, setPrinterIp] = useState('');

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
          ownerName,
          ownerPin,
          managerPin,
          defaultPrinterIp: printerIp,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Setup failed. Please check inputs.');
        setBusy(false);
        return;
      }

      router.push('/pos');
    } catch (err: any) {
      setError(err?.message || 'Network error completing setup.');
      setBusy(false);
    }
  };

  const steps = [
    { num: 1, label: 'Identity', icon: Store },
    { num: 2, label: 'Security', icon: ShieldCheck },
    { num: 3, label: 'Hardware', icon: Printer },
  ];

  return (
    <main
      className="min-h-screen grid place-items-center p-4 sm:p-6"
      style={{
        background: 'radial-gradient(80% 55% at 50% 0%, rgba(232,144,42,.14), transparent 60%), var(--paper)',
        color: 'var(--ink)',
      }}
    >
      <div className="w-full max-w-lg">
        {/* Brand Header */}
        <div className="text-center mb-6 flex flex-col items-center">
          <div className="mb-2">
            <img
              src="/logo chaya one.png"
              alt="ChayaOne"
              style={{ width: 220, height: 'auto', maxWidth: '78%' }}
              className="brand-logo object-contain mx-auto block"
            />
          </div>

          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-2"
            style={{
              background: 'color-mix(in srgb, var(--gold) 15%, transparent)',
              border: '1px solid color-mix(in srgb, var(--gold-d) 35%, transparent)',
              color: 'var(--ink-2)',
            }}
          >
            <Sparkles className="w-3 h-3 text-[var(--gold)]" />
            <span>ChayaOne OS · Cafe Setup Wizard</span>
          </div>

          <h1 className="font-display text-[30px] font-bold tracking-tight text-[var(--ink)] leading-tight">
            Main Cafe PC Setup
          </h1>
          <p className="text-xs sm:text-sm text-[var(--ink-3)] font-medium mt-1">
            Initialize your local server runtime and credentials
          </p>
        </div>

        {/* Step Progress Pills */}
        <div className="flex items-center justify-between mb-5 px-2">
          {steps.map((s, idx) => {
            const Icon = s.icon;
            const isDone = step > s.num;
            const isCurrent = step === s.num;

            return (
              <React.Fragment key={s.num}>
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all shadow-sm"
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
                    {isDone ? <Check className="w-4 h-4 stroke-[2.5]" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span
                    className={`text-xs font-bold ${
                      isCurrent ? 'text-[var(--ink)]' : 'text-[var(--ink-3)]'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className="flex-1 h-0.5 mx-2 rounded-full"
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
          className="rounded-[26px] p-6 sm:p-8"
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
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSetupSubmit} className="space-y-5">
            {/* Step 1: Cafe Identity */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-[11.5px] font-bold uppercase tracking-wider text-[var(--ink-2)] mb-1.5">
                    Cafe / Outlet Name
                  </label>
                  <input
                    type="text"
                    required
                    value={cafeName}
                    onChange={(e) => setCafeName(e.target.value)}
                    className="w-full px-4 py-3 bg-[var(--paper-3)] border border-[var(--line-2)] rounded-[14px] text-[var(--ink)] placeholder:text-[var(--ink-3)] text-sm font-medium focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--ring)] transition-all"
                    placeholder="e.g. ChayaOne Bistro"
                  />
                  <p className="text-[11.5px] text-[var(--ink-3)] mt-1.5">
                    Displayed on bill receipts, KOT tickets, and customer digital menus.
                  </p>
                </div>

                <div>
                  <label className="block text-[11.5px] font-bold uppercase tracking-wider text-[var(--ink-2)] mb-1.5">
                    Subdomain / Outlet Identifier
                  </label>
                  <input
                    type="text"
                    required
                    value={subdomain}
                    onChange={(e) => setSubdomain(e.target.value)}
                    className="w-full px-4 py-3 bg-[var(--paper-3)] border border-[var(--line-2)] rounded-[14px] text-[var(--ink)] placeholder:text-[var(--ink-3)] text-sm font-medium focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--ring)] transition-all font-mono"
                    placeholder="e.g. chayaone"
                  />
                  <p className="text-[11.5px] text-[var(--ink-3)] mt-1.5">
                    Used for internal multi-tenant and local device routing.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-full py-3.5 px-5 bg-[var(--gold-grad)] hover:opacity-95 text-[var(--espresso)] font-extrabold text-sm rounded-[14px] border border-[var(--gold-d)] shadow-[var(--sh-2)] transition-all active:scale-[0.99] flex items-center justify-center gap-2 mt-4"
                >
                  <span>Continue to Staff PIN Security</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Step 2: Security & PINs */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-[11.5px] font-bold uppercase tracking-wider text-[var(--ink-2)] mb-1.5">
                    Owner Display Name
                  </label>
                  <input
                    type="text"
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="w-full px-4 py-3 bg-[var(--paper-3)] border border-[var(--line-2)] rounded-[14px] text-[var(--ink)] placeholder:text-[var(--ink-3)] text-sm font-medium focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--ring)] transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11.5px] font-bold uppercase tracking-wider text-[var(--ink-2)] mb-1.5">
                      Owner PIN (4 Digits)
                    </label>
                    <input
                      type="password"
                      maxLength={4}
                      required
                      value={ownerPin}
                      onChange={(e) => setOwnerPin(e.target.value)}
                      className="w-full px-4 py-3 bg-[var(--paper-3)] border border-[var(--line-2)] rounded-[14px] text-[var(--ink)] font-mono text-center tracking-[0.4em] text-lg font-bold focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--ring)] transition-all"
                    />
                    <span className="text-[11px] text-[var(--ink-3)] block mt-1">For full system & reports access</span>
                  </div>

                  <div>
                    <label className="block text-[11.5px] font-bold uppercase tracking-wider text-[var(--ink-2)] mb-1.5">
                      Manager PIN (4 Digits)
                    </label>
                    <input
                      type="password"
                      maxLength={4}
                      required
                      value={managerPin}
                      onChange={(e) => setManagerPin(e.target.value)}
                      className="w-full px-4 py-3 bg-[var(--paper-3)] border border-[var(--line-2)] rounded-[14px] text-[var(--ink)] font-mono text-center tracking-[0.4em] text-lg font-bold focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--ring)] transition-all"
                    />
                    <span className="text-[11px] text-[var(--ink-3)] block mt-1">For floor management & voids</span>
                  </div>
                </div>

                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="w-1/3 py-3.5 px-4 bg-[var(--paper-3)] hover:bg-[var(--paper-2)] text-[var(--ink)] font-bold text-sm rounded-[14px] border border-[var(--line-2)] shadow-[var(--sh-1)] transition-all flex items-center justify-center gap-1.5"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="w-2/3 py-3.5 px-5 bg-[var(--gold-grad)] hover:opacity-95 text-[var(--espresso)] font-extrabold text-sm rounded-[14px] border border-[var(--gold-d)] shadow-[var(--sh-2)] transition-all active:scale-[0.99] flex items-center justify-center gap-2"
                  >
                    <span>Next: Hardware Setup</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Hardware Printer */}
            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-[11.5px] font-bold uppercase tracking-wider text-[var(--ink-2)] mb-1.5">
                    Thermal Network Printer IP (Optional)
                  </label>
                  <input
                    type="text"
                    value={printerIp}
                    onChange={(e) => setPrinterIp(e.target.value)}
                    className="w-full px-4 py-3 bg-[var(--paper-3)] border border-[var(--line-2)] rounded-[14px] text-[var(--ink)] font-mono text-sm focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--ring)] transition-all placeholder:text-[var(--ink-3)]"
                    placeholder="e.g. 192.168.1.200"
                  />
                  <p className="text-[11.5px] text-[var(--ink-3)] mt-1.5">
                    ESC/POS thermal printer for automatic receipts and kitchen KOT tickets. You can also configure this later in Dashboard Settings.
                  </p>
                </div>

                <div
                  className="p-4 rounded-[16px]"
                  style={{
                    background: 'color-mix(in srgb, var(--cardamom) 8%, var(--paper-3))',
                    border: '1px solid color-mix(in srgb, var(--cardamom) 25%, transparent)',
                  }}
                >
                  <div className="flex items-center gap-2 text-[var(--cardamom-d)] font-bold text-xs mb-1">
                    <Check className="w-4 h-4" />
                    <span>Ready for Launch</span>
                  </div>
                  <p className="text-[11.5px] text-[var(--ink-2)] leading-relaxed">
                    Completing this setup initializes your local database, sets up default coffee & food categories, and boots the POS till.
                  </p>
                </div>

                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="w-1/3 py-3.5 px-4 bg-[var(--paper-3)] hover:bg-[var(--paper-2)] text-[var(--ink)] font-bold text-sm rounded-[14px] border border-[var(--line-2)] shadow-[var(--sh-1)] transition-all flex items-center justify-center gap-1.5"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-2/3 py-3.5 px-5 bg-[var(--gold-grad)] hover:opacity-95 disabled:opacity-50 text-[var(--espresso)] font-extrabold text-sm rounded-[14px] border border-[var(--gold-d)] shadow-[var(--sh-2)] transition-all active:scale-[0.99] flex items-center justify-center gap-2"
                  >
                    {busy ? (
                      <span>Initializing Store…</span>
                    ) : (
                      <>
                        <span>Complete & Launch POS</span>
                        <Sparkles className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-[11.5px] text-[var(--ink-3)] font-medium mt-5">
          ChayaOne OS · Designed for Local-First High Reliability
        </p>
      </div>
    </main>
  );
}
