'use client';

import { Fragment, useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, PlayCircle, Receipt, MapPin, WifiOff } from 'lucide-react';
import { LivingCounter } from './LivingCounter';
import { L_EASE } from './primitives';

/** Word-by-word reveal for the hero heading. `em` renders in italic gold. */
function AnimatedHeading({ text, em }: { text: string; em: string }) {
  const reduce = useReducedMotion();
  const words = text.split(' ');
  return (
    <h1 className="l-hero-title">
      <motion.span
        style={{ display: 'inline' }}
        initial={reduce ? false : 'hidden'}
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.045, delayChildren: 0.15 } } }}
      >
        {words.map((w, i) => (
          // The space sits BETWEEN the masked words (not inside the
          // overflow:hidden box, which trims a trailing space) so the heading
          // both shows word gaps and wraps on narrow screens.
          <Fragment key={i}>
            <span className="l-word" style={{ overflow: 'hidden' }}>
              <motion.span
                className="l-char"
                variants={{ hidden: { y: '108%' }, show: { y: 0, transition: { duration: 0.7, ease: L_EASE } } }}
                style={w === em ? { fontStyle: 'italic', color: 'var(--l-gold-d)' } : undefined}
              >
                {w}
              </motion.span>
            </span>
            {i < words.length - 1 ? ' ' : ''}
          </Fragment>
        ))}
      </motion.span>
    </h1>
  );
}

const fade = (delay: number, reduce: boolean | null) => ({
  initial: reduce ? false : { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, ease: L_EASE, delay },
});

export function Hero() {
  const reduce = useReducedMotion();
  const heroRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  // Ambient cursor glow — update CSS vars directly (no re-render).
  useEffect(() => {
    if (reduce) return;
    const hero = heroRef.current;
    const glow = glowRef.current;
    if (!hero || !glow) return;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      const r = hero.getBoundingClientRect();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        glow.style.setProperty('--mx', `${e.clientX - r.left}px`);
        glow.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    };
    hero.addEventListener('mousemove', onMove);
    return () => { hero.removeEventListener('mousemove', onMove); cancelAnimationFrame(raf); };
  }, [reduce]);

  return (
    <section className="l-hero" id="top" ref={heroRef}>
      <div ref={glowRef} className="l-cursor" aria-hidden />
      <div className="l-container">
        <div className="l-hero-grid">
          <div>
            <motion.div {...fade(0, reduce)}>
              <span className="l-badge">
                <span className="l-dot live" /> Growth Operating System for Cafés
                <span className="tag">Alpha</span>
              </span>
            </motion.div>

            <AnimatedHeading text="Run Your Entire Café from One Beautiful Platform" em="Beautiful" />

            <motion.p className="l-hero-sub" {...fade(0.5, reduce)}>
              Everything your café needs to manage billing, kitchen, inventory, customers,
              loyalty, AI insights, and payments — in one intelligent operating system.
            </motion.p>

            <motion.div className="l-hero-cta" {...fade(0.62, reduce)}>
              <a href="/login" className="l-btn l-btn-primary l-btn-lg">
                Start free trial <ArrowRight size={18} className="ic" strokeWidth={2} />
              </a>
              <a href="#contact" className="l-btn l-btn-ghost l-btn-lg">
                <PlayCircle size={18} strokeWidth={2} /> Book live demo
              </a>
            </motion.div>

            <motion.div className="l-trusts" {...fade(0.74, reduce)}>
              <span className="l-trust"><Receipt size={17} strokeWidth={2} /> GST Ready</span>
              <span className="l-trust"><MapPin size={17} strokeWidth={2} /> Made for India</span>
              <span className="l-trust"><WifiOff size={17} strokeWidth={2} /> Works Offline</span>
            </motion.div>
          </div>

          <motion.div
            initial={reduce ? false : { opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.9, ease: L_EASE, delay: 0.3 }}
          >
            <LivingCounter />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
