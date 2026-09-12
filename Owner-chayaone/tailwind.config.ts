import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        paper: { DEFAULT: 'var(--paper)', 2: 'var(--paper-2)', 3: 'var(--paper-3)' },
        ink: { DEFAULT: 'var(--ink)', 2: 'var(--ink-2)', 3: 'var(--ink-3)' },
        line: { DEFAULT: 'var(--line)', 2: 'var(--line-2)' },
        turmeric: { DEFAULT: 'var(--turmeric)', d: 'var(--turmeric-d)', l: 'var(--turmeric-l)' },
        cardamom: { DEFAULT: 'var(--cardamom)', d: 'var(--cardamom-d)' },
        clay: { DEFAULT: 'var(--clay)', l: 'var(--clay-l)' },
        berry: 'var(--berry)',
        gold: { DEFAULT: 'var(--gold)', d: 'var(--gold-d)', l: 'var(--gold-l)' },
        espresso: 'var(--espresso)',
        ok: { DEFAULT: 'var(--ok)', ink: 'var(--ok-ink)', bg: 'var(--ok-bg)' },
        warn: { DEFAULT: 'var(--warn)', ink: 'var(--warn-ink)', bg: 'var(--warn-bg)' },
        danger: { DEFAULT: 'var(--danger)', ink: 'var(--danger-ink)', bg: 'var(--danger-bg)' },
        info: { DEFAULT: 'var(--info)', ink: 'var(--info-ink)', bg: 'var(--info-bg)' },
      },
      ringColor: { DEFAULT: 'var(--ring)', ring: 'var(--ring)' },
      ringOffsetColor: { paper: 'var(--paper)' },
      fontFamily: {
        display: ['var(--font-display)', 'Fraunces', 'Cormorant Garamond', 'Georgia', 'serif'],
        body: ['var(--font-body)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      borderRadius: { sm: '8px', DEFAULT: '14px', lg: '22px', xl: '30px' },
      boxShadow: {
        1: 'var(--sh-1)',
        2: 'var(--sh-2)',
        3: 'var(--sh-3)',
        glow: 'var(--sh-glow)',
      },
    },
  },
  plugins: [],
};

export default config;
