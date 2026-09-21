'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

// ── Step config ───────────────────────────────────────────────────────────────
const STEPS = [
  { num: 1, label: 'Admin Login' },
  { num: 2, label: 'Verification' },
  { num: 3, label: 'Shop Setup' },
  { num: 4, label: 'Duration' },
  { num: 5, label: 'Activate' },
];

const PERIODS = [
  { key: '1_month',   label: '1 Month',   desc: '30 days access',  icon: '📅' },
  { key: '2_months',  label: '2 Months',  desc: '60 days access',  icon: '📅' },
  { key: '3_months',  label: '3 Months',  desc: '90 days access',  icon: '📆' },
  { key: '6_months',  label: '6 Months',  desc: '180 days access', icon: '🗓️' },
  { key: '1_year',    label: '1 Year',    desc: '365 days access', icon: '🎯' },
  { key: 'custom',    label: 'Custom',    desc: 'Pick start & end', icon: '✏️' },
];

export default function SetupClient() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Step 1 — Admin Login
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [setupToken, setSetupToken] = useState('');

  // Step 2 — Google Authenticator
  const [totpCode, setTotpCode] = useState('');
  const [otpAuthUrl, setOtpAuthUrl] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [totpSecret, setTotpSecret] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const otpInputRef = useRef<HTMLInputElement>(null);

  // Step 3 — Shop Info
  const [shopName, setShopName] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [shopCity, setShopCity] = useState('');

  // Step 4 — Duration
  const [period, setPeriod] = useState('3_months');
  const [customStart, setCustomStart] = useState(new Date().toISOString().split('T')[0]);
  const [customEnd, setCustomEnd] = useState(
    new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  // Step 5 — Done
  const [activationResult, setActivationResult] = useState<any>(null);

  // Check if already configured
  useEffect(() => {
    fetch('/api/setup')
      .then(r => r.json())
      .then(d => { if (d.isConfigured) router.push('/pos'); })
      .catch(() => {});
  }, [router]);

  // Generate QR when entering step 2
  useEffect(() => {
    if (step === 2) {
      fetch('/api/setup/admin-auth?action=totp-qr', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'totp-qr' }) })
        .then(r => r.json())
        .then(d => {
          if (d.ok) {
            setOtpAuthUrl(d.otpAuthUrl);
            setTotpSecret(d.secret);
            // Generate QR code via a free QR API
            setQrDataUrl(`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(d.otpAuthUrl)}`);
          }
        })
        .catch(() => {});
      // Focus OTP input
      setTimeout(() => otpInputRef.current?.focus(), 300);
    }
  }, [step]);

  // ── Step 1: Admin Login ────────────────────────────────────────────────────
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Username and password are required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/setup/admin-auth?action=login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password: password.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || 'Invalid credentials. Please try again.');
        return;
      }
      setSetupToken(data.setupToken);
      setStep(2);
    } catch {
      setError('Network error. Please check the server is running.');
    } finally {
      setBusy(false);
    }
  };

  // ── Step 2: TOTP Verification ──────────────────────────────────────────────
  const handleVerifyTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpCode || totpCode.length !== 6) {
      setError('Please enter the 6-digit code from Google Authenticator.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/setup/admin-auth?action=verify-totp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ setupToken, totpCode }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || 'Invalid code. Check your authenticator app.');
        return;
      }
      setStep(3);
    } catch {
      setError('Network error.');
    } finally {
      setBusy(false);
    }
  };

  // Auto-submit when 6 digits entered
  useEffect(() => {
    if (totpCode.length === 6 && step === 2) {
      handleVerifyTotp({ preventDefault: () => {} } as any);
    }
  }, [totpCode]);

  // ── Step 3: Shop Info ──────────────────────────────────────────────────────
  const handleShopNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName.trim()) {
      setError('Shop name is required.');
      return;
    }
    setError('');
    setStep(4);
  };

  // ── Step 4: Duration ───────────────────────────────────────────────────────
  const handleDurationNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (period === 'custom' && (!customStart || !customEnd)) {
      setError('Please set both start and end dates.');
      return;
    }
    if (period === 'custom' && new Date(customEnd ?? '') <= new Date(customStart ?? '')) {
      setError('End date must be after start date.');
      return;
    }
    setError('');
    setStep(5);
  };

  // ── Step 5: Activate ────────────────────────────────────────────────────────
  const handleActivate = async () => {
    setBusy(true);
    setError('');
    try {
      // 1. Validate session is still alive
      const sessionCheck = await fetch('/api/setup/admin-auth?action=validate-session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ setupToken }),
      });
      if (!sessionCheck.ok) {
        setError('Session expired. Please restart the setup.');
        setStep(1);
        return;
      }

      // 2. Run setup (creates tenant / outlet with shop name)
      const setupRes = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cafeName: shopName || 'My Cafe',
          subdomain: shopName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'mycafe',
          address: shopAddress || '',
          city: shopCity || '',
          businessType: 'cafe',
          businessTypes: ['cafe'],
          enabledModules: ['core', 'cafe'],
          ownerName: 'Owner',
          ownerUsername: 'owner',
          ownerPassword: 'cafe1234',
          ownerPin: '1111',
          teamUsername: 'manager',
          teamPassword: 'manager1234',
          managerPin: '4444',
          licensePeriod: period as any,
          adminPassphrase: '9995366767@chayaone@nuro',
          customStartDate: period === 'custom' ? customStart : undefined,
          customEndDate: period === 'custom' ? customEnd : undefined,
        }),
      });

      // 3. Also activate the license
      const licRes = await fetch('/api/license/activate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          adminPassphrase: 'Admin@Nuro',
          period: period === '1_year' ? 'custom' : period,
          customStartDate: period === '1_year' ? new Date().toISOString().split('T')[0] : period === 'custom' ? customStart : undefined,
          customEndDate: period === '1_year'
            ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            : period === 'custom' ? customEnd : undefined,
        }),
      });

      const licData = await licRes.json();
      setActivationResult(licData);

      // Redirect after success
      setTimeout(() => router.push('/login'), 2500);
    } catch (err: any) {
      setError(err?.message || 'Activation failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  // ── UI Helpers ─────────────────────────────────────────────────────────────
  const goBack = () => {
    setError('');
    setStep(s => Math.max(1, s - 1));
  };

  const selectedPeriodLabel = PERIODS.find(p => p.key === period)?.label || period;
  const expiryDate = period === 'custom' ? customEnd
    : period === '1_year' ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN')
    : period === '6_months' ? new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN')
    : period === '3_months' ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN')
    : period === '2_months' ? new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN')
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN');

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <main
      className="min-h-screen grid place-items-center p-4 sm:p-6"
      style={{
        background: 'radial-gradient(80% 55% at 50% 0%, rgba(232,144,42,.15), transparent 65%), var(--paper)',
        color: 'var(--ink)',
      }}
    >
      <div className="w-full max-w-lg">

        {/* Brand */}
        <div className="text-center mb-6">
          <img src="/logo chaya one.png" alt="ChayaOne" className="mx-auto mb-3 object-contain" style={{ height: 56, width: 'auto', maxWidth: '70%' }} />
          <p className="text-xs font-bold tracking-[0.25em] uppercase" style={{ color: 'var(--gold-d)' }}>Main PC Setup Wizard</p>
        </div>

        {/* Step Progress */}
        <div className="flex items-center justify-between mb-6 px-2">
          {STEPS.map((s, idx) => {
            const done = step > s.num;
            const active = step === s.num;
            return (
              <React.Fragment key={s.num}>
                <div className="flex flex-col items-center gap-1">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all"
                    style={{
                      background: done ? '#2e7d32' : active ? 'var(--gold)' : 'var(--paper-3)',
                      color: done ? '#fff' : active ? '#2A1607' : 'var(--ink-3)',
                      border: done ? '2px solid #2e7d32' : active ? '2px solid var(--gold-d)' : '2px solid var(--line-2)',
                    }}
                  >
                    {done ? '✓' : s.num}
                  </div>
                  <span className="text-[9px] font-bold hidden sm:block" style={{ color: active ? 'var(--ink)' : 'var(--ink-3)' }}>
                    {s.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className="flex-1 h-0.5 mx-1 rounded-full" style={{ background: step > s.num ? '#2e7d32' : 'var(--line)' }} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Card */}
        <div className="lux-card p-7">

          {/* ── STEP 1: Admin Login ──────────────────────────────────────── */}
          {step === 1 && (
            <form onSubmit={handleAdminLogin} className="flex flex-col gap-5">
              <div className="text-center">
                <div className="text-4xl mb-2">🔐</div>
                <h2 className="font-display text-xl font-bold">Administrator Login</h2>
                <p className="text-xs mt-1" style={{ color: 'var(--ink-3)' }}>
                  Enter your ChayaOne admin credentials to begin setup
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--ink-2)' }}>Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="administrator@Chayaone"
                  autoComplete="username"
                  className="w-full p-3 rounded-xl border text-sm outline-none"
                  style={{ background: 'var(--paper-2)', borderColor: 'var(--line-2)', color: 'var(--ink)' }}
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--ink-2)' }}>Password</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••••••••••"
                    autoComplete="current-password"
                    className="w-full p-3 pr-10 rounded-xl border text-sm outline-none"
                    style={{ background: 'var(--paper-2)', borderColor: 'var(--line-2)', color: 'var(--ink)' }}
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--ink-3)' }}>
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              {error && <ErrorBox msg={error} />}

              <button type="submit" disabled={busy}
                className="w-full py-3 rounded-xl font-bold text-sm transition-all"
                style={{ background: busy ? 'var(--paper-3)' : 'var(--gold)', color: '#2A1607', cursor: busy ? 'not-allowed' : 'pointer' }}>
                {busy ? 'Verifying…' : 'Continue →'}
              </button>
            </form>
          )}

          {/* ── STEP 2: Google Authenticator ─────────────────────────────── */}
          {step === 2 && (
            <form onSubmit={handleVerifyTotp} className="flex flex-col gap-5">
              <div className="text-center">
                <div className="text-4xl mb-2">📱</div>
                <h2 className="font-display text-xl font-bold">Google Authenticator</h2>
                <p className="text-xs mt-1" style={{ color: 'var(--ink-3)' }}>
                  Scan the QR code below with your Authenticator app, then enter the 6-digit code
                </p>
              </div>

              {/* QR Code */}
              {qrDataUrl && (
                <div className="flex flex-col items-center gap-3">
                  <div className="p-3 rounded-2xl bg-white shadow-sm border" style={{ borderColor: 'var(--line-2)' }}>
                    <img src={qrDataUrl} alt="Scan with Google Authenticator" width={160} height={160} />
                  </div>
                  <p className="text-[10px] text-center" style={{ color: 'var(--ink-3)' }}>
                    Open Google Authenticator → Add Account → Scan QR
                  </p>
                  <button type="button" onClick={() => setShowSecret(v => !v)}
                    className="text-xs underline" style={{ color: 'var(--ink-3)' }}>
                    {showSecret ? 'Hide manual key' : 'Can\'t scan? Show manual key'}
                  </button>
                  {showSecret && totpSecret && (
                    <div className="w-full px-4 py-2 rounded-xl text-xs font-mono text-center break-all"
                      style={{ background: 'var(--paper-2)', border: '1px dashed var(--line-2)', color: 'var(--ink-2)' }}>
                      {totpSecret}
                    </div>
                  )}
                </div>
              )}

              {/* 6-digit input */}
              <div>
                <label className="block text-xs font-bold mb-1.5 text-center" style={{ color: 'var(--ink-2)' }}>
                  6-Digit Code
                </label>
                <input
                  ref={otpInputRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={totpCode}
                  onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full p-4 rounded-xl border text-2xl text-center font-mono outline-none tracking-[0.5em]"
                  style={{ background: 'var(--paper-2)', borderColor: 'var(--line-2)', color: 'var(--ink)' }}
                />
              </div>

              {error && <ErrorBox msg={error} />}

              <div className="flex gap-3">
                <button type="button" onClick={goBack}
                  className="flex-1 py-3 rounded-xl font-bold text-sm"
                  style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}>
                  ← Back
                </button>
                <button type="submit" disabled={busy || totpCode.length !== 6}
                  className="flex-2 flex-1 py-3 px-6 rounded-xl font-bold text-sm"
                  style={{
                    background: (busy || totpCode.length !== 6) ? 'var(--paper-3)' : 'var(--gold)',
                    color: '#2A1607',
                    cursor: (busy || totpCode.length !== 6) ? 'not-allowed' : 'pointer',
                    flex: 2,
                  }}>
                  {busy ? 'Verifying…' : 'Verify →'}
                </button>
              </div>
            </form>
          )}

          {/* ── STEP 3: Shop Setup ───────────────────────────────────────── */}
          {step === 3 && (
            <form onSubmit={handleShopNext} className="flex flex-col gap-5">
              <div className="text-center">
                <div className="text-4xl mb-2">🏪</div>
                <h2 className="font-display text-xl font-bold">Shop Information</h2>
                <p className="text-xs mt-1" style={{ color: 'var(--ink-3)' }}>
                  Tell us about your business
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--ink-2)' }}>
                  Shop / Cafe Name <span style={{ color: 'var(--clay)' }}>*</span>
                </label>
                <input
                  type="text"
                  value={shopName}
                  onChange={e => setShopName(e.target.value)}
                  placeholder="e.g. Kahwa House"
                  className="w-full p-3 rounded-xl border text-sm outline-none"
                  style={{ background: 'var(--paper-2)', borderColor: 'var(--line-2)', color: 'var(--ink)' }}
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--ink-2)' }}>
                  Address <span className="font-normal" style={{ color: 'var(--ink-3)' }}>(optional)</span>
                </label>
                <input
                  type="text"
                  value={shopAddress}
                  onChange={e => setShopAddress(e.target.value)}
                  placeholder="e.g. 5th Block, Koramangala"
                  className="w-full p-3 rounded-xl border text-sm outline-none"
                  style={{ background: 'var(--paper-2)', borderColor: 'var(--line-2)', color: 'var(--ink)' }}
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--ink-2)' }}>
                  City <span className="font-normal" style={{ color: 'var(--ink-3)' }}>(optional)</span>
                </label>
                <input
                  type="text"
                  value={shopCity}
                  onChange={e => setShopCity(e.target.value)}
                  placeholder="e.g. Bengaluru"
                  className="w-full p-3 rounded-xl border text-sm outline-none"
                  style={{ background: 'var(--paper-2)', borderColor: 'var(--line-2)', color: 'var(--ink)' }}
                />
              </div>

              {error && <ErrorBox msg={error} />}

              <div className="flex gap-3">
                <button type="button" onClick={goBack}
                  className="flex-1 py-3 rounded-xl font-bold text-sm"
                  style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}>
                  ← Back
                </button>
                <button type="submit"
                  className="py-3 px-8 rounded-xl font-bold text-sm"
                  style={{ background: 'var(--gold)', color: '#2A1607', flex: 2 }}>
                  Continue →
                </button>
              </div>
            </form>
          )}

          {/* ── STEP 4: Duration Selection ────────────────────────────────── */}
          {step === 4 && (
            <form onSubmit={handleDurationNext} className="flex flex-col gap-5">
              <div className="text-center">
                <div className="text-4xl mb-2">⏱️</div>
                <h2 className="font-display text-xl font-bold">License Duration</h2>
                <p className="text-xs mt-1" style={{ color: 'var(--ink-3)' }}>
                  Select how long this installation should be active
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {PERIODS.map(p => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPeriod(p.key)}
                    className="rounded-2xl p-4 text-left transition-all"
                    style={{
                      background: period === p.key ? 'color-mix(in srgb, var(--gold) 18%, var(--paper-2))' : 'var(--paper-2)',
                      border: period === p.key ? '2px solid var(--gold-d)' : '2px solid var(--line-2)',
                    }}
                  >
                    <div className="text-xl mb-1">{p.icon}</div>
                    <div className="font-bold text-sm">{p.label}</div>
                    <div className="text-[10px] mt-0.5" style={{ color: 'var(--ink-3)' }}>{p.desc}</div>
                  </button>
                ))}
              </div>

              {period === 'custom' && (
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--ink-2)' }}>Start Date</label>
                    <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                      className="w-full p-2.5 rounded-xl border text-sm outline-none"
                      style={{ background: 'var(--paper-2)', borderColor: 'var(--line-2)', color: 'var(--ink)' }} />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--ink-2)' }}>End Date</label>
                    <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                      min={customStart}
                      className="w-full p-2.5 rounded-xl border text-sm outline-none"
                      style={{ background: 'var(--paper-2)', borderColor: 'var(--line-2)', color: 'var(--ink)' }} />
                  </div>
                </div>
              )}

              {period !== 'custom' && (
                <div className="px-4 py-3 rounded-xl text-xs text-center" style={{ background: 'var(--paper-2)', border: '1px dashed var(--line-2)', color: 'var(--ink-3)' }}>
                  📌 License will be valid until <b>{expiryDate}</b>
                </div>
              )}

              {error && <ErrorBox msg={error} />}

              <div className="flex gap-3">
                <button type="button" onClick={goBack}
                  className="flex-1 py-3 rounded-xl font-bold text-sm"
                  style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}>
                  ← Back
                </button>
                <button type="submit"
                  className="py-3 px-8 rounded-xl font-bold text-sm"
                  style={{ background: 'var(--gold)', color: '#2A1607', flex: 2 }}>
                  Continue →
                </button>
              </div>
            </form>
          )}

          {/* ── STEP 5: Review & Activate ────────────────────────────────── */}
          {step === 5 && (
            <div className="flex flex-col gap-5">
              {!activationResult ? (
                <>
                  <div className="text-center">
                    <div className="text-4xl mb-2">🚀</div>
                    <h2 className="font-display text-xl font-bold">Review & Activate</h2>
                    <p className="text-xs mt-1" style={{ color: 'var(--ink-3)' }}>Confirm details and activate this installation</p>
                  </div>

                  {/* Summary */}
                  <div className="rounded-2xl p-5 flex flex-col gap-3" style={{ background: 'var(--paper-2)', border: '1px solid var(--line-2)' }}>
                    <Row label="Shop Name" value={shopName || '—'} />
                    {shopAddress && <Row label="Address" value={shopAddress} />}
                    {shopCity && <Row label="City" value={shopCity} />}
                    <div className="h-px" style={{ background: 'var(--line-2)' }} />
                    <Row label="License Period" value={selectedPeriodLabel} />
                    <Row label="Valid Until" value={expiryDate} />
                  </div>

                  {error && <ErrorBox msg={error} />}

                  <div className="flex gap-3">
                    <button onClick={goBack}
                      className="flex-1 py-3 rounded-xl font-bold text-sm"
                      style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}>
                      ← Back
                    </button>
                    <button onClick={handleActivate} disabled={busy}
                      className="py-3 px-8 rounded-xl font-bold text-sm transition-all"
                      style={{
                        background: busy ? 'var(--paper-3)' : 'linear-gradient(135deg, #e8902a, #c97a1e)',
                        color: busy ? 'var(--ink-3)' : '#fff',
                        cursor: busy ? 'not-allowed' : 'pointer',
                        flex: 2,
                        boxShadow: busy ? 'none' : '0 4px 16px rgba(200,120,20,.35)',
                      }}>
                      {busy ? 'Activating…' : '✨ Activate ChayaOne'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center flex flex-col items-center gap-4 py-4">
                  <div className="text-5xl">🎉</div>
                  <h2 className="font-display text-2xl font-bold">Activated!</h2>
                  <p className="text-sm" style={{ color: 'var(--ink-2)' }}>
                    <b>{shopName}</b> is ready to use.<br />
                    License active until <b>{expiryDate}</b>.
                  </p>
                  <div className="px-5 py-3 rounded-xl text-xs" style={{ background: 'var(--paper-2)', border: '1px solid var(--line-2)', color: 'var(--ink-3)' }}>
                    Default login: <b>owner</b> / <b>cafe1234</b>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--ink-3)' }}>Redirecting to login…</p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </main>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="px-4 py-3 rounded-xl text-sm"
      style={{ background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.3)', color: '#dc2626' }}>
      ⚠ {msg}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span style={{ color: 'var(--ink-3)' }}>{label}</span>
      <span className="font-bold" style={{ color: 'var(--ink)' }}>{value}</span>
    </div>
  );
}
