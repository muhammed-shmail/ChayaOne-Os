'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * BillingWall — shown when workspace access is blocked.
 *
 * reason === 'license_not_activated'  → Redirect to /setup wizard
 * reason === 'license_expired'        → License renewal form
 * reason === 'clock_tampered'         → Clock tampering error
 * anything else                       → Subscription billing hold
 */
export function BillingWall({ brand, reason }: { brand?: string; reason: string | null }) {
  const router = useRouter();

  // Fresh install → immediately redirect to the setup wizard
  useEffect(() => {
    if (reason === 'license_not_activated') {
      router.replace('/setup');
    }
  }, [reason, router]);

  if (reason === 'license_not_activated') {
    // Show a brief loading state while redirect happens
    return (
      <main className="min-h-screen grid place-items-center p-6" style={{ background: 'var(--paper)' }}>
        <div className="text-center">
          <div className="text-4xl mb-3">🏪</div>
          <p className="text-sm font-bold" style={{ color: 'var(--ink-2)' }}>Starting setup wizard…</p>
        </div>
      </main>
    );
  }

  if (reason === 'license_expired') {
    return <LicenseExpiredWall brand={brand} />;
  }

  // Subscription-level block
  const heading =
    reason === 'expired'
      ? 'Your subscription has expired'
      : reason === 'past_due'
        ? 'Payment is past due'
        : 'Your workspace is paused';

  return (
    <main
      className="min-h-screen grid place-items-center p-6"
      style={{ background: 'radial-gradient(80% 60% at 50% 0%, rgba(232,144,42,.12), transparent 60%), var(--paper)' }}
    >
      <div className="w-full max-w-[460px] text-center lux-card p-8">
        <div className="text-5xl mb-3">🔒</div>
        <p className="font-display text-[12px] tracking-[0.3em] uppercase" style={{ color: 'var(--gold-d)' }}>ChayaOne</p>
        <h1 className="font-display text-[30px] leading-tight mt-1">{heading}</h1>
        <p className="text-sm mt-3" style={{ color: 'var(--ink-2)' }}>
          {brand ? `${brand}'s ` : 'Your '}workspace is read-only until billing is renewed.
          <br />Your data is safe and untouched.
        </p>
        <div className="mt-5 p-4 rounded-xl text-sm" style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}>
          Contact your ChayaOne account manager to reactivate this cafe.
        </div>
        <a href="/api/auth/logout" className="inline-block mt-5 text-sm font-bold rounded-xl px-5 py-2.5"
          style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}>
          Sign out
        </a>
      </div>
    </main>
  );
}

// ── First-Install Activation Wizard ──────────────────────────────────────────

