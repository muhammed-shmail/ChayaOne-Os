'use client';

import { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export type ChaiState = 'idle' | 'listening' | 'thinking' | 'responding' | 'error';

/**
 * ChayaOne's assistant identity mark — a steaming-cup orb. Warm turmeric→cardamom
 * gradient (clay for error), with a state-driven animation:
 *  - idle: steam drifts slowly
 *  - listening: outer ring breathes/pulses
 *  - thinking: dots orbit the cup
 *  - responding: a soft 3-bar equalizer beside the cup
 *  - error: a brief shake, tinted clay
 * All loops collapse to a simple fade when the user prefers reduced motion.
 */
export function ChaiIcon({ state = 'idle', size = 40 }: { state?: ChaiState; size?: number }) {
  const uid = useId().replace(/[:]/g, '');
  const reduced = useReducedMotion();
  const gradId = `chai-grad-${uid}`;
  const ringId = `chai-ring-${uid}`;
  const tone = state === 'error' ? 'var(--clay)' : 'var(--turmeric)';
  const tone2 = state === 'error' ? 'var(--clay-l)' : 'var(--cardamom)';

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      animate={state === 'error' && !reduced ? { x: [0, -2, 2, -2, 0] } : { x: 0 }}
      transition={{ duration: 0.4 }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={tone} />
          <stop offset="100%" stopColor={tone2} />
        </linearGradient>
        <radialGradient id={ringId} cx="50%" cy="50%" r="50%">
          <stop offset="60%" stopColor={tone} stopOpacity="0" />
          <stop offset="100%" stopColor={tone} stopOpacity="0.35" />
        </radialGradient>
      </defs>

      {/* listening: breathing ring */}
      {state === 'listening' && (
        <motion.circle
          cx="24"
          cy="27"
          r="18"
          fill={`url(#${ringId})`}
          animate={reduced ? { opacity: [0.5, 0.9, 0.5] } : { scale: [1, 1.12, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: '24px 27px' }}
        />
      )}

      {/* thinking: orbiting dots */}
      {state === 'thinking' && (
        <motion.g
          animate={reduced ? { opacity: [0.4, 1, 0.4] } : { rotate: 360 }}
          transition={reduced ? { duration: 1.2, repeat: Infinity } : { duration: 1.8, repeat: Infinity, ease: 'linear' }}
          style={{ transformOrigin: '24px 27px' }}
        >
          <circle cx="24" cy="8" r="2.2" fill={tone} />
          <circle cx="40" cy="27" r="1.6" fill={tone2} opacity={0.8} />
          <circle cx="12" cy="38" r="1.4" fill={tone} opacity={0.6} />
        </motion.g>
      )}

      {/* responding: soft equalizer bars */}
      {state === 'responding' &&
        [0, 1, 2].map((i) => (
          <motion.rect
            key={i}
            x={38 + i * 4}
            y={22}
            width={2.2}
            height={8}
            rx={1.1}
            fill={tone2}
            animate={reduced ? { opacity: [0.5, 1, 0.5] } : { height: [6, 14, 6], y: [25, 18, 25] }}
            transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut', delay: i * 0.15 }}
          />
        ))}

      {/* steam */}
      <motion.path
        d="M19 14c-1.5-2 1.5-3 0-5.5"
        stroke={tone}
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity={0.7}
        animate={
          reduced
            ? { opacity: [0.3, 0.7, 0.3] }
            : state === 'idle'
              ? { y: [0, -1.5, 0], opacity: [0.35, 0.7, 0.35] }
              : { y: [0, -2, 0], opacity: [0.5, 0.9, 0.5] }
        }
        transition={{ duration: state === 'idle' ? 3.6 : 1.4, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.path
        d="M25 13c-1.5-2 1.5-3 0-5.5"
        stroke={tone2}
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity={0.6}
        animate={
          reduced
            ? { opacity: [0.2, 0.6, 0.2] }
            : state === 'idle'
              ? { y: [0, -1.5, 0], opacity: [0.25, 0.6, 0.25] }
              : { y: [0, -2, 0], opacity: [0.4, 0.8, 0.4] }
        }
        transition={{ duration: state === 'idle' ? 4.2 : 1.6, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
      />

      {/* cup body */}
      <path
        d="M13 20h18a2 2 0 0 1 2 2.1c-.4 7-4.8 12.4-11 12.4S11.4 29.1 11 22.1A2 2 0 0 1 13 20Z"
        fill={`url(#${gradId})`}
      />
      {/* handle */}
      <path
        d="M33 23.5c3 0 5 1.8 5 4.3s-2 4.3-5 4.3"
        stroke={tone2}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity={0.9}
      />
      {/* saucer */}
      <ellipse cx="22" cy="37.5" rx="12" ry="1.8" fill={tone} opacity={0.18} />
    </motion.svg>
  );
}
