/* Minimal assertion-based tests (run: npm run -w @cafeos/core test). */
import { computeBill } from './gst';
import { formatINR } from './money';

let failed = 0;
function eq(label: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? '✓' : '✗'} ${label}${ok ? '' : `  got=${got} want=${want}`}`);
  if (!ok) failed++;
}

// 1× Spanish Latte (₹240 @ 5%) + 1× Tiramisu (₹220 @ 18%), intra-state
const bill = computeBill([
  { pricePaise: 24000, gstRate: 5, qty: 1 },
  { pricePaise: 22000, gstRate: 18, qty: 1 },
]);
eq('subtotal', bill.subtotalPaise, 46000);
eq('cgst+sgst == total tax', bill.cgstPaise + bill.sgstPaise, 1200 + 3960); // 5% of ₹240=₹12.00 + 18% of ₹220=₹39.60
eq('igst is zero intra-state', bill.igstPaise, 0);
eq('total is rupee-rounded', bill.totalPaise % 100, 0);

// inter-state uses IGST
const inter = computeBill([{ pricePaise: 10000, gstRate: 18, qty: 1 }], { interState: true });
eq('igst applied', inter.igstPaise, 1800);
eq('no cgst inter-state', inter.cgstPaise, 0);

// discount distributes & taxes on the discounted base
const disc = computeBill([{ pricePaise: 20000, gstRate: 5, qty: 2 }], { discountPct: 10 });
eq('discount 10% of 400', disc.discountPaise, 4000);
eq('taxable after discount', disc.taxablePaise, 36000);

// flat ₹-amount discount: ₹50 off a ₹400 base
const flat = computeBill([{ pricePaise: 20000, gstRate: 5, qty: 2 }], { discountFlatPaise: 5000 });
eq('flat discount applied', flat.discountPaise, 5000);
eq('taxable after flat discount', flat.taxablePaise, 35000);

// percent + flat combine, then clamp to the subtotal (never negative)
const both = computeBill([{ pricePaise: 20000, gstRate: 5, qty: 2 }], { discountPct: 10, discountFlatPaise: 5000 });
eq('percent + flat combined', both.discountPaise, 4000 + 5000);
const over = computeBill([{ pricePaise: 20000, gstRate: 5, qty: 2 }], { discountFlatPaise: 99999 });
eq('flat discount clamped to subtotal', over.discountPaise, 40000);
eq('over-discount total is zero', over.totalPaise, 0);

// INCLUSIVE: a ₹105 price @ 5% holds ₹100 base + ₹5 tax; total stays ₹105
const incl = computeBill([{ pricePaise: 10500, gstRate: 5, qty: 1 }], { gstInclusive: true });
eq('inclusive net base', incl.subtotalPaise, 10000);
eq('inclusive tax extracted', incl.cgstPaise + incl.sgstPaise, 500);
eq('inclusive total == menu price', incl.totalPaise, 10500);

// INCLUSIVE off (exclusive) on the same price adds tax on top → ₹110.25 → ₹110
const excl = computeBill([{ pricePaise: 10500, gstRate: 5, qty: 1 }]);
eq('exclusive adds tax on top', excl.cgstPaise + excl.sgstPaise, 525);

// GST disabled ignores inclusive flag entirely (no tax, price is the total)
const off = computeBill([{ pricePaise: 10500, gstRate: 5, qty: 1 }], { gstInclusive: true, gstEnabled: false });
eq('disabled = no tax', off.cgstPaise + off.sgstPaise + off.igstPaise, 0);
eq('disabled total == price', off.totalPaise, 10500);

console.log(`\nformatINR sample: ${formatINR(bill.totalPaise)}`);
console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILED`);
if (failed) process.exit(1);