function ActivationWizard({ brand }: { brand?: string }) {
  const [passphrase, setPassphrase] = useState('');
  const [period, setPeriod] = useState('3_months');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase.trim()) { setError('Activation key is required.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/license/activate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ adminPassphrase: passphrase, period }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSuccess(true);
        // Reload after 1.5s to load the dashboard
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setError(data.message || 'Invalid activation key. Please try again.');
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      className="min-h-screen grid place-items-center p-6"
      style={{ background: 'radial-gradient(80% 60% at 50% 0%, rgba(232,144,42,.15), transparent 60%), var(--paper)' }}
    >
      <div className="w-full max-w-[480px] lux-card p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🏪</div>
          <p className="font-display text-[11px] tracking-[0.35em] uppercase mb-1" style={{ color: 'var(--gold-d)' }}>ChayaOne OS</p>
          <h1 className="font-display text-[26px] leading-tight">
            {success ? 'Activation Successful!' : 'Activate Your Installation'}
          </h1>
          {!success && (
            <p className="text-sm mt-2" style={{ color: 'var(--ink-3)' }}>
              {brand ? `Welcome to ${brand}. ` : ''}Enter your activation key to unlock ChayaOne on this PC.
            </p>
          )}
        </div>

        {success ? (
          <div className="text-center py-6">
            <div className="text-4xl mb-3">✅</div>
            <p className="text-sm font-bold" style={{ color: 'var(--ink-2)' }}>License activated. Loading your workspace…</p>
            <div className="mt-4 h-1 rounded-full overflow-hidden" style={{ background: 'var(--line-2)' }}>
              <div className="h-full rounded-full animate-pulse" style={{ background: 'var(--gold)', width: '100%' }} />
            </div>
          </div>
        ) : (
          <form onSubmit={handleActivate} className="flex flex-col gap-4">
            {/* Activation Key */}
            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--ink-2)' }}>
                Activation Key *
              </label>
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Enter your ChayaOne activation key"
                autoComplete="off"
                className="w-full p-3 rounded-xl border text-sm outline-none"
                style={{ background: 'var(--paper-2)', borderColor: 'var(--line-2)', color: 'var(--ink)' }}
              />
            </div>

            {/* License Period */}
            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--ink-2)' }}>
                License Period
              </label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-full p-3 rounded-xl border text-sm outline-none"
                style={{ background: 'var(--paper-2)', borderColor: 'var(--line-2)', color: 'var(--ink)' }}
              >
                <option value="1_month">1 Month</option>
                <option value="2_months">2 Months</option>
                <option value="3_months">3 Months</option>
              </select>
            </div>

            {/* Error */}
            {error && (
              <div className="px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.25)', color: '#dc2626' }}>
                ⚠ {error}
              </div>
            )}

            {/* Help text */}
            <div className="px-4 py-3 rounded-xl text-xs" style={{ background: 'var(--paper-2)', border: '1px dashed var(--line-2)', color: 'var(--ink-3)' }}>
              💡 Contact your ChayaOne account manager for your activation key. Each PC installation requires a separate activation.
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-sm transition-all"
              style={{
                background: loading ? 'var(--paper-3)' : 'var(--gold)',
                color: loading ? 'var(--ink-3)' : '#2A1607',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Activating…' : 'Activate ChayaOne'}
            </button>

            <a
              href="/api/auth/logout"
              className="text-center text-xs"
              style={{ color: 'var(--ink-3)' }}
            >
              Sign out
            </a>
          </form>
        )}
      </div>
    </main>
  );
}

// ── License Expired Wall — full admin login + 2FA + duration renewal ─────────

const RENEW_PERIODS = [
  { key: '1_month',  label: '1 Month',  icon: '📅' },
  { key: '2_months', label: '2 Months', icon: '📅' },
  { key: '3_months', label: '3 Months', icon: '📆' },
  { key: '6_months', label: '6 Months', icon: '🗓️' },
  { key: '1_year',   label: '1 Year',   icon: '🎯' },
  { key: 'custom',   label: 'Custom',   icon: '✏️' },
];

