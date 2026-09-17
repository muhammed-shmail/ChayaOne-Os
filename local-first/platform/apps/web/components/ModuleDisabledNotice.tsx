'use client';

import React from 'react';
import { ChefHat, Users, Sliders, ArrowLeft, Settings, Store } from 'lucide-react';

interface ModuleDisabledNoticeProps {
  moduleName: string;
  moduleKey?: 'kds' | 'waiter' | 'customer_qr' | string;
  description?: string;
}

export default function ModuleDisabledNotice({
  moduleName,
  moduleKey = 'kds',
  description,
}: ModuleDisabledNoticeProps) {
  const handleReturnToPos = (e: React.MouseEvent) => {
    // Notify parent window to dismiss any overlay iframe
    if (typeof window !== 'undefined') {
      if (window.parent && window.parent !== window) {
        try {
          window.parent.postMessage({ type: 'close-kds' }, '*');
          window.parent.postMessage({ type: 'close-waiter' }, '*');
          window.parent.postMessage({ type: 'close-pos' }, '*');
        } catch {}
      }

      if (window.top && window.top !== window) {
        window.top.location.href = '/pos';
      } else {
        window.location.href = '/pos';
      }
    }
  };

  const handleGoToSettings = (e: React.MouseEvent) => {
    if (typeof window !== 'undefined') {
      if (window.parent && window.parent !== window) {
        try {
          window.parent.postMessage({ type: 'close-kds' }, '*');
          window.parent.postMessage({ type: 'navigate-dashboard', tab: 'settings' }, '*');
        } catch {}
      }

      if (window.top && window.top !== window) {
        window.top.location.href = '/dashboard?tab=settings';
      } else {
        window.location.href = '/dashboard?tab=settings';
      }
    }
  };

  const defaultDesc = description || `${moduleName} is currently disabled for this venue. An administrator can enable it in Settings → Modules without reinstalling.`;

  return (
    <div
      className="flex min-h-screen w-full flex-col items-center justify-center p-4 sm:p-6 text-center select-none"
      style={{
        background: 'var(--paper-1, #f8f6f0)',
        color: 'var(--ink-1, #1e1b18)',
        minHeight: '100vh',
      }}
    >
      <div
        className="relative z-50 max-w-md w-full p-8 sm:p-10 rounded-[28px] border shadow-xl flex flex-col items-center pointer-events-auto"
        style={{
          background: 'var(--paper-2, #ffffff)',
          borderColor: 'var(--line, rgba(0, 0, 0, 0.08))',
          boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.08), 0 0 1px 1px rgba(0,0,0,0.04)',
        }}
      >
        {/* Module Icon Badge */}
        <div
          className="w-16 h-16 mb-5 rounded-2xl flex items-center justify-center shadow-sm"
          style={{
            background: moduleKey === 'kds' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.12)',
            color: moduleKey === 'kds' ? '#ef4444' : '#d97706',
            border: `1px solid ${moduleKey === 'kds' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.25)'}`,
          }}
        >
          {moduleKey === 'kds' ? (
            <ChefHat size={32} />
          ) : moduleKey === 'waiter' ? (
            <Users size={30} />
          ) : (
            <Sliders size={30} />
          )}
        </div>

        {/* Title */}
        <h1
          className="text-xl sm:text-2xl font-bold tracking-tight mb-2.5 font-display"
          style={{ color: 'var(--ink, #1c1917)' }}
        >
          {moduleName} Disabled
        </h1>

        {/* Description */}
        <p
          className="text-xs sm:text-sm mb-7 leading-relaxed"
          style={{ color: 'var(--ink-3, #78716c)' }}
        >
          {defaultDesc}
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full">
          <a
            href="/pos"
            target="_top"
            onClick={handleReturnToPos}
            className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-sm hover:shadow hover:brightness-105 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
            style={{
              background: 'var(--turmeric, #d97706)',
              color: '#ffffff',
              minHeight: '44px',
              textDecoration: 'none',
            }}
          >
            <ArrowLeft size={16} />
            <span>Return to POS</span>
          </a>

          <a
            href="/dashboard?tab=settings"
            target="_top"
            onClick={handleGoToSettings}
            className="w-full sm:w-auto px-5 py-3 rounded-xl font-bold text-xs sm:text-sm border transition-all hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
            style={{
              background: 'transparent',
              borderColor: 'var(--line-2, rgba(0, 0, 0, 0.15))',
              color: 'var(--ink, #292524)',
              minHeight: '44px',
              textDecoration: 'none',
            }}
          >
            <Settings size={16} />
            <span>Settings</span>
          </a>
        </div>
      </div>
    </div>
  );
}
