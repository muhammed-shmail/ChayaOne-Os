'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertOctagon,
  ShieldCheck,
  Phone,
  MessageSquare,
  Mail,
  ExternalLink,
  Copy,
  Check,
  KeyRound,
  RefreshCw,
  Sparkles,
  Calendar,
  Layers,
  Lock,
} from 'lucide-react';
import type { LicenseStatusResponse, LicensePeriod } from '@cafeos/types';

export default function ExpiredClient() {
  const router = useRouter();
  const [status, setStatus] = useState<LicenseStatusResponse | null>(null);
  const [copied, setCopied] = useState(false);

  // Modals
  const [showContactModal, setShowContactModal] = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(false);

  // Renewal Form State
  const [authMode, setAuthMode] = useState<'admin_pass' | 'offline_token'>('admin_pass');
  const [adminPassphrase, setAdminPassphrase] = useState('');
  const [offlineToken, setOfflineToken] = useState('');
  const [period, setPeriod] = useState<LicensePeriod>('3_months');
  const [customStartDate, setCustomStartDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [customEndDate, setCustomEndDate] = useState(
    new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const loadStatus = async () => {
    try {
      const res = await fetch('/api/license/status');
      if (res.ok) {
        const data: LicenseStatusResponse = await res.json();
        setStatus(data);
        if (!data.isExpired && !data.clockTampered && data.isConfigured) {
          // If already active, redirect back to POS
          router.push('/pos');
        }
      }
    } catch {}
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleCopyInstallationId = () => {
    if (status?.installationId) {
      navigator.clipboard.writeText(status.installationId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRenewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSuccessMessage('');

    try {
      const payload: any = {
        period,
        businessId: status?.businessId || undefined,
      };

      if (authMode === 'admin_pass') {
        if (!adminPassphrase) {
          setError('Administrative activation key is required.');
          setBusy(false);
          return;
        }
        payload.adminPassphrase = adminPassphrase;
        if (period === 'custom') {
          payload.customStartDate = customStartDate;
          payload.customEndDate = customEndDate;
        }
      } else {
        if (!offlineToken) {
          setError('Offline license token is required.');
          setBusy(false);
          return;
        }
        payload.offlineToken = offlineToken.trim();
      }

      const res = await fetch('/api/license/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Renewal failed. Please verify credentials.');
        setBusy(false);
        return;
      }

      setSuccessMessage('License successfully renewed! System unlocked.');
      setTimeout(() => {
        router.push('/pos');
      }, 1500);
    } catch (err: any) {
      setError(err?.message || 'Network error during license activation.');
      setBusy(false);
    }
  };

  return (
    <main
      className="min-h-screen grid place-items-center p-4 sm:p-6"
      style={{
        background:
          'radial-gradient(80% 55% at 50% 0%, rgba(180,67,31,.18), transparent 65%), var(--paper)',
        color: 'var(--ink)',
      }}
    >
      <div className="w-full max-w-xl text-center">
        {/* Brand Header */}
        <div className="mb-6 flex flex-col items-center">
          <img
            src="/logo chaya one.png"
            alt="ChayaOne"
            style={{ width: 220, height: 'auto', maxWidth: '78%' }}
            className="brand-logo object-contain mx-auto block mb-3"
          />

          <div
            className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider mb-2"
            style={{
              background: 'color-mix(in srgb, var(--clay) 15%, transparent)',
              border: '1px solid color-mix(in srgb, var(--clay) 35%, transparent)',
              color: 'var(--clay)',
            }}
          >
            <AlertOctagon className="w-3.5 h-3.5" />
            <span>ChayaOne License Expired</span>
          </div>

          <h1 className="font-display text-[30px] sm:text-[34px] font-bold tracking-tight text-[var(--ink)] leading-tight">
            Operational System Locked
          </h1>
          <p className="text-xs sm:text-sm text-[var(--ink-3)] font-medium mt-1.5 max-w-md">
            Your ChayaOne commercial license period has concluded. Operational billing and order creation are paused.
          </p>
        </div>

        {/* Status Card */}
        <div
          className="rounded-[24px] p-6 text-left space-y-4 mb-6"
          style={{
            background: 'var(--paper-2)',
            border: '1px solid var(--line)',
            boxShadow: 'var(--sh-2)',
          }}
        >
          <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink-3)]">
              License State
            </span>
            <span
              className="px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase"
              style={{
                background: 'color-mix(in srgb, var(--clay) 15%, transparent)',
                color: 'var(--clay)',
              }}
            >
              EXPIRED
            </span>
          </div>

          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-3)] block mb-1">
              Installation ID (Provide to Nuro7 Support)
            </span>
            <div className="flex items-center gap-2">
              <div
                className="flex-1 px-3.5 py-2.5 rounded-[12px] font-mono text-xs font-bold select-all break-all"
                style={{
                  background: 'var(--paper-3)',
                  border: '1px solid var(--line-2)',
                  color: 'var(--ink)',
                }}
              >
                {status?.installationId || 'Loading…'}
              </div>
              <button
                type="button"
                onClick={handleCopyInstallationId}
                className="px-3 py-2.5 rounded-[12px] text-xs font-bold transition flex items-center gap-1.5 shrink-0"
                style={{
                  background: 'var(--paper-3)',
                  border: '1px solid var(--line-2)',
                  color: 'var(--ink-2)',
                }}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <div
            className="p-3.5 rounded-[14px] text-xs font-medium leading-relaxed flex items-start gap-2.5"
            style={{
              background: 'color-mix(in srgb, var(--gold) 10%, var(--paper-3))',
              border: '1px solid color-mix(in srgb, var(--gold-d) 25%, transparent)',
              color: 'var(--ink-2)',
            }}
          >
            <ShieldCheck className="w-4 h-4 text-[var(--gold)] shrink-0 mt-0.5" />
            <div>
              <strong className="block text-[var(--ink)] font-bold mb-0.5">Data Safety Guarantee</strong>
              Your database, past orders, sales history, products, and customer records remain 100% safe and intact.
              Renewing your license instantly restores full cashier POS and operational functionality.
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowContactModal(true)}
              className="py-3 px-4 rounded-[14px] font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2"
              style={{
                background: 'var(--paper-3)',
                border: '1px solid var(--line-2)',
                color: 'var(--ink)',
              }}
            >
              <Phone className="w-4 h-4" />
              <span>Contact Nuro7 Team</span>
            </button>

            <button
              type="button"
              onClick={() => setShowRenewModal(true)}
              className="py-3 px-4 bg-[var(--gold-grad)] hover:opacity-95 text-[var(--espresso)] font-extrabold text-xs sm:text-sm rounded-[14px] border border-[var(--gold-d)] shadow-[var(--sh-2)] transition active:scale-[0.99] flex items-center justify-center gap-2"
            >
              <KeyRound className="w-4 h-4" />
              <span>Activate / Renew</span>
            </button>
          </div>
        </div>

        <p className="text-center text-[11.5px] text-[var(--ink-3)] font-medium">
          ChayaOne OS · Nuro7 Commercial Runtime
        </p>
      </div>

      {/* ── Contact Nuro7 Support Modal ── */}
      {showContactModal && (
        <div
          className="fixed inset-0 z-[1000] grid place-items-center p-4"
          style={{ background: 'var(--scrim)' }}
        >
          <div
            className="w-full max-w-md rounded-[22px] p-6 border shadow-[var(--sh-3)] space-y-4 anim-fade"
            style={{
              background: 'var(--paper-2)',
              borderColor: 'var(--line)',
              color: 'var(--ink)',
            }}
          >
            <div className="flex items-center justify-between pb-2 border-b border-[var(--line)]">
              <h3 className="font-display font-bold text-lg text-[var(--ink)] flex items-center gap-2">
                <Phone className="w-4 h-4 text-[var(--gold)]" />
                <span>Contact Nuro7 Team</span>
              </h3>
              <button
                onClick={() => setShowContactModal(false)}
                className="w-8 h-8 rounded-full grid place-items-center text-sm font-bold text-[var(--ink-3)] hover:text-[var(--ink)]"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[var(--ink-2)] leading-relaxed">
              Reach out to our official support and deployment specialists for prompt license renewal and billing assistance.
            </p>

            <div className="space-y-2.5">
              <a
                href="https://wa.me/919995366767?text=Hello%20Nuro7%20Team%2C%20I%20would%20like%20to%20renew%20my%20ChayaOne%20License.%20Installation%20ID%3A%20"
                target="_blank"
                rel="noreferrer"
                className="p-3 rounded-[12px] flex items-center gap-3 transition hover:opacity-90 font-medium text-xs border"
                style={{
                  background: 'color-mix(in srgb, #16a34a 12%, var(--paper-3))',
                  borderColor: 'color-mix(in srgb, #16a34a 30%, transparent)',
                  color: 'var(--ink)',
                }}
              >
                <MessageSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-bold">WhatsApp Direct Support</div>
                  <div className="text-[11px] text-[var(--ink-3)]">+91 99953 66767</div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-[var(--ink-3)]" />
              </a>

              <a
                href="tel:+919995366767"
                className="p-3 rounded-[12px] flex items-center gap-3 transition hover:opacity-90 font-medium text-xs border"
                style={{
                  background: 'var(--paper-3)',
                  borderColor: 'var(--line-2)',
                  color: 'var(--ink)',
                }}
              >
                <Phone className="w-4 h-4 text-[var(--gold)] shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-bold">Phone Support</div>
                  <div className="text-[11px] text-[var(--ink-3)]">+91 99953 66767 (Mon–Sat 9AM–9PM)</div>
                </div>
              </a>

              <a
                href="mailto:support@nuro7.com"
                className="p-3 rounded-[12px] flex items-center gap-3 transition hover:opacity-90 font-medium text-xs border"
                style={{
                  background: 'var(--paper-3)',
                  borderColor: 'var(--line-2)',
                  color: 'var(--ink)',
                }}
              >
                <Mail className="w-4 h-4 text-[var(--ink-3)] shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-bold">Email Helpdesk</div>
                  <div className="text-[11px] text-[var(--ink-3)]">support@nuro7.com</div>
                </div>
              </a>
            </div>

            <button
              type="button"
              onClick={() => setShowContactModal(false)}
              className="w-full py-2.5 rounded-[12px] font-bold text-xs text-[var(--ink-2)] bg-[var(--paper-3)] border border-[var(--line-2)] hover:bg-[var(--paper)] transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── Activate / Renew License Modal ── */}
      {showRenewModal && (
        <div
          className="fixed inset-0 z-[1000] grid place-items-center p-4"
          style={{ background: 'var(--scrim)' }}
        >
          <div
            className="w-full max-w-lg rounded-[22px] p-6 border shadow-[var(--sh-3)] space-y-4 anim-fade text-left max-h-[90vh] overflow-y-auto"
            style={{
              background: 'var(--paper-2)',
              borderColor: 'var(--line)',
              color: 'var(--ink)',
            }}
          >
            <div className="flex items-center justify-between pb-2 border-b border-[var(--line)]">
              <h3 className="font-display font-bold text-lg text-[var(--ink)] flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[var(--gold)]" />
                <span>Authorized License Activation</span>
              </h3>
              <button
                onClick={() => setShowRenewModal(false)}
                className="w-8 h-8 rounded-full grid place-items-center text-sm font-bold text-[var(--ink-3)] hover:text-[var(--ink)]"
              >
                ✕
              </button>
            </div>

            {error && (
              <div
                className="p-3 rounded-[12px] text-xs font-bold text-[var(--clay)] flex items-center gap-2"
                style={{
                  background: 'color-mix(in srgb, var(--clay) 12%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--clay) 30%, transparent)',
                }}
              >
                <AlertOctagon className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMessage && (
              <div
                className="p-3 rounded-[12px] text-xs font-bold text-[var(--cardamom-d)] flex items-center gap-2"
                style={{
                  background: 'color-mix(in srgb, var(--cardamom) 12%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--cardamom) 30%, transparent)',
                }}
              >
                <Check className="w-4 h-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            <form onSubmit={handleRenewSubmit} className="space-y-4">
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
                  Admin Key Activation
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
                <>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--ink-2)] mb-1.5">
                      Nuro7 Administrative Activation Key
                    </label>
                    <input
                      type="password"
                      required
                      value={adminPassphrase}
                      onChange={(e) => setAdminPassphrase(e.target.value)}
                      placeholder="Enter authorized administrator credential"
                      className="w-full px-3.5 py-2.5 bg-[var(--paper-3)] border border-[var(--line-2)] rounded-[12px] text-xs font-mono focus:outline-none focus:border-[var(--gold)]"
                    />
                    <p className="text-[10.5px] text-[var(--ink-3)] mt-1">
                      Validated server-side with salted cryptography. Never stored in plaintext.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--ink-2)] mb-1.5">
                      License Duration
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: '1_month', label: '1 Month' },
                        { id: '2_months', label: '2 Months' },
                        { id: '3_months', label: '3 Months' },
                        { id: 'custom', label: 'Custom' },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setPeriod(opt.id as LicensePeriod)}
                          className={`py-2 px-2.5 rounded-[10px] text-xs font-bold border transition ${
                            period === opt.id
                              ? 'bg-[var(--gold-grad)] text-[var(--espresso)] border-[var(--gold-d)]'
                              : 'bg-[var(--paper-3)] text-[var(--ink-2)] border-[var(--line-2)]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {period === 'custom' && (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[10.5px] font-bold text-[var(--ink-3)] mb-1">
                          Start Date
                        </label>
                        <input
                          type="date"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                          className="w-full px-3 py-2 bg-[var(--paper-3)] border border-[var(--line-2)] rounded-[10px] text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10.5px] font-bold text-[var(--ink-3)] mb-1">
                          Expiry Date
                        </label>
                        <input
                          type="date"
                          value={customEndDate}
                          onChange={(e) => setCustomEndDate(e.target.value)}
                          className="w-full px-3 py-2 bg-[var(--paper-3)] border border-[var(--line-2)] rounded-[10px] text-xs font-mono"
                        />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--ink-2)] mb-1.5">
                    Paste Signed Offline License Token
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={offlineToken}
                    onChange={(e) => setOfflineToken(e.target.value)}
                    placeholder="CHAYAONE-LIC-eyJsaWNlbnNlSWQi..."
                    className="w-full px-3.5 py-2.5 bg-[var(--paper-3)] border border-[var(--line-2)] rounded-[12px] text-xs font-mono focus:outline-none focus:border-[var(--gold)]"
                  />
                  <p className="text-[10.5px] text-[var(--ink-3)] mt-1">
                    Cryptographically signed by Nuro7 Licensing Authority for Installation ID: {status?.installationId}
                  </p>
                </div>
              )}

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRenewModal(false)}
                  className="w-1/3 py-2.5 rounded-[12px] font-bold text-xs text-[var(--ink-3)] bg-[var(--paper-3)] border border-[var(--line-2)] hover:bg-[var(--paper)] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-2/3 py-2.5 bg-[var(--gold-grad)] hover:opacity-95 disabled:opacity-50 text-[var(--espresso)] font-extrabold text-xs sm:text-sm rounded-[12px] border border-[var(--gold-d)] shadow-[var(--sh-1)] transition flex items-center justify-center gap-2"
                >
                  {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  <span>{busy ? 'Validating & Signing…' : 'Activate & Unlock System'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