function LicenseExpiredWall({ brand }: { brand?: string }) {
  const [renewStep, setRenewStep] = useState<'login' | 'totp' | 'duration' | 'done'>('login');

  // Step 1 — login
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [setupToken, setSetupToken] = useState('');

  // Step 2 — TOTP
  const [totpCode, setTotpCode] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  // Step 3 — Duration
  const [period, setPeriod] = useState('3_months');
  const [customStart, setCustomStart] = useState(new Date().toISOString().split('T')[0]);
  const [customEnd, setCustomEnd] = useState(
    new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load QR when entering TOTP step
  useEffect(() => {
    if (renewStep === 'totp') {
      fetch('/api/setup/admin-auth?action=totp-qr', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'totp-qr' }),
      })
        .then(r => r.json())
        .then(d => {
          if (d.ok) {
            setTotpSecret(d.secret);
            setQrDataUrl(`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(d.otpAuthUrl)}`);
          }
        })
        .catch(() => {});
    }
  }, [renewStep]);

  // Auto-submit TOTP when 6 digits entered
  useEffect(() => {
    if (totpCode.length === 6 && renewStep === 'totp') {
      handleVerifyTotp();
    }
  }, [totpCode]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) { setError('Username and password are required.'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/setup/admin-auth?action=login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password: password.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setError(data.error || 'Invalid credentials.'); return; }
      setSetupToken(data.setupToken);
      setRenewStep('totp');
    } catch { setError('Network error.'); }
    finally { setLoading(false); }
  };

  const handleVerifyTotp = async () => {
    if (totpCode.length !== 6) { setError('Enter the 6-digit code.'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/setup/admin-auth?action=verify-totp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ setupToken, totpCode }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setError(data.error || 'Invalid code.'); setTotpCode(''); return; }
      setRenewStep('duration');
    } catch { setError('Network error.'); }
    finally { setLoading(false); }
  };

  const handleRenew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (period === 'custom' && new Date(customEnd) <= new Date(customStart)) {
      setError('End date must be after start date.'); return;
    }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/license/activate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          adminPassphrase: 'Admin@Nuro',
          period: period === '1_year' ? 'custom' : period,
          customStartDate: period === '1_year' ? new Date().toISOString().split('T')[0]
            : period === 'custom' ? customStart : undefined,
          customEndDate: period === '1_year'
            ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            : period === 'custom' ? customEnd : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setRenewStep('done');
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setError(data.message || 'Renewal failed.');
      }
    } catch { setError('Network error.'); }
    finally { setLoading(false); }
  };

  const expiryDate = period === 'custom' ? customEnd
    : period === '1_year' ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN')
    : period === '6_months' ? new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN')
    : period === '3_months' ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN')
    : period === '2_months' ? new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN')
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN');

  return (
    <main
      className="min-h-screen grid place-items-center p-6"
      style={{ background: 'radial-gradient(80% 60% at 50% 0%, rgba(220,38,38,.08), transparent 60%), var(--paper)' }}
    >
      <div className="w-full max-w-[480px] lux-card p-8">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">{renewStep === 'done' ? '🎉' : renewStep === 'duration' ? '⏱️' : renewStep === 'totp' ? '📱' : '⏳'}</div>
          <p className="font-display text-[11px] tracking-[0.35em] uppercase mb-1" style={{ color: 'var(--gold-d)' }}>ChayaOne OS</p>
          <h1 className="font-display text-[24px] leading-tight">
            {renewStep === 'done' ? 'Renewed!' : renewStep === 'duration' ? 'Select Duration' : renewStep === 'totp' ? 'Verify Identity' : 'License Expired'}
          </h1>
          {renewStep === 'login' && (
            <p className="text-sm mt-1" style={{ color: 'var(--ink-3)' }}>
              {brand ? `${brand}'s ` : 'Your '}license has expired. Login to renew.
            </p>
          )}
        </div>

        {/* Step: Login */}
        {renewStep === 'login' && (
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--ink-2)' }}>Username</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                placeholder="administrator@Chayaone" autoComplete="username"
                className="w-full p-3 rounded-xl border text-sm outline-none"
                style={{ background: 'var(--paper-2)', borderColor: 'var(--line-2)', color: 'var(--ink)' }} />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--ink-2)' }}>Password</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••" autoComplete="current-password"
                  className="w-full p-3 pr-10 rounded-xl border text-sm outline-none"
                  style={{ background: 'var(--paper-2)', borderColor: 'var(--line-2)', color: 'var(--ink)' }} />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--ink-3)' }}>
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            {error && <ErrBox msg={error} />}
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-sm"
              style={{ background: loading ? 'var(--paper-3)' : 'var(--gold)', color: '#2A1607', cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Verifying…' : 'Continue →'}
            </button>
            <a href="/api/auth/logout" className="text-center text-xs" style={{ color: 'var(--ink-3)' }}>Sign out</a>
          </form>
        )}

        {/* Step: TOTP */}
        {renewStep === 'totp' && (
          <div className="flex flex-col gap-4">
            {qrDataUrl && (
              <div className="flex flex-col items-center gap-2">
                <div className="p-3 rounded-2xl bg-white border shadow-sm" style={{ borderColor: 'var(--line-2)' }}>
                  <img src={qrDataUrl} alt="Scan QR" width={140} height={140} />
                </div>
                <p className="text-[10px] text-center" style={{ color: 'var(--ink-3)' }}>Scan with Google Authenticator</p>
                <button type="button" onClick={() => setShowSecret(v => !v)} className="text-xs underline" style={{ color: 'var(--ink-3)' }}>
                  {showSecret ? 'Hide key' : "Can't scan? Show key"}
                </button>
                {showSecret && totpSecret && (
                  <div className="w-full px-3 py-2 rounded-xl text-xs font-mono text-center break-all"
                    style={{ background: 'var(--paper-2)', border: '1px dashed var(--line-2)', color: 'var(--ink-2)' }}>
                    {totpSecret}
                  </div>
                )}
              </div>
            )}
            <div>
              <label className="block text-xs font-bold mb-1.5 text-center" style={{ color: 'var(--ink-2)' }}>6-Digit Code</label>
              <input type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
                value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000" autoFocus
                className="w-full p-4 rounded-xl border text-2xl text-center font-mono outline-none tracking-[0.5em]"
                style={{ background: 'var(--paper-2)', borderColor: 'var(--line-2)', color: 'var(--ink)' }} />
            </div>
            {error && <ErrBox msg={error} />}
            <div className="flex gap-3">
              <button onClick={() => { setRenewStep('login'); setTotpCode(''); setError(''); }}
                className="flex-1 py-3 rounded-xl font-bold text-sm"
                style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}>
                ← Back
              </button>
              <button onClick={handleVerifyTotp} disabled={loading || totpCode.length !== 6}
                className="py-3 px-6 rounded-xl font-bold text-sm"
                style={{ background: (loading || totpCode.length !== 6) ? 'var(--paper-3)' : 'var(--gold)', color: '#2A1607', flex: 2, cursor: (loading || totpCode.length !== 6) ? 'not-allowed' : 'pointer' }}>
                {loading ? 'Verifying…' : 'Verify →'}
              </button>
            </div>
          </div>
        )}

        {/* Step: Duration */}
        {renewStep === 'duration' && (
          <form onSubmit={handleRenew} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {RENEW_PERIODS.map(p => (
                <button key={p.key} type="button" onClick={() => setPeriod(p.key)}
                  className="rounded-2xl p-3 text-left transition-all"
                  style={{
                    background: period === p.key ? 'color-mix(in srgb, var(--gold) 18%, var(--paper-2))' : 'var(--paper-2)',
                    border: period === p.key ? '2px solid var(--gold-d)' : '2px solid var(--line-2)',
                  }}>
                  <div className="text-lg mb-0.5">{p.icon}</div>
                  <div className="font-bold text-sm">{p.label}</div>
                </button>
              ))}
            </div>
            {period === 'custom' && (
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-bold mb-1" style={{ color: 'var(--ink-2)' }}>Start</label>
                  <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                    className="w-full p-2.5 rounded-xl border text-sm outline-none"
                    style={{ background: 'var(--paper-2)', borderColor: 'var(--line-2)', color: 'var(--ink)' }} />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold mb-1" style={{ color: 'var(--ink-2)' }}>End</label>
                  <input type="date" value={customEnd} min={customStart} onChange={e => setCustomEnd(e.target.value)}
                    className="w-full p-2.5 rounded-xl border text-sm outline-none"
                    style={{ background: 'var(--paper-2)', borderColor: 'var(--line-2)', color: 'var(--ink)' }} />
                </div>
              </div>
            )}
            {period !== 'custom' && (
              <div className="px-3 py-2.5 rounded-xl text-xs text-center" style={{ background: 'var(--paper-2)', border: '1px dashed var(--line-2)', color: 'var(--ink-3)' }}>
                📌 Active until <b>{expiryDate}</b>
              </div>
            )}
            {error && <ErrBox msg={error} />}
            <div className="flex gap-3">
              <button type="button" onClick={() => { setRenewStep('totp'); setTotpCode(''); setError(''); }}
                className="flex-1 py-3 rounded-xl font-bold text-sm"
                style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}>
                ← Back
              </button>
              <button type="submit" disabled={loading}
                className="py-3 px-6 rounded-xl font-bold text-sm"
                style={{ background: loading ? 'var(--paper-3)' : 'var(--gold)', color: '#2A1607', flex: 2, cursor: loading ? 'not-allowed' : 'pointer' }}>
                {loading ? 'Renewing…' : '✨ Renew License'}
              </button>
            </div>
          </form>
        )}

        {/* Done */}
        {renewStep === 'done' && (
          <div className="text-center flex flex-col items-center gap-3 py-4">
            <div className="text-4xl">✅</div>
            <p className="text-sm font-bold" style={{ color: 'var(--ink-2)' }}>
              License renewed successfully!<br />
              <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>Valid until <b>{expiryDate}</b></span>
            </p>
            <p className="text-xs" style={{ color: 'var(--ink-3)' }}>Reloading workspace…</p>
          </div>
        )}

      </div>
    </main>
  );
}

function ErrBox({ msg }: { msg: string }) {
  return (
    <div className="px-4 py-3 rounded-xl text-sm"
      style={{ background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.3)', color: '#dc2626' }}>
      ⚠ {msg}
    </div>
  );
}
