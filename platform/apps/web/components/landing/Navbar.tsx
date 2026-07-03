'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ArrowRight } from 'lucide-react';
import { navLinks } from './data';

export function Navbar({ signedIn }: { signedIn: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <header className={`l-nav ${scrolled ? 'scrolled' : ''}`}>
      <div className="l-container">
        <nav className="l-nav-inner" aria-label="Primary">
          <a href="#top" className="l-brand" aria-label="Chaya.One home">
            <span className="wm">Chaya<b>.One</b></span>
          </a>

          <div className="l-menu">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} className="l-nav-link">{l.label}</a>
            ))}
          </div>

          <div className="l-nav-actions">
            {signedIn ? (
              <a href="/dashboard" className="l-btn l-btn-primary">
                Open dashboard <ArrowRight size={17} className="ic" strokeWidth={2} />
              </a>
            ) : (
              <>
                <a href="#contact" className="l-btn l-btn-ghost l-desk">Book demo</a>
                <a href="/login" className="l-btn l-btn-primary">
                  Start free trial <ArrowRight size={17} className="ic" strokeWidth={2} />
                </a>
              </>
            )}
            <button
              type="button"
              className="l-burger"
              aria-label="Open menu"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <Menu size={20} strokeWidth={2} />
            </button>
          </div>
        </nav>
      </div>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="l-drawer-scrim"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              className="l-drawer"
              role="dialog" aria-modal="true" aria-label="Menu"
              initial={{ opacity: 0, y: -14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -14, scale: 0.98 }}
              transition={{ duration: 0.28, ease: [0.22, 0.61, 0.24, 1] }}
            >
              <div className="l-drawer-head">
                <span className="l-brand"><span className="wm">Chaya<b>.One</b></span></span>
                <button type="button" className="l-burger" aria-label="Close menu" onClick={() => setOpen(false)}>
                  <X size={20} strokeWidth={2} />
                </button>
              </div>
              {navLinks.map((l) => (
                <a key={l.href} href={l.href} className="l-drawer-link" onClick={() => setOpen(false)}>{l.label}</a>
              ))}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                {signedIn ? (
                  <a href="/dashboard" className="l-btn l-btn-primary" onClick={() => setOpen(false)}>Open dashboard</a>
                ) : (
                  <>
                    <a href="/login" className="l-btn l-btn-primary" onClick={() => setOpen(false)}>Start free trial</a>
                    <a href="#contact" className="l-btn l-btn-ghost" onClick={() => setOpen(false)}>Book a demo</a>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
