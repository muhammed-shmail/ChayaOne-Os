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

// ── License Expired Wall ──────────────────────────────────────────────────────

function LicenseExpiredWall({ brand }: { brand?: string }) {
  const [passphrase, setPassphrase] = useState('');
  const [period, setPeriod] = useState('3_months');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleRenew = async (e: React.FormEvent) => {
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
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setError(data.message || 'Invalid activation key.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      className="min-h-screen grid place-items-center p-6"
      style={{ background: 'radial-gradient(80% 60% at 50% 0%, rgba(220,38,38,.08), transparent 60%), var(--paper)' }}
    >
      <div className="w-full max-w-[460px] lux-card p-8">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">⏳</div>
          <p className="font-display text-[11px] tracking-[0.35em] uppercase mb-1" style={{ color: 'var(--gold-d)' }}>ChayaOne OS</p>
          <h1 className="font-display text-[26px] leading-tight">
            {success ? 'Renewed Successfully!' : 'License Expired'}
          </h1>
          {!success && (
            <p className="text-sm mt-2" style={{ color: 'var(--ink-3)' }}>
              {brand ? `${brand}'s ` : 'Your '}ChayaOne license has expired. Renew to continue.
            </p>
          )}
        </div>

        {success ? (
          <div className="text-center py-4">
            <div className="text-3xl mb-2">✅</div>
            <p className="text-sm font-bold" style={{ color: 'var(--ink-2)' }}>License renewed. Reloading…</p>
          </div>
        ) : (
          <form onSubmit={handleRenew} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--ink-2)' }}>Activation Key *</label>
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Enter your renewal key"
                className="w-full p-3 rounded-xl border text-sm outline-none"
                style={{ background: 'var(--paper-2)', borderColor: 'var(--line-2)', color: 'var(--ink)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--ink-2)' }}>Renewal Period</label>
              <select value={period} onChange={(e) => setPeriod(e.target.value)}
                className="w-full p-3 rounded-xl border text-sm outline-none"
                style={{ background: 'var(--paper-2)', borderColor: 'var(--line-2)', color: 'var(--ink)' }}>
                <option value="1_month">1 Month</option>
                <option value="2_months">2 Months</option>
                <option value="3_months">3 Months</option>
              </select>
            </div>
            {error && (
              <div className="px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.25)', color: '#dc2626' }}>
                ⚠ {error}
              </div>
            )}
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-sm"
              style={{ background: loading ? 'var(--paper-3)' : 'var(--gold)', color: '#2A1607', border: 'none', cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Renewing…' : 'Renew License'}
            </button>
            <a href="/api/auth/logout" className="text-center text-xs" style={{ color: 'var(--ink-3)' }}>Sign out</a>
          </form>
        )}
      </div>
    </main>
  );
}
