'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BrandMark } from '@/components/BrandMark';
import { Delete, AlphaTag, Eye, EyeOff, WaveHand } from '@/components/ui';
import { getGeoHeaders } from '@/lib/geo-client';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'del'];

type Staff = { name: string; role: string };

interface LoginClientProps {
  initialBusinessName?: string;
  initialLogoUrl?: string | null;
}

export default function LoginClient({ initialBusinessName }: LoginClientProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get('next');
  const safeNext = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : null;

  const [businessName, setBusinessName] = useState<string>(initialBusinessName || '');

  useEffect(() => {
    fetch('/api/auth/store-info')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.name) setBusinessName(d.name);
      })
      .catch(() => {});
  }, []);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // after a correct PIN we pause on an attendance-confirm step before entering
  const [staff, setStaff] = useState<Staff | null>(null);
  const [openSince, setOpenSince] = useState<string | null>(null); // existing open punch, if any
  const [geoRequired, setGeoRequired] = useState(false); // outlet location gate applies to this clock-in
  const [attError, setAttError] = useState<string | null>(null); // clock-in blocked (off-site / no GPS)

  // login mode: defaults to username + password (secure credentials required)
  const [mode, setMode] = useState<'pin' | 'password'>('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // reveal/hide the password field
  const [notice, setNotice] = useState<string | null>(null); // info hint, e.g. "use password"

  const dest =
    safeNext ||
    (staff?.role === 'kitchen'
      ? '/kds'
      : staff?.role === 'owner' || staff?.role === 'manager' || staff?.role === 'cashier' || staff?.role === 'accountant'
      ? '/dashboard'
      : '/pos');

  // shared post-login step: cookie is set — check today's attendance then show confirm
  async function enterWith(who: Staff) {
    const att = await fetch('/api/attendance').then((r) => (r.ok ? r.json() : null)).catch(() => null);
    let validSince: string | null = att?.open?.clockIn ?? null;
    if (validSince) {
      const punchMs = new Date(validSince).getTime();
      if (Date.now() - punchMs > 16 * 3600 * 1000) {
        validSince = null; // Stale punch from previous day, allow fresh clock-in
      }
    }
    setOpenSince(validSince);
    setGeoRequired(!!att?.geoRequired);
    setStaff(who);
  }

  async function submit(code: string) {
    setBusy(true);
    setError(false);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pin: code }),
      });
      if (!res.ok) throw new Error();
      const { staff: who } = await res.json().catch(() => ({ staff: null }));
      if (!who?.role) throw new Error();
      await enterWith(who);
      setBusy(false);
    } catch {
      setError(true);
      setErrorMsg('Wrong PIN — try again');
      setPin('');
      setBusy(false);
    }
  }

  async function submitPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;

    // Read values directly from DOM form elements in case of browser autofill
    const form = e.currentTarget;
    const userEl = form.elements.namedItem('username') as HTMLInputElement | null;
    const passEl = form.elements.namedItem('password') as HTMLInputElement | null;
    const userVal = (userEl?.value || username).trim();
    const passVal = passEl?.value || password;

    if (!userVal || !passVal) {
      setError(true);
      setErrorMsg('Please enter both username and password');
      return;
    }

    setBusy(true);
    setError(false);
    setErrorMsg(null);
    setNotice(null);

    try {
      const res = await fetch('/api/auth/login/password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: userVal, password: passVal }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        setError(true);
        setErrorMsg(data?.message || 'Wrong username or password');
        setBusy(false);
        return;
      }

      const who = data.staff;
      // Direct entrance into app without attendance gate
      const targetDest =
        safeNext ||
        who?.targetDest ||
        (who?.role === 'kitchen'
          ? '/kds'
          : who?.role === 'owner' || who?.role === 'manager' || who?.role === 'cashier' || who?.role === 'accountant'
          ? '/dashboard'
          : '/pos');

      if (typeof window !== 'undefined') {
        window.location.href = targetDest;
      } else {
        router.replace(targetDest);
        router.refresh();
      }
    } catch {
      setError(true);
      setErrorMsg('Network error. Could not reach server.');
      setBusy(false);
    }
  }

  // clock in (unless already open) then enter the app
  async function confirmAttendance(mark: boolean) {
    setBusy(true);
    setAttError(null);
    if (mark && !openSince) {
      // location gate (strict): staff must be at the cafe. Only capture GPS
      // when the gate applies, so a location prompt never appears otherwise.
      const geo = geoRequired ? await getGeoHeaders(12000) : {};
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...geo },
        body: JSON.stringify({ action: 'in' }),
      }).catch(() => null);
      // a real 403 means off-site / no GPS → block and stay on the confirm step.
      // (a null res is a network hiccup, not proof of absence — let them through.)
      if (geoRequired && res && res.status === 403) {
        const d = await res.json().catch(() => ({}));
        setAttError(
          d.error === 'no_gps'
            ? 'Turn on location to mark attendance — you must be at the cafe to clock in.'
            : 'You’re not at the cafe. Come on-site to clock in.',
        );
        setBusy(false);
        return;
      }
    }
    if (typeof window !== 'undefined') {
      window.location.href = dest;
    } else {
      router.replace(dest);
      router.refresh();
    }
  }

  async function clockOutAndExit() {
    setBusy(true);
    setAttError(null);
    try {
      const geo = geoRequired ? await getGeoHeaders(12000) : {};
      await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...geo },
        body: JSON.stringify({ action: 'out' }),
      });
      setOpenSince(null);
      setStaff(null);
      setPin('');
      setNotice('Shift ended. You have been clocked out successfully.');
    } catch {
      setAttError('Network error clocking out.');
    } finally {
      setBusy(false);
    }
  }

  function press(k: string) {
    if (busy) return;
    if (k === 'clear') return setPin('');
    if (k === 'del') return setPin((p) => p.slice(0, -1));
    if (pin.length >= 6) return;
    const next = pin + k;
    setPin(next);
    if (next.length === 4) submit(next); // auto-submit at 4 digits
  }

  // ---- attendance confirmation step (shown after a correct PIN) ----
  if (staff) {
    const clockedTime = openSince
      ? new Date(openSince).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      : new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    return (
      <main className="min-h-screen grid place-items-center p-6" style={{ background: 'radial-gradient(80% 60% at 50% 0%, rgba(232,144,42,.12), transparent 60%), var(--paper)' }}>
        <div className="w-full max-w-[360px] text-center">
          <div className="w-[72px] h-[72px] mx-auto mb-4 rounded-full grid place-items-center font-display text-[28px] font-bold"
            style={{ background: 'var(--gold-grad)', color: 'var(--espresso)', border: '1px solid var(--gold-d)', boxShadow: 'var(--sh-2)' }}>
            {staff.name.trim().charAt(0).toUpperCase() || '☕'}
          </div>
          <h1 className="font-display text-[32px] leading-none inline-flex items-center justify-center gap-2">
            Hi {staff.name}
            <WaveHand className="anim-wave" size={30} />
          </h1>
          <p className="text-sm mt-1.5 capitalize" style={{ color: 'var(--ink-3)' }}>{staff.role}</p>

          <div className="lux-card mt-6 p-5 text-left">
            {openSince ? (
              <>
                <p className="font-bold text-[15px]">✅ You&apos;re already clocked in</p>
                <p className="text-sm mt-1" style={{ color: 'var(--ink-2)' }}>Since {clockedTime} today. No need to punch again.</p>
              </>
            ) : (
              <>
                <p className="font-bold text-[15px]">🕒 Mark your attendance</p>
                <p className="text-sm mt-1" style={{ color: 'var(--ink-2)' }}>Confirm to clock in at {clockedTime} and start your shift.</p>
                {geoRequired && (
                  <p className="text-xs mt-2" style={{ color: 'var(--ink-3)' }}>📍 Location required — you must be at the cafe to clock in.</p>
                )}
              </>
            )}
          </div>

          {attError && (
            <p role="alert" className="mt-4 text-sm font-semibold rounded-xl p-3"
              style={{ color: 'var(--chilli, #c0392b)', background: 'color-mix(in srgb, var(--chilli, #c0392b) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--chilli, #c0392b) 30%, transparent)' }}>
              {attError}
            </p>
          )}

          <button disabled={busy} onClick={() => confirmAttendance(true)}
            className="btn btn-lux w-full mt-5" style={{ padding: '15px', borderRadius: 16, fontSize: 16 }}>
            {busy ? 'One sec…' : openSince ? 'Continue →' : 'Confirm attendance & continue →'}
          </button>

          {openSince ? (
            <button
              type="button"
              disabled={busy}
              onClick={clockOutAndExit}
              className="w-full mt-3 py-2.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 font-bold text-xs hover:bg-red-500/20 active:scale-95 transition cursor-pointer"
            >
              {busy ? 'Clocking out…' : 'Clock out & end shift'}
            </button>
          ) : (
            <button disabled={busy} onClick={() => confirmAttendance(false)}
              className="w-full mt-3 text-sm font-bold cursor-pointer" style={{ color: 'var(--ink-3)', background: 'none', border: 'none' }}>
              Skip for now
            </button>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen grid place-items-center p-6" style={{ background: 'radial-gradient(80% 60% at 50% 0%, rgba(232,144,42,.12), transparent 60%), var(--paper)' }}>
      <div className="w-full max-w-[360px]">
        <div className="text-center mb-7 flex flex-col items-center">
          {/* The logo doubles as the owner's way in: tap it to switch to the
              secure username + password sign-in (owners have no PIN). */}
          <button
            type="button"
            disabled={busy}
            onClick={() => { setMode((m) => (m === 'pin' ? 'password' : 'pin')); setError(false); setNotice(null); setPin(''); setPassword(''); setShowPassword(false); }}
            aria-label="Owner sign in with username & password"
            title="Owner? Sign in with username & password"
            className="mb-1.5 disabled:opacity-50 flex justify-center items-center w-full"
            style={{ background: 'none', border: 'none', padding: 0, lineHeight: 0, cursor: 'pointer' }}
          >
            <img src="/logo chaya one.png" alt="ChayaOne" style={{ width: 288, height: 'auto', maxWidth: '84%' }} className="brand-logo object-contain mx-auto block" />
          </button>
          <AlphaTag />
          <h1 className="font-display text-[40px] leading-none mt-3.5">{businessName || 'ChayaOne'}</h1>
          <p className="text-sm mt-2" style={{ color: 'var(--ink-3)' }}>
            {mode === 'pin' ? 'Enter your staff PIN to open the till' : 'Sign in with your username & password'}
          </p>
        </div>

        {mode === 'pin' ? (
          <>
            {/* pin dots */}
            <div className={`flex justify-center gap-3 mb-6 ${error ? 'shake' : ''}`}>
              {Array.from({ length: 4 }).map((_, i) => (
                <span key={i} className="w-3.5 h-3.5 rounded-full transition"
                  style={{ background: i < pin.length ? 'var(--gold)' : 'transparent', border: `2px solid ${i < pin.length ? 'var(--gold-d)' : 'var(--line-2)'}`, boxShadow: i < pin.length ? '0 0 0 3px color-mix(in srgb, var(--gold) 20%, transparent)' : 'none' }} />
              ))}
            </div>

            {error && <p role="alert" className="text-center text-sm font-bold mb-4" style={{ color: 'var(--clay)' }}>Wrong PIN — try again</p>}

            <div className="grid grid-cols-3 gap-3">
              {KEYS.map((k) => (
                <button key={k} onClick={() => press(k)} disabled={busy}
                  aria-label={k === 'del' ? 'Delete' : k === 'clear' ? 'Clear' : `Digit ${k}`}
                  className="aspect-[3/2] grid place-items-center rounded-[18px] font-display text-2xl font-bold transition active:scale-95 disabled:opacity-50"
                  style={k === 'clear' || k === 'del'
                    ? { background: 'transparent', color: 'var(--ink-3)', fontSize: '15px', fontFamily: 'var(--font-body)' }
                    : { background: 'var(--paper-2)', border: '1px solid var(--line)', boxShadow: 'var(--sh-1)', color: 'var(--ink)' }}>
                  {k === 'del' ? <Delete size={22} aria-hidden /> : k === 'clear' ? 'Clear' : k}
                </button>
              ))}
            </div>
          </>
        ) : (
          <form onSubmit={submitPassword} className={`space-y-3.5 ${error ? 'shake' : ''}`}>
            {notice && (
              <div className="p-3 rounded-2xl text-center text-xs font-bold" style={{ background: 'color-mix(in srgb, var(--gold, #eab308) 15%, transparent)', color: 'var(--gold-d, #b45309)', border: '1px solid color-mix(in srgb, var(--gold, #eab308) 30%, transparent)' }}>
                {notice}
              </div>
            )}
            {errorMsg && (
              <div role="alert" className="p-3 rounded-2xl text-center text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-sm" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#dc2626', border: '1px solid rgba(239, 68, 68, 0.35)' }}>
                <span>⚠️</span>
                <span>{errorMsg}</span>
              </div>
            )}
            <input
              name="username"
              type="text" autoCapitalize="none" autoCorrect="off" autoComplete="username"
              value={username} onChange={(e) => { setUsername(e.target.value); setError(false); setErrorMsg(null); }}
              placeholder="Username or Email" disabled={busy}
              className="w-full px-4 py-3.5 rounded-2xl text-[15px] outline-none disabled:opacity-50 transition"
              style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', boxShadow: 'var(--sh-1)', color: 'var(--ink)' }}
            />
            <div className="relative">
              <input
                name="password"
                type={showPassword ? 'text' : 'password'} autoComplete="current-password"
                value={password} onChange={(e) => { setPassword(e.target.value); setError(false); setErrorMsg(null); }}
                placeholder="Password" disabled={busy}
                className="w-full pl-4 pr-12 py-3.5 rounded-2xl text-[15px] outline-none disabled:opacity-50 transition"
                style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', boxShadow: 'var(--sh-1)', color: 'var(--ink)' }}
              />
              <button
                type="button" disabled={busy} tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center w-9 h-9 rounded-xl transition disabled:opacity-50 cursor-pointer"
                style={{ color: 'var(--ink-3)', background: 'none', border: 'none' }}
              >
                {showPassword ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
              </button>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="btn btn-lux w-full disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer transition active:scale-[0.99] flex items-center justify-center gap-2.5 font-bold"
              style={{ padding: '15px', borderRadius: 16, fontSize: 16 }}
            >
              {busy ? (
                <>
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
                  <span>Signing in…</span>
                </>
              ) : (
                'Sign in →'
              )}
            </button>
          </form>
        )}
      </div>

      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}} .shake{animation:shake .4s}`}</style>
    </main>
  );
}
