/**
 * Currency helpers — paise (integer) to formatted INR string.
 * Mirrors @cafeos/core formatINR but inlined to avoid monorepo dependency.
 */

/** Format paise to INR string: 10050 → "₹100.50" */
export function formatINR(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(rupees);
}

/** Format paise to compact string: 1234500 → "₹12.3K" */
export function formatINRCompact(paise: number): string {
  const rupees = paise / 100;
  if (rupees >= 10_00_000) {
    return `₹${(rupees / 1_00_000).toFixed(1)}L`;
  }
  if (rupees >= 1_000) {
    return `₹${(rupees / 1_000).toFixed(1)}K`;
  }
  return formatINR(paise);
}

/** Round paise to nearest rupee */
export function paiseToRupees(paise: number): number {
  return Math.round(paise / 100);
}
