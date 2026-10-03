/**
 * Money is ALWAYS integer paise across Cafe OS. Never use floats for money.
 * 100 paise = ₹1.
 */
export type Paise = number;

/** Format paise as an Indian-locale ₹ string. */
export function formatINR(paise: Paise): string {
  const r = paise / 100;
  const hasDecimals = paise % 100 !== 0;
  return (
    '₹' +
    r.toLocaleString('en-IN', {
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: 2,
    })
  );
}

/** Round paise to the nearest whole rupee (returns paise). */
export const roundToRupee = (paise: Paise): Paise => Math.round(paise / 100) * 100;

/**
 * String-safe conversion from rupees (decimal or string, e.g. "125.50") to integer paise.
 * Completely avoids IEEE-754 floating point arithmetic roundoff issues.
 */
export function parseRupeesToPaise(val: string | number | null | undefined): Paise {
  if (val === null || val === undefined) return 0;
  let str = typeof val === 'number' ? val.toFixed(2) : String(val).trim();
  str = str.replace(/,/g, '');
  if (!str) return 0;

  const match = str.match(/^(-)?(\d+)(?:\.(\d+))?$/);
  if (!match) return 0;

  const isNegative = !!match[1];
  const whole = match[2] ?? '0';
  const rawFrac = match[3] || '';
  const frac = (rawFrac + '00').slice(0, 2);

  const paise = parseInt(whole, 10) * 100 + parseInt(frac, 10);
  return isNegative ? -paise : paise;
}

/** Alias for parseRupeesToPaise */
export const toPaise = parseRupeesToPaise;

/** Convert integer paise to decimal rupees */
export function toRupees(paise: Paise): number {
  return Number((paise / 100).toFixed(2));
}

/** Safe integer multiplication of paise with factor (e.g. qty or tax rate), rounded to nearest paise */
export function safeMultiplyPaise(paise: Paise, factor: number): Paise {
  return Math.round(paise * factor);
}

/** Safe integer division of paise with divisor, rounded to nearest paise */
export function safeDividePaise(paise: Paise, divisor: number): Paise {
  if (divisor === 0) return 0;
  return Math.round(paise / divisor);
}

