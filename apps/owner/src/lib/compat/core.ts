export type Paise = number;

export function formatINR(paise: number): string {
  const r = (paise || 0) / 100;
  const hasDecimals = (paise || 0) % 100 !== 0;
  return (
    '₹' +
    r.toLocaleString('en-IN', {
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: 2,
    })
  );
}

export const roundToRupee = (paise: number): number => Math.round((paise || 0) / 100) * 100;

export function convertForDeduction(qty: number, from?: string | null, to?: string | null): number {
  return qty;
}

export * from './modules';
