'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Delete, Lock, UserCheck, Utensils } from 'lucide-react';

export default function WaiterLoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDigit = (digit: string) => {
    if (pin.length < 6) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError(null);
      if (nextPin.length === 4) {
        submitLogin(nextPin);
      }
    }
  };

  const handleClear = () => {
    setPin('');
    setError(null);
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
    setError(null);
  };

  const submitLogin = async (pinToVerify: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinToVerify }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error === 'invalid_pin' ? 'Invalid PIN. Please try again.' : 'Login failed');
        setPin('');
      } else {
        router.push('/tables');
      }
    } catch (err) {
      setError('Connection error. Ensure local server is running.');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 max-w-md mx-auto">
      {/* Brand Header */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center mb-3 shadow-lg shadow-sky-500/10">
          <Utensils className="w-8 h-8 text-sky-400" />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">ChayaOne Waiter</h1>
        <p className="text-sm text-gray-400 mt-1">Enter your staff PIN to begin</p>
      </div>

      {/* PIN Dots Indicator */}
      <div className="flex items-center gap-4 mb-8">
        {[0, 1, 2, 3].map((index) => {
          const filled = index < pin.length;
          return (
            <div
              key={index}
              className={`w-4 h-4 rounded-full transition-all duration-200 ${
                filled
                  ? 'bg-sky-400 scale-125 shadow-md shadow-sky-400/50'
                  : 'bg-gray-800 border border-gray-700'
              }`}
            />
          );
        })}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 py-2 px-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium text-center animate-shake">
          {error}
        </div>
      )}

      {/* Numpad Grid */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button
            key={digit}
            onClick={() => handleDigit(digit)}
            disabled={loading}
            className="h-16 rounded-2xl bg-gray-900/80 hover:bg-gray-800/80 active:bg-sky-600 active:text-white border border-gray-800 text-xl font-semibold text-gray-100 flex items-center justify-center transition-all duration-100 shadow-sm active:scale-95 touch-manipulation"
          >
            {digit}
          </button>
        ))}
        <button
          onClick={handleClear}
          disabled={loading || pin.length === 0}
          className="h-16 rounded-2xl bg-gray-900/40 hover:bg-gray-800/40 border border-gray-800/60 text-sm font-medium text-gray-400 active:text-rose-400 flex items-center justify-center transition-all active:scale-95"
        >
          CLEAR
        </button>
        <button
          onClick={() => handleDigit('0')}
          disabled={loading}
          className="h-16 rounded-2xl bg-gray-900/80 hover:bg-gray-800/80 active:bg-sky-600 active:text-white border border-gray-800 text-xl font-semibold text-gray-100 flex items-center justify-center transition-all duration-100 shadow-sm active:scale-95"
        >
          0
        </button>
        <button
          onClick={handleDelete}
          disabled={loading || pin.length === 0}
          className="h-16 rounded-2xl bg-gray-900/40 hover:bg-gray-800/40 border border-gray-800/60 text-gray-400 active:text-sky-400 flex items-center justify-center transition-all active:scale-95"
        >
          <Delete className="w-5 h-5" />
        </button>
      </div>

      {loading && (
        <p className="text-xs text-sky-400 mt-6 animate-pulse">Authenticating staff session...</p>
      )}
    </main>
  );
}
