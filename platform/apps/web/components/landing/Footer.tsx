'use client';

import { ArrowRight, Coffee, Mail, Phone } from 'lucide-react';
import { Rise } from './primitives';

/* Brand social marks — lucide 1.21 ships no brand glyphs, so these are minimal
   inline SVGs (filled, currentColor) sized to match the footer chrome. */
const SOCIALS: { label: string; href: string; path: React.ReactNode }[] = [
  {
    label: 'Instagram', href: '#', path: (
      <><rect x="3" y="3" width="18" height="18" rx="5" ry="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" /></>
    )
  },
  {
    label: 'X', href: '#', path: (
      <path d="M4 3h3.3l4.2 5.7L16.8 3H20l-6.5 8L20.4 21H17l-4.6-6.2L7 21H3.8l6.9-8.4L4 3z" fill="currentColor" />
    )
  },
  {
    label: 'LinkedIn', href: '#', path: (
      <><rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M7 10v7M7 7.2v.01M11 17v-4a2 2 0 0 1 4 0v4M11 17v-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></>
    )
  },
  {
    label: 'YouTube', href: '#', path: (
      <><rect x="2.5" y="5.5" width="19" height="13" rx="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M10.5 9.2l4.2 2.8-4.2 2.8V9.2z" fill="currentColor" /></>
    )
  },
];

export function AboutStrip() {
  return (
    <section className="l-section-tight" id="about">
      <div className="l-container">
        <Rise>
          <div className="l-about">
            <span className="l-eyebrow center">The company</span>
            <p style={{ fontSize: 'clamp(16px,2vw,20px)', lineHeight: 1.6, color: 'var(--l-ink-2)', maxWidth: '62ch' }}>
              Chaya.One is built by <span className="n7">Nuro 7</span> — we build intelligent
              operating systems for Indian businesses, starting with the cafés we love.
            </p>
          </div>
        </Rise>
      </div>
    </section>
  );
}

export function CtaBand() {
  return (
    <section className="l-section-tight">
      <div className="l-container">
        <Rise>
          <div className="l-cta-band">
            <h2 className="l-cta-h">Run your café like the<br />best in the country.</h2>
            <p className="l-cta-p">
              Join 150+ cafés growing on Chaya.One. Start free — no card, no lock-in —
              and be serving smarter by tomorrow morning.
            </p>
            <div className="l-cta-actions">
              <a href="/login" className="l-btn l-btn-primary l-btn-lg">
                Start free trial <ArrowRight size={18} className="ic" strokeWidth={2} />
              </a>
              <a
                href="#contact"
                className="l-btn l-btn-lg"
                style={{ background: 'rgba(255,255,255,.08)', color: '#F7EEDD', border: '1px solid rgba(247,238,221,.28)' }}
              >
                Book a live demo
              </a>
            </div>
          </div>
        </Rise>
      </div>
    </section>
  );
}

const COLS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Product', links: [
      { label: 'Features', href: '#features' }, { label: 'Pricing', href: '#pricing' },
      { label: 'Customer app', href: '#features' }, { label: 'Live demo', href: '#contact' },
    ]
  },
  {
    title: 'Company', links: [
      { label: 'About', href: '#about' }, { label: 'Customers', href: '#customers' },
      { label: 'Backed by Nuro 7', href: '#about' }, { label: 'Careers', href: '#contact' },
    ]
  },
  {
    title: 'Support', links: [
      { label: 'Help center', href: '#contact' }, { label: 'Book a demo', href: '#contact' },
      { label: 'GST & compliance', href: '#features' }, { label: 'System status', href: '#' },
    ]
  },
];

export function Footer() {
  return (
    <footer className="l-footer" id="contact">
      <div className="l-container" style={{ paddingTop: 'clamp(56px,7vw,84px)', paddingBottom: 40 }}>
        <div className="l-foot-grid">
          <div className="l-foot-brand">
            <span className="l-brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo chaya one.png" alt="Chaya.One — backed by Nuro 7" style={{ height: 46 }} />
            </span>
            <p>The growth operating system for cafés — billing, kitchen, inventory,
              customers and AI, in one warm, intelligent platform.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16, fontSize: 14, color: 'var(--l-ink-2)' }}>
              <a className="l-foot-link" href="mailto:hello@chaya.one" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Mail size={16} strokeWidth={2} /> nuro7@chaya.one
              </a>
              <a className="l-foot-link" href="tel:+919446617887" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Phone size={16} strokeWidth={2} /> +91 9446 617 887
              </a>
            </div>
            <div className="l-social">
              {SOCIALS.map((s) => (
                <a key={s.label} href={s.href} aria-label={s.label}>
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>{s.path}</svg>
                </a>
              ))}
            </div>
          </div>

          {COLS.map((col) => (
            <div key={col.title} className="l-foot-col">
              <h4>{col.title}</h4>
              {col.links.map((l) => (
                <a key={l.label} href={l.href} className="l-foot-link">{l.label}</a>
              ))}
            </div>
          ))}
        </div>

        <div className="l-foot-bottom">
          <span>© 2026 Chaya.One · Backed by Nuro 7 · All rights reserved.</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            <a href="#" className="l-foot-link" style={{ padding: 0 }}>Privacy</a>
            <a href="#" className="l-foot-link" style={{ padding: 0 }}>Terms</a>
            <span className="l-madein">Made with <Coffee size={15} strokeWidth={2} /> in India</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
