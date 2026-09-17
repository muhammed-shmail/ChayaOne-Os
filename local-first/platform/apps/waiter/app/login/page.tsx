'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Delete, Lock, UserCheck, Utensils, QrCode, X, Wifi, Camera } from 'lucide-react';

function WaiterLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [userName, setUserName] = useState<string | null>(null);
  const [serverIp, setServerIp] = useState<string | null>(null);
  const [serverPort, setServerPort] = useState<string>('3000');

  const [showScannerModal, setShowScannerModal] = useState(false);
  const [scannerInput, setScannerInput] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

  useEffect(() => {
    // 1. Read URL query parameters if arriving via QR code
    const queryUser = searchParams.get('user');
    const queryServer = searchParams.get('server');
    const queryPort = searchParams.get('port') || '3000';

    if (queryUser) {
      setUserName(queryUser);
      localStorage.setItem('chayaone_waiter_user', queryUser);
    } else {
      const savedUser = localStorage.getItem('chayaone_waiter_user');
      if (savedUser) setUserName(savedUser);
    }

    if (queryServer) {
      setServerIp(queryServer);
      localStorage.setItem('chayaone_waiter_server_ip', queryServer);
    } else {
      const savedServer = localStorage.getItem('chayaone_waiter_server_ip');
      if (savedServer) setServerIp(savedServer);
    }

    if (queryPort) {
      setServerPort(queryPort);
      localStorage.setItem('chayaone_waiter_server_port', queryPort);
    }
  }, [searchParams]);

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

  const handleApplyConnection = (urlOrIp: string) => {
    try {
      if (urlOrIp.includes('://')) {
        const u = new URL(urlOrIp);
        const srv = u.searchParams.get('server') || u.hostname;
        const prt = u.searchParams.get('port') || u.port || '3000';
        const usr = u.searchParams.get('user');

        if (srv) {
          setServerIp(srv);
          localStorage.setItem('chayaone_waiter_server_ip', srv);
        }
        if (prt) {
          setServerPort(prt);
          localStorage.setItem('chayaone_waiter_server_port', prt);
        }
        if (usr) {
          setUserName(usr);
          localStorage.setItem('chayaone_waiter_user', usr);
        }
      } else if (urlOrIp.includes(':')) {
        const parts = urlOrIp.split(':');
        const ip = parts[0]?.trim();
        const port = parts[1]?.trim();
        if (ip) {
          setServerIp(ip);
          localStorage.setItem('chayaone_waiter_server_ip', ip);
        }
        if (port) {
          setServerPort(port);
          localStorage.setItem('chayaone_waiter_server_port', port);
        }
      } else if (urlOrIp.trim()) {
        setServerIp(urlOrIp.trim());
        localStorage.setItem('chayaone_waiter_server_ip', urlOrIp.trim());
      }
      setShowScannerModal(false);
      stopCamera();
    } catch {
      setError('Could not parse connection URL. Please check the format.');
    }
  };

  const startCamera = async () => {
    try {
      setCameraActive(true);
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }
    } catch (e) {
      console.warn('Camera access not available or declined:', e);
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
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
      setError('Connection error. Ensure local Main PC server is running.');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 max-w-md mx-auto relative">
      {/* Top Floating Status Pill */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <button
          onClick={() => {
            setShowScannerModal(true);
            startCamera();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-900/80 hover:bg-gray-800 border border-gray-800 text-[11px] text-sky-400 shadow-sm transition-all"
        >
          <QrCode size={13} />
          <span>{serverIp ? `${serverIp}:${serverPort}` : 'Scan Server QR'}</span>
        </button>
      </div>

      {/* Brand Header */}
      <div className="flex flex-col items-center mb-6">
        <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center mb-3 shadow-lg shadow-sky-500/10">
          <Utensils className="w-8 h-8 text-sky-400" />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">ChayaOne Waiter</h1>

        {userName ? (
          <div className="mt-2 py-1 px-3.5 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-300 text-xs font-semibold flex items-center gap-1.5 animate-fadeIn">
            <UserCheck size={14} />
            <span>Paired: {userName}</span>
            <button
              onClick={() => {
                setUserName(null);
                localStorage.removeItem('chayaone_waiter_user');
              }}
              className="text-gray-400 hover:text-white ml-1 text-xs"
              title="Change User"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center mt-1">
            <p className="text-sm text-gray-400">Enter your staff PIN to begin</p>
            <div className="flex gap-3 mt-3 text-xs text-gray-500 font-medium">
              <span className="bg-gray-800/50 px-2.5 py-1 rounded-md border border-gray-700/50">Owner: 1111</span>
              <span className="bg-gray-800/50 px-2.5 py-1 rounded-md border border-gray-700/50">Manager: 4444</span>
            </div>
          </div>
        )}
      </div>

      {/* PIN Dots Indicator */}
      <div className="flex items-center gap-4 mb-6">
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

      {/* QR Code Scanner / Server Connection Modal */}
      {showScannerModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 max-w-sm w-full flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="text-sky-400" size={20} />
                <h3 className="font-bold text-base text-white">Connect to Main PC Server</h3>
              </div>
              <button
                onClick={() => {
                  setShowScannerModal(false);
                  stopCamera();
                }}
                className="text-gray-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-gray-400">
              Scan the QR code displayed on the Main PC desktop app screen (Settings → App Qrs) or paste the connection URL.
            </p>

            {cameraActive && (
              <div className="w-full h-48 bg-black rounded-2xl overflow-hidden relative border border-gray-800">
                <video ref={videoRef} className="w-full h-full object-cover" playsInline />
                <div className="absolute inset-4 border-2 border-sky-400/60 rounded-xl pointer-events-none animate-pulse" />
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                Connection URL / Server IP
              </label>
              <input
                type="text"
                value={scannerInput}
                onChange={(e) => setScannerInput(e.target.value)}
                placeholder="http://10.226.223.152:3002/login..."
                className="h-10 px-3 rounded-xl bg-gray-800/80 border border-gray-700 text-xs text-white font-mono placeholder:text-gray-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => handleApplyConnection(scannerInput)}
                disabled={!scannerInput.trim()}
                className="flex-1 h-10 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center transition-all"
              >
                Apply &amp; Connect
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowScannerModal(false);
                  stopCamera();
                }}
                className="px-4 h-10 rounded-xl bg-gray-800 text-gray-300 text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function WaiterLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400 text-xs">Loading terminal...</div>}>
      <WaiterLoginForm />
    </Suspense>
  );
}
