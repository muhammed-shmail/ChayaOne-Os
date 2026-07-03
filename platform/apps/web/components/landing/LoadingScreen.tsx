'use client';

import { motion } from 'framer-motion';

/**
 * Boot screen — a tea glass fills with gold while steam rises and a progress
 * bar completes, then the whole layer fades into the homepage. Shown once per
 * tab session (see Landing). Purely decorative; not focus-trapping.
 */
export function LoadingScreen() {
  return (
    <motion.div
      className="l-load"
      role="status"
      aria-live="polite"
      aria-label="Preparing your CafeOS"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 0.61, 0.24, 1] }}
    >
      <div className="l-load-in">
        <div className="l-glass-cup" aria-hidden>
          <span className="l-glass-steam"><i /><i /><i /></span>
          <span className="l-glass-body"><span className="l-glass-tea" /></span>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo chaya one.png" alt="Chaya.One" />
        <span className="l-load-cap">Preparing your CafeOS…</span>
        <span className="l-progress" aria-hidden><i /></span>
      </div>
    </motion.div>
  );
}
