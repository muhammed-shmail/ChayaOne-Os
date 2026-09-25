'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AlphaTag, Eye, EyeOff, Delete } from '@/components/ui';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'del'];

interface LoginClientProps {
  next?: string;
  initialBusinessName?: string;
  initialLogoUrl?: string | null;
}

export default function LoginClient({
  next = '/dashboard',
  initialBusinessName,
  initialLogoUrl,
}: LoginClientProps) {
  const router = useRouter();
  const [businessName, setBusinessName] = useState<string>(initialBusinessName || '');
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl || null);

  useEffect(() => {
    fetch('/api/auth/store-info')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.name) setBusinessName(d.name);
        if (d?.logoUrl) setLogoUrl(d.logoUrl);
      })
      .catch(() => {});
  }, []);

  const [mode, setMode] = useState<'password' | 'pin'>('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submitPassword(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Wrong username or password');
        setBusy(false);
        return;
      }

      router.replace(next);
      router.refresh();
    } catch {
      setError('Unable to connect. Please check network.');
      setBusy(false);
    }
  }

  async function submitPin(code: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pin: code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Wrong PIN — try again');
        setPin('');
        setBusy(false);
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setError('Wrong PIN — try again');
      setPin('');
      setBusy(false);
    }
  }

  function press(k: string) {
    if (busy) return;
    if (k === 'clear') return setPin('');
    if (k === 'del') return setPin((p) => p.slice(0, -1));
    if (pin.length >= 6) return;
    const nextPin = pin + k;
    setPin(nextPin);
    if (nextPin.length === 4) submitPin(nextPin);
  }

  return (
    <main
      className="min-h-screen grid place-items-center p-6"
      style={{
        background: 'radial-gradient(80% 60% at 50% 0%, rgba(232,144,42,.12), transparent 60%), var(--paper)',
      }}
    >
      <div className="w-full max-w-[360px]">
        <div className="text-center mb-7 flex flex-col items-center">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setMode((m) => (m === 'pin' ? 'password' : 'pin'));
              setError(null);
              setPin('');
              setPassword('');
              setShowPassword(false);
            }}
            aria-label="Toggle login mode"
            title="Tap to switch between Password and PIN"
            className="mb-1.5 disabled:opacity-50 flex justify-center items-center w-full cursor-pointer"
            style={{ background: 'none', border: 'none', padding: 0, lineHeight: 0 }}
          >
            <img
              src={logoUrl || '/logo chaya one.png'}
              alt={businessName || 'ChayaOne'}
              style={{ width: 288, height: 'auto', maxWidth: '84%' }}
              className="brand-logo object-contain mx-auto block"
            />
          </button>
          <AlphaTag />
          <h1 className="font-display text-[38px] leading-none mt-3.5">
            {businessName ? `${businessName} Owner` : 'ChayaOne Owner'}
          </h1>
          <p className="text-sm mt-2" style={{ color: 'var(--ink-3)' }}>
            {mode === 'password'
              ? 'Sign in with your username & password'
              : 'Enter your 4-digit manager PIN'}
          </p>
        </div>

        {mode === 'password' ? (
          <form onSubmit={submitPassword} className={`space-y-3.5 ${error ? 'shake' : ''}`}>
            {error && (
              <p
                role="alert"
                className="text-center text-sm font-bold p-2.5 rounded-xl"
                style={{
                  color: 'var(--clay)',
                  background: 'color-mix(in srgb, var(--clay) 12%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--clay) 25%, transparent)',
                }}
              >
                {error}
              </p>
            )}

            <div>
              <label className="lbl">Username</label>
              <input
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. owner"
                disabled={busy}
                className="inp"
                style={{
                  background: 'var(--paper-2)',
                  border: '1px solid var(--line)',
                  boxShadow: 'var(--sh-1)',
                  color: 'var(--ink)',
                }}
              />
            </div>

            <div>
              <label className="lbl">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  disabled={busy}
                  className="inp pr-12"
                  style={{
                    background: 'var(--paper-2)',
                    border: '1px solid var(--line)',
                    boxShadow: 'var(--sh-1)',
                    color: 'var(--ink)',
                  }}
                />
                <button
                  type="button"
                  disabled={busy}
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center w-9 h-9 rounded-xl transition disabled:opacity-50"
                  style={{ color: 'var(--ink-3)', background: 'none', border: 'none' }}
                >
                  {showPassword ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy || !username.trim() || !password}
              className="btn btn-lux w-full mt-2"
              style={{ padding: '14px', borderRadius: 16, fontSize: 16 }}
            >
              {busy ? 'Signing in…' : 'Sign in →'}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setMode('pin')}
                className="text-xs font-semibold hover:underline"
                style={{ color: 'var(--gold-d)' }}
              >
                Sign in with PIN instead
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className={`flex justify-center gap-3 mb-6 ${error ? 'shake' : ''}`}>
              {Array.from({ length: 4 }).map((_, i) => (
                <span
                  key={i}
                  className="w-3.5 h-3.5 rounded-full transition"
                  style={{
                    background: i < pin.length ? 'var(--gold)' : 'transparent',
                    border: `2px solid ${i < pin.length ? 'var(--gold-d)' : 'var(--line-2)'}`,
                    boxShadow:
                      i < pin.length
                        ? '0 0 0 3px color-mix(in srgb, var(--gold) 20%, transparent)'
                        : 'none',
                  }}
                />
              ))}
            </div>

            {error && (
              <p role="alert" className="text-center text-sm font-bold mb-4" style={{ color: 'var(--clay)' }}>
                {error}
              </p>
            )}

            <div className="grid grid-cols-3 gap-3">
              {KEYS.map((k) => (
                <button
                  key={k}
                  onClick={() => press(k)}
                  disabled={busy}
                  aria-label={k === 'del' ? 'Delete' : k === 'clear' ? 'Clear' : `Digit ${k}`}
                  className="aspect-[3/2] grid place-items-center rounded-[18px] font-display text-2xl font-bold transition active:scale-95 disabled:opacity-50"
                  style={
                    k === 'clear' || k === 'del'
                      ? { background: 'transparent', color: 'var(--ink-3)', fontSize: '15px', fontFamily: 'var(--font-body)' }
                      : { background: 'var(--paper-2)', border: '1px solid var(--line)', boxShadow: 'var(--sh-1)', color: 'var(--ink)' }
                  }
                >
                  {k === 'del' ? <Delete size={22} aria-hidden /> : k === 'clear' ? 'Clear' : k}
                </button>
              ))}
            </div>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setMode('password')}
                className="text-xs font-semibold hover:underline"
                style={{ color: 'var(--gold-d)' }}
              >
                Sign in with Username & Password
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}} .shake{animation:shake .4s}`}</style>
    </main>
  );
}
