'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { LandingStyles } from './styles';
import { LoadingScreen } from './LoadingScreen';
import { Navbar } from './Navbar';
import { Hero } from './Hero';
import { ChipsBand, Features } from './Features';
import { Stats } from './Stats';
import { Pricing } from './Pricing';
import { Testimonials } from './Testimonials';
import { AboutStrip, CtaBand, Footer } from './Footer';

const BOOT_KEY = 'chaya-booted';

export function Landing({ signedIn }: { signedIn: boolean }) {
  // Boot screen — shown once per tab session, then fades into the page.
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem(BOOT_KEY) === '1'; } catch { /* private mode */ }
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (seen) { setBooting(false); return; }
    const t = setTimeout(() => {
      try { sessionStorage.setItem(BOOT_KEY, '1'); } catch { /* ignore */ }
      setBooting(false);
    }, reduce ? 600 : 2100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="landing">
      <LandingStyles />

      {/* animated atmosphere + grain (fixed, behind everything) */}
      <div className="l-atmos" aria-hidden>
        <span className="l-orb a" />
        <span className="l-orb b" />
        <span className="l-orb c" />
      </div>
      <div className="l-grain" aria-hidden />

      <AnimatePresence>{booting && <LoadingScreen key="boot" />}</AnimatePresence>

      <div className="l-shell">
        <Navbar signedIn={signedIn} />
        <main>
          <Hero />
          <ChipsBand />
          <Stats />
          <Features />
          <Pricing />
          <Testimonials />
          <AboutStrip />
          <CtaBand />
        </main>
        <Footer />
      </div>
    </div>
  );
}
