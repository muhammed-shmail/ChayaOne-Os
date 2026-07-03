import { Playfair_Display, Inter } from 'next/font/google';

/**
 * Landing-page-only type system.
 * Playfair Display = editorial display serif for headings. Inter = body.
 * Exposed as CSS variables and applied on the marketing wrapper only, so the
 * rest of the product keeps its Cormorant Garamond / Hanken Grotesk identity.
 */
export const landingDisplay = Playfair_Display({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800', '900'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-landing-display',
});

export const landingBody = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-landing-body',
});
