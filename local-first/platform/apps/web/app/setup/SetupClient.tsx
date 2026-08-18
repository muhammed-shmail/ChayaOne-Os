'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SetupClient() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [cafeName, setCafeName] = useState('Kahwa House');
  const [subdomain, setSubdomain] = useState('kahwa');
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

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}>
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
        <div className="text-center mb-6">
          <div className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-2">
            CHAYAONE OS — STEP 7
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Main Cafe PC Setup</h1>
          <p className="text-xs text-slate-400 mt-1">First-time cafe configuration wizard</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSetupSubmit} className="space-y-4 text-sm">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Cafe / Restaurant Name</label>
                <input
                  type="text"
                  required
                  value={cafeName}
                  onChange={(e) => setCafeName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  placeholder="e.g. Kaava Cafe"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Subdomain Slug</label>
                <input
                  type="text"
                  required
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  placeholder="e.g. kaava"
                />
              </div>

              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors mt-2"
              >
                Next: Staff PIN Security ➔
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Owner Name</label>
                <input
                  type="text"
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Owner 4-Digit PIN</label>
                <input
                  type="password"
                  maxLength={4}
                  required
                  value={ownerPin}
                  onChange={(e) => setOwnerPin(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-center tracking-widest text-lg focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Manager 4-Digit PIN</label>
                <input
                  type="password"
                  maxLength={4}
                  required
                  value={managerPin}
                  onChange={(e) => setManagerPin(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-center tracking-widest text-lg focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-1/3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg transition-colors"
                >
                  ⬅ Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="w-2/3 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors"
                >
                  Next: Hardware Printer ➔
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Thermal Printer IP (Optional)</label>
                <input
                  type="text"
                  value={printerIp}
                  onChange={(e) => setPrinterIp(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500"
                  placeholder="e.g. 192.168.1.200"
                />
                <p className="text-[11px] text-slate-400 mt-1">Leave empty to use local Windows printer or configure later in settings.</p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-1/3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg transition-colors"
                >
                  ⬅ Back
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-2/3 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
                >
                  {busy ? 'Initializing Store...' : 'Complete & Launch POS 🚀'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
