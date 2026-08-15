'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Luxe easing — long, calm settle. Nothing snaps. */
export const L_EASE = [0.22, 0.61, 0.24, 1] as const;

/** True only after the component has mounted on the client. Guards any
 *  animation that would otherwise cause an SSR/hydration mismatch. */
export function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

/** Single element that rises + fades into view on scroll (once). */
export function Rise({
  children, delay = 0, y = 26, className, style,
}: { children: ReactNode; delay?: number; y?: number; className?: string; style?: React.CSSProperties }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      style={style}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-70px' }}
      transition={{ duration: 0.7, ease: L_EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/** Container whose direct GroupItem children cascade in on scroll. */
export function Group({
  children, className, style, stagger = 0.08, delayChildren = 0.04,
}: { children: ReactNode; className?: string; style?: React.CSSProperties; stagger?: number; delayChildren?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className} style={style}>{children}</div>;
  return (
    <motion.div
      className={className}
      style={style}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-60px' }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger, delayChildren } } }}
    >
      {children}
    </motion.div>
  );
}

export function GroupItem({
  children, className, style, y = 22,
}: { children: ReactNode; className?: string; style?: React.CSSProperties; y?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className} style={style}>{children}</div>;
  return (
    <motion.div
      className={className}
      style={style}
      variants={{ hidden: { opacity: 0, y }, show: { opacity: 1, y: 0, transition: { duration: 0.62, ease: L_EASE } } }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Subtle mouse-parallax tilt for a card. Rotates a few degrees toward the
 * cursor and lifts on hover. Disabled entirely under reduced motion / touch.
 */
export function TiltCard({
  children, className, max = 6, style,
}: { children: ReactNode; className?: string; max?: number; style?: React.CSSProperties }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [t, setT] = useState({ rx: 0, ry: 0, on: false });

  if (reduce) return <div className={className} style={style}>{children}</div>;

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setT({ rx: -py * max, ry: px * max, on: true });
  };
  const onLeave = () => setT({ rx: 0, ry: 0, on: false });

  return (
    <motion.div
      ref={ref}
      className={className}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ transformStyle: 'preserve-3d', ...style }}
      animate={{ rotateX: t.rx, rotateY: t.ry, y: t.on ? -6 : 0 }}
      transition={{ type: 'spring', stiffness: 220, damping: 20, mass: 0.6 }}
    >
      {children}
    </motion.div>
  );
}
