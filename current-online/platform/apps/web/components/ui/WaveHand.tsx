import type { CSSProperties } from 'react';

/**
 * Filled waving-hand icon in the brand gold gradient.
 *
 * lucide only ships an outline hand (reads like a "stop" palm), so this is a
 * purpose-built solid glyph for the greeting. Built from rounded capsules
 * (four fingers + thumb over a palm) so it renders crisp at any size and looks
 * intentional rather than realistic. Pair with `.anim-wave` for the wave.
 */
export function WaveHand({
  size = 28,
  className = '',
  style,
}: {
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      style={style}
      role="img"
      aria-label="waving hand"
    >
      <defs>
        <linearGradient id="wavehand-gold" x1="4" y1="4" x2="19" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#E6C463" />
          <stop offset="0.5" stopColor="#C99A2E" />
          <stop offset="1" stopColor="#A87E1E" />
        </linearGradient>
      </defs>
      <g fill="url(#wavehand-gold)">
        {/* palm */}
        <rect x="6.4" y="11.2" width="11.3" height="9.3" rx="3.6" />
        {/* four fingers (index → pinky), middle tallest */}
        <rect x="7.0" y="5.6" width="2.6" height="9.4" rx="1.3" />
        <rect x="9.7" y="4.1" width="2.6" height="11" rx="1.3" />
        <rect x="12.4" y="4.8" width="2.6" height="10.2" rx="1.3" />
        <rect x="15.1" y="6.4" width="2.6" height="8.6" rx="1.3" />
        {/* thumb, angled off the palm's lower-left */}
        <rect x="4.6" y="10.4" width="2.6" height="6.4" rx="1.3" transform="rotate(-38 5.9 13.6)" />
      </g>
    </svg>
  );
}
