/**
 * Cafe OS — BULK DEMO DATA generator.
 *
 * Layers a large, realistic dataset on top of the base seed so every owner-
 * dashboard page fills up and scrolls "page by page": Customers, Menu (Items),
 * Revenue / Sales, Payments, Shifts, Staff, Suppliers, Inventory, Loyalty and
 * Marketing.
 *
 * It attaches to the tenant the base seed already created (subdomain "kahwa").
 * Run the base seed first, then this:
 *
 *   npm run db:seed          # base tenant/outlet/staff/menu/tables
 *   npm run db:seed:demo     # <-- this file (bulk data)
 *
 * Re-runnable: it wipes the volatile data it owns (orders, payments, shifts,
 * customers, vendors, stock, …) for this outlet/tenant and regenerates. The base
 * tenant, outlet, base staff, base menu and tables are preserved.
 *
 * Money is ALWAYS integer paise. Deterministic (seeded PRNG) so screenshots are
 * stable across runs.
 */
import { PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';

const prisma = new PrismaClient();

// ----------------------------- tunables -----------------------------
const CFG = {
  subdomain: 'kahwa',   // which tenant to fill (base seed sets this)
  customers: 260,       // >10 pages at 25/page
  historyDays: 45,      // spread of past orders (revenue chart + sales)
  liveOrders: 18,       // today's in-progress orders (monitor / tables / approvals)
  vendors: 10,
  purchaseOrders: 24,
  supplierPayments: 28,
  stockItems: 26,
  coupons: 46,
  gameSessions: 60,
  shiftDays: 14,        // shifts generated for today..+N days
};

// ----------------------------- helpers -----------------------------
const pin = (p: string) => createHash('sha256').update(p).digest('hex');
const phoneHash = (p: string) => createHash('sha256').update(p).digest('hex');

// Deterministic PRNG (mulberry32) — stable data across runs.
let _seed = 0x9e3779b9;
function rnd(): number {
  _seed |= 0;
  _seed = (_seed + 0x6d2b79f5) | 0;
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const ri = (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min;
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)]!;
const chance = (p: number) => rnd() < p;
const shuffle = <T>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
};

/** createMany in bounded chunks (keeps Postgres param count safe). */
async function insertMany(model: { createMany: (a: any) => Promise<unknown> }, rows: any[], size = 500) {
  for (let i = 0; i < rows.length; i += size) {
    await model.createMany({ data: rows.slice(i, i + size), skipDuplicates: true });
  }
}

/** GST bill (intra-state CGST/SGST split, tax-exclusive) — mirrors @cafeos/core gst.ts. */
function computeTotals(
  lines: { pricePaise: number; gstRate: number; qty: number }[],
  discountPct: number,
  scPct: number,
) {
  const subtotal = lines.reduce((s, l) => s + l.pricePaise * l.qty, 0);
  const discount = Math.round((subtotal * discountPct) / 100);
  let cgst = 0;
  let sgst = 0;
  for (const l of lines) {
    const gross = l.pricePaise * l.qty;
    const share = subtotal > 0 ? gross / subtotal : 0;
    const lineTaxable = gross - Math.round(discount * share);
    const lineTax = Math.round((lineTaxable * l.gstRate) / 100);
    const half = Math.round(lineTax / 2);
    cgst += half;
    sgst += lineTax - half;
  }
  const taxable = subtotal - discount;
  const serviceCharge = Math.round((taxable * scPct) / 100);
  const preRound = taxable + cgst + sgst + serviceCharge;
  const total = Math.round(preRound / 100) * 100;
  return { subtotal, discount, cgst, sgst, igst: 0, serviceCharge, roundOff: total - preRound, total };
}

const DAY = 86_400_000;
const atDay = (daysAgo: number, hour: number, min: number) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return new Date(d.getTime() - daysAgo * DAY + hour * 3600_000 + min * 60_000);
};

// ----------------------------- name pools -----------------------------
const FIRST = ['Aarav', 'Vivaan', 'Aditya', 'Arjun', 'Sai', 'Reyansh', 'Krishna', 'Ishaan', 'Rohan', 'Kabir',
  'Ananya', 'Diya', 'Aadhya', 'Saanvi', 'Myra', 'Aarohi', 'Anika', 'Navya', 'Ira', 'Kiara',
  'Rahul', 'Priya', 'Neha', 'Karan', 'Sana', 'Vikram', 'Aisha', 'Imran', 'Deepa', 'Nikhil',
  'Meera', 'Farhan', 'Tanya', 'Zoya', 'Yash', 'Riya', 'Dev', 'Pooja', 'Manish', 'Simran'];
const LAST = ['Sharma', 'Verma', 'Iyer', 'Nair', 'Reddy', 'Rao', 'Menon', 'Gupta', 'Kapoor', 'Khan',
  'Patel', 'Shah', 'Bose', 'Das', 'Pillai', 'Chopra', 'Bhat', 'Kulkarni', 'Joshi', 'Mehta'];

// ----------------------------- extra menu items -----------------------------
type Extra = { cat: string; name: string; pricePaise: number; gst: number; station: 'kitchen' | 'bar' | 'dessert'; tags: string[] };
const EXTRA_MENU: Extra[] = [
  { cat: 'Coffee', name: 'Flat White', pricePaise: 19000, gst: 5, station: 'bar', tags: ['veg'] },
  { cat: 'Coffee', name: 'Mocha', pricePaise: 21000, gst: 5, station: 'bar', tags: ['veg'] },
  { cat: 'Coffee', name: 'Affogato', pricePaise: 23000, gst: 5, station: 'bar', tags: ['veg'] },
  { cat: 'Coffee', name: 'Vietnamese Cold Coffee', pricePaise: 22000, gst: 5, station: 'bar', tags: ['veg'] },
  { cat: 'Coffee', name: 'Hazelnut Latte', pricePaise: 23000, gst: 5, station: 'bar', tags: ['veg'] },
  { cat: 'Coffee', name: 'Irish Cold Brew', pricePaise: 25000, gst: 5, station: 'bar', tags: ['veg'] },
  { cat: 'Coffee', name: 'Macchiato', pricePaise: 16000, gst: 5, station: 'bar', tags: ['veg'] },
  { cat: 'Chai & Tea', name: 'Ginger Chai', pricePaise: 9000, gst: 5, station: 'bar', tags: ['veg'] },
  { cat: 'Chai & Tea', name: 'Elaichi Chai', pricePaise: 9500, gst: 5, station: 'bar', tags: ['veg'] },
  { cat: 'Chai & Tea', name: 'Green Tea', pricePaise: 10000, gst: 5, station: 'bar', tags: ['veg'] },
  { cat: 'Chai & Tea', name: 'Peach Iced Tea', pricePaise: 13000, gst: 5, station: 'bar', tags: ['veg'] },
  { cat: 'Chai & Tea', name: 'Hot Chocolate', pricePaise: 15000, gst: 5, station: 'bar', tags: ['veg'] },
  { cat: 'Chai & Tea', name: 'Turmeric Latte', pricePaise: 16000, gst: 5, station: 'bar', tags: ['veg'] },
  { cat: 'Coolers', name: 'Watermelon Cooler', pricePaise: 14000, gst: 12, station: 'bar', tags: ['veg'] },
  { cat: 'Coolers', name: 'Blue Lagoon', pricePaise: 15000, gst: 12, station: 'bar', tags: ['veg'] },
  { cat: 'Coolers', name: 'Virgin Mojito', pricePaise: 15000, gst: 12, station: 'bar', tags: ['veg'] },
  { cat: 'Coolers', name: 'Cold Coco', pricePaise: 16000, gst: 12, station: 'bar', tags: ['veg'] },
  { cat: 'Coolers', name: 'Kokum Sharbat', pricePaise: 12000, gst: 12, station: 'bar', tags: ['veg'] },
  { cat: 'All-Day', name: 'Peri Peri Fries', pricePaise: 16000, gst: 5, station: 'kitchen', tags: ['veg'] },
  { cat: 'All-Day', name: 'Veg Grilled Sandwich', pricePaise: 17000, gst: 5, station: 'kitchen', tags: ['veg'] },
  { cat: 'All-Day', name: 'Chicken Tikka Wrap', pricePaise: 22000, gst: 5, station: 'kitchen', tags: ['nonveg'] },
  { cat: 'All-Day', name: 'Pesto Pasta', pricePaise: 23000, gst: 5, station: 'kitchen', tags: ['veg'] },
  { cat: 'All-Day', name: 'Mac & Cheese', pricePaise: 21000, gst: 5, station: 'kitchen', tags: ['veg'] },
  { cat: 'All-Day', name: 'Shakshuka', pricePaise: 22000, gst: 5, station: 'kitchen', tags: ['egg'] },
  { cat: 'All-Day', name: 'Loaded Nachos', pricePaise: 19000, gst: 5, station: 'kitchen', tags: ['veg'] },
  { cat: 'All-Day', name: 'Butter Chicken Bowl', pricePaise: 27000, gst: 5, station: 'kitchen', tags: ['nonveg'] },
  { cat: 'All-Day', name: 'Falafel Plate', pricePaise: 20000, gst: 5, station: 'kitchen', tags: ['veg'] },
  { cat: 'Bakery', name: 'Chocolate Muffin', pricePaise: 12000, gst: 18, station: 'dessert', tags: ['veg'] },
  { cat: 'Bakery', name: 'Blueberry Muffin', pricePaise: 13000, gst: 18, station: 'dessert', tags: ['veg'] },
  { cat: 'Bakery', name: 'Cinnamon Roll', pricePaise: 15000, gst: 18, station: 'dessert', tags: ['veg'] },
  { cat: 'Bakery', name: 'Focaccia', pricePaise: 14000, gst: 18, station: 'kitchen', tags: ['veg'] },
  { cat: 'Bakery', name: 'Pain au Chocolat', pricePaise: 16000, gst: 18, station: 'dessert', tags: ['veg'] },
  { cat: 'Bakery', name: 'Bagel & Cream Cheese', pricePaise: 15000, gst: 18, station: 'kitchen', tags: ['veg'] },
  { cat: 'Desserts', name: 'New York Cheesecake', pricePaise: 24000, gst: 18, station: 'dessert', tags: ['veg'] },
  { cat: 'Desserts', name: 'Molten Lava Cake', pricePaise: 21000, gst: 18, station: 'dessert', tags: ['veg'] },
  { cat: 'Desserts', name: 'Belgian Waffle', pricePaise: 19000, gst: 18, station: 'dessert', tags: ['veg'] },
  { cat: 'Desserts', name: 'Banoffee Pie', pricePaise: 20000, gst: 18, station: 'dessert', tags: ['veg'] },
  { cat: 'Desserts', name: 'Affogato Sundae', pricePaise: 22000, gst: 18, station: 'dessert', tags: ['veg'] },
  { cat: 'Desserts', name: 'Kunafa', pricePaise: 23000, gst: 18, station: 'dessert', tags: ['veg'] },
  { cat: 'Desserts', name: 'Ras Malai Tres Leches', pricePaise: 21000, gst: 18, station: 'dessert', tags: ['veg'] },
];

// ----------------------------- reset (re-runnable) -----------------------------
async function reset(tenantId: string, outletId: string) {
  // FK-safe order. Orders cascade → order_items / kots / payments / refunds.
  await prisma.order.deleteMany({ where: { outletId } });
  await prisma.gameSession.deleteMany({ where: { outletId } });
  await prisma.coupon.deleteMany({ where: { tenantId } });
  await prisma.campaign.deleteMany({ where: { tenantId } });   // cascades campaign_sends
  await prisma.segment.deleteMany({ where: { tenantId } });
  await prisma.customer.deleteMany({ where: { tenantId } });   // cascades ledger/badges/streaks/referrals
  await prisma.shift.deleteMany({ where: { outletId } });
  await prisma.attendance.deleteMany({ where: { outletId } });
  await prisma.salaryPayment.deleteMany({ where: { outletId } });
  await prisma.supplierPayment.deleteMany({ where: { outletId } });
  await prisma.purchaseOrder.deleteMany({ where: { outletId } }); // cascades PO items
  await prisma.vendor.deleteMany({ where: { tenantId } });
  await prisma.stockItem.deleteMany({ where: { outletId } });   // cascades recipes/ledger/waste
  await prisma.notification.deleteMany({ where: { outletId } });
  await prisma.menuItem.deleteMany({ where: { outletId, tags: { has: 'demo' } } });
  await prisma.staffUser.deleteMany({ where: { tenantId, employeeCode: { startsWith: 'D-' } } });
}

// ----------------------------- main -----------------------------
async function main() {
  console.log('🌱  Generating bulk demo data…');

  const tenant =
    (await prisma.tenant.findUnique({ where: { subdomain: CFG.subdomain } })) ??
    (await prisma.tenant.findFirst());
  if (!tenant) throw new Error('No tenant found. Run `npm run db:seed` first.');
  const outlet = await prisma.outlet.findFirst({ where: { tenantId: tenant.id } });
  if (!outlet) throw new Error('Tenant has no outlet. Run `npm run db:seed` first.');
  const tenantId = tenant.id;
  const outletId = outlet.id;

  await reset(tenantId, outletId);

  // ---------- categories + extra menu items ----------
  const cats = await prisma.category.findMany({ where: { outletId } });
  const catByName = new Map(cats.map((c) => [c.name, c.id]));
  const demoItems = EXTRA_MENU
    .filter((m) => catByName.has(m.cat))
    .map((m) => ({
      id: randomUUID(),
      outletId,
      categoryId: catByName.get(m.cat)!,
      name: m.name,
      pricePaise: m.pricePaise,
      gstRate: m.gst,
      hsnCode: '2106',
      station: m.station,
      tags: [...m.tags, 'demo'],
      isAvailable: chance(0.9), // a few out-of-stock for the "unavailable" count
    }));
  await insertMany(prisma.menuItem, demoItems);

  // full pool used to build orders (base + demo, available only)
  const menuPool = (
    await prisma.menuItem.findMany({
      where: { outletId, isAvailable: true },
      select: { id: true, name: true, pricePaise: true, gstRate: true, station: true },
    })
  ).map((m) => ({ id: m.id, name: m.name, pricePaise: m.pricePaise, gstRate: Number(m.gstRate), station: m.station }));

  // ---------- staff ----------
  const DEMO_STAFF = [
    { name: 'Karan (Manager)', role: 'manager', code: 'D-MGR1', payType: 'monthly', rate: 4500000, pin: '4444' },
    { name: 'Aisha', role: 'waiter', code: 'D-W01', payType: 'monthly', rate: 2200000, pin: '5001' },
    { name: 'Rahul', role: 'waiter', code: 'D-W02', payType: 'monthly', rate: 2200000, pin: '5002' },
    { name: 'Sana', role: 'waiter', code: 'D-W03', payType: 'hourly', rate: 15000, pin: '5003' },
    { name: 'Vikram', role: 'waiter', code: 'D-W04', payType: 'hourly', rate: 15000, pin: '5004' },
    { name: 'Neha', role: 'cashier', code: 'D-C01', payType: 'monthly', rate: 2600000, pin: '5005' },
    { name: 'Imran', role: 'kitchen', code: 'D-K01', payType: 'monthly', rate: 2800000, pin: '5006' },
    { name: 'Deepa', role: 'kitchen', code: 'D-K02', payType: 'hourly', rate: 16000, pin: '5007' },
  ] as const;
  const demoStaffRows = DEMO_STAFF.map((s, i) => ({
    id: randomUUID(),
    tenantId,
    outletId,
    name: s.name,
    role: s.role,
    pinHash: pin(s.pin),
    phone: `90000100${String(i + 1).padStart(2, '0')}`,
    employeeCode: s.code,
    payType: s.payType,
    payRatePaise: s.rate,
    active: true,
  }));
  await insertMany(prisma.staffUser, demoStaffRows);

  const allStaff = await prisma.staffUser.findMany({ where: { tenantId }, select: { id: true, name: true, role: true, payType: true, payRatePaise: true } });
  const takers = allStaff.filter((s) => s.role === 'waiter' || s.role === 'cashier' || s.role === 'manager');
  const tables = await prisma.tableMap.findMany({ where: { outletId }, select: { id: true } });

  // ---------- customers ----------
  const usedPhones = new Set<string>();
  const usedRefs = new Set<string>();
  const custIds: string[] = [];
  const customerRows = Array.from({ length: CFG.customers }, (_, i) => {
    const first = pick(FIRST);
    const name = `${first} ${pick(LAST)}`;
    let phone = '';
    do { phone = '9' + String(ri(100000000, 999999999)); } while (usedPhones.has(phone));
    usedPhones.add(phone);

    const daysSinceJoin = ri(1, 360);
    const createdAt = new Date(Date.now() - daysSinceJoin * DAY);
    const visitCount = chance(0.15) ? 0 : ri(1, 60);
    const avgSpend = ri(15000, 65000);
    const lifetimeSpendPaise = visitCount * avgSpend;
    const points = Math.round(lifetimeSpendPaise / 100) + ri(0, 400);
    const tier =
      lifetimeSpendPaise >= 2_000_000 ? 'vip' :
      lifetimeSpendPaise >= 800_000 ? 'gold' :
      lifetimeSpendPaise >= 300_000 ? 'silver' : 'bronze';
    // last visit: some recent (retained), some stale (>60d → inactive filter), some never
    const lastVisit =
      visitCount === 0 ? null :
      chance(0.65) ? new Date(Date.now() - ri(0, 30) * DAY) :
      new Date(Date.now() - ri(61, 200) * DAY);
    const status = chance(0.05) ? 'blocked' : chance(0.1) ? 'inactive' : 'active';
    const source = pick(['pwa', 'manual', 'import', 'pwa', 'pwa'] as const);

    let ref: string | null = null;
    if (chance(0.4)) {
      do { ref = (first.slice(0, 4).toUpperCase() + ri(10, 99)); } while (usedRefs.has(ref));
      usedRefs.add(ref);
    }
    const id = randomUUID();
    custIds.push(id);
    return {
      id,
      tenantId,
      name,
      phone,
      phoneHash: phoneHash(phone),
      email: chance(0.6) ? `${first.toLowerCase()}${i}@example.com` : null,
      gender: pick(['male', 'female', 'other', 'male', 'female'] as const),
      status,
      source,
      tier,
      points,
      coins: ri(0, 300),
      lifetimeSpendPaise,
      visitCount,
      firstVisit: createdAt,
      lastVisit,
      birthday: chance(0.7) ? new Date(1985 + ri(0, 20), ri(0, 11), ri(1, 28)) : null,
      referralCode: ref,
      createdAt,
    };
  });
  await insertMany(prisma.customer, customerRows);

  // ---------- orders + items + payments ----------
  type Draft = { placedAt: Date; live: boolean };
  const drafts: Draft[] = [];
  for (let d = CFG.historyDays; d >= 1; d--) {
    const weekend = [0, 6].includes(atDay(d, 12, 0).getDay());
    const count = weekend ? ri(14, 26) : ri(8, 17);
    for (let k = 0; k < count; k++) {
      const hour = ri(9, 21);
      drafts.push({ placedAt: atDay(d, hour, ri(0, 59)), live: false });
    }
  }
  // today's in-progress orders (monitor / tables / approvals)
  for (let k = 0; k < CFG.liveOrders; k++) drafts.push({ placedAt: atDay(0, ri(8, 20), ri(0, 59)), live: true });
  drafts.sort((a, b) => a.placedAt.getTime() - b.placedAt.getTime());

  const PAY: readonly ('cash' | 'upi' | 'card' | 'wallet')[] = ['upi', 'upi', 'upi', 'upi', 'cash', 'cash', 'cash', 'card', 'card', 'wallet'];
  const LIVE_STATUS: readonly ('pending_approval' | 'open' | 'in_kitchen' | 'ready' | 'served')[] = ['pending_approval', 'open', 'in_kitchen', 'in_kitchen', 'ready', 'served'];

  const orderRows: any[] = [];
  const itemRows: any[] = [];
  const paymentRows: any[] = [];
  let number = 1000;

  for (const dr of drafts) {
    number++;
    const orderId = randomUUID();
    const type = pick(['dine_in', 'dine_in', 'dine_in', 'takeaway', 'takeaway', 'delivery'] as const);
    const lineCount = ri(1, 4);
    const chosen = shuffle(menuPool).slice(0, lineCount);
    const lines = chosen.map((m) => ({ ...m, qty: ri(1, 3) }));
    const discountPct = chance(0.2) ? pick([5, 10, 15]) : 0;
    const scPct = type === 'dine_in' && chance(0.3) ? 5 : 0;
    const b = computeTotals(lines, discountPct, scPct);

    const cancelled = !dr.live && chance(0.04);
    const status = cancelled ? 'cancelled' : dr.live ? pick(LIVE_STATUS) : 'settled';
    const settled = status === 'settled';
    const settledAt = settled ? new Date(dr.placedAt.getTime() + ri(18, 85) * 60_000) : null;
    const tableId = type === 'dine_in' && tables.length ? pick(tables).id : null;
    const customerId = chance(0.65) ? pick(custIds) : null;
    const staffId = pick(takers).id;
    const channel = pick(['pos', 'pos', 'pos', 'pos', 'qr', 'qr', 'online'] as const);

    orderRows.push({
      id: orderId,
      clientUuid: randomUUID(),
      number,
      outletId,
      tableId,
      customerId,
      staffId,
      type,
      status,
      channel,
      subtotalPaise: b.subtotal,
      discountPaise: b.discount,
      cgstPaise: b.cgst,
      sgstPaise: b.sgst,
      igstPaise: b.igst,
      serviceChargePaise: b.serviceCharge,
      roundOffPaise: b.roundOff,
      totalPaise: b.total,
      placedAt: dr.placedAt,
      settledAt,
    });
    for (const l of lines) {
      itemRows.push({
        id: randomUUID(),
        orderId,
        itemId: l.id,
        nameSnapshot: l.name,
        qty: l.qty,
        unitPricePaise: l.pricePaise,
        station: l.station,
        kotStatus: settled ? 'served' : dr.live ? (status === 'ready' ? 'ready' : status === 'served' ? 'served' : 'preparing') : 'served',
      });
    }
    // Payment for settled orders (drives Payments list + pay-mix + today cash/upi split).
    if (settled) {
      paymentRows.push({
        id: randomUUID(),
        orderId,
        outletId,
        method: pick(PAY),
        amountPaise: b.total,
        status: 'success',
        providerRef: chance(0.5) ? `pay_${randomUUID().slice(0, 12)}` : null,
        createdAt: settledAt,
      });
    }
  }
  await insertMany(prisma.order, orderRows);
  await insertMany(prisma.orderItem, itemRows);
  await insertMany(prisma.payment, paymentRows);

  // ---------- shifts (today..+N) ----------
  const rosterStaff = allStaff.filter((s) => s.role !== 'owner');
  const shiftRows: any[] = [];
  for (let d = -2; d < CFG.shiftDays; d++) {
    for (const s of rosterStaff) {
      if (chance(0.35)) continue; // not everyone every day
      const morning = chance(0.5);
      const start = atDay(-d, morning ? 9 : 15, 0);
      const end = atDay(-d, morning ? 15 : 23, 0);
      shiftRows.push({
        id: randomUUID(), outletId, staffId: s.id,
        startsAt: start, endsAt: end,
        role: s.role, status: 'scheduled',
      });
    }
  }
  await insertMany(prisma.shift, shiftRows);

  // ---------- attendance today (staffOnDuty + punches) ----------
  const onDuty = shuffle(rosterStaff).slice(0, 6);
  const attRows = onDuty.map((s, i) => {
    const clockIn = atDay(0, 9, ri(0, 30));
    const stillIn = i < 4; // 4 currently on duty
    return {
      id: randomUUID(), outletId, staffId: s.id,
      clockIn, clockOut: stillIn ? null : atDay(0, ri(14, 18), ri(0, 59)),
      source: pick(['pin', 'qr', 'geo'] as const),
    };
  });
  await insertMany(prisma.attendance, attRows);

  // ---------- salary payments (current period) ----------
  const period = new Date().toISOString().slice(0, 7);
  const salRows = allStaff
    .filter((s) => s.payType === 'monthly' && s.payRatePaise)
    .slice(0, 5)
    .map((s) => ({
      id: randomUUID(), outletId, staffId: s.id, periodLabel: period,
      amountPaise: s.payRatePaise!, method: pick(['bank', 'upi', 'cash'] as const),
      note: 'Salary ' + period, paidAt: atDay(ri(1, 5), 11, 0),
    }));
  await insertMany(prisma.salaryPayment, salRows);

  // ---------- vendors + purchase orders + supplier payments ----------
  const VENDOR_NAMES = ['Blue Tokai Roasters', 'Amul Dairy Dist.', 'FreshFarm Produce', 'Baker\'s Basket',
    'Nimbu Beverages', 'Spice Route Traders', 'PaperCup Co.', 'Choco Craft Supplies', 'Green Leaf Teas', 'Metro Cash & Carry'];
  const vendorRows = VENDOR_NAMES.slice(0, CFG.vendors).map((name, i) => ({
    id: randomUUID(), tenantId, name,
    phone: `98765${String(10000 + i).slice(-5)}`,
    gstin: `29AAB${String(1000 + i)}Q1Z${i % 9}`,
    openingBalancePaise: chance(0.4) ? ri(0, 50000) * 100 : 0,
    leadTimeDays: ri(1, 7),
  }));
  await insertMany(prisma.vendor, vendorRows);

  const poRows: any[] = [];
  const poItemRows: any[] = [];
  const poIdsByVendor: Record<string, string[]> = {};
  for (let i = 0; i < CFG.purchaseOrders; i++) {
    const v = pick(vendorRows);
    const poId = randomUUID();
    (poIdsByVendor[v.id] ??= []).push(poId);
    const total = ri(2000, 45000) * 100;
    const st = pick(['received', 'received', 'partial', 'sent', 'draft', 'cancelled'] as const);
    const paid = st === 'received' ? total : st === 'partial' ? Math.round(total * (ri(3, 7) / 10)) : 0;
    const createdAt = atDay(ri(2, 40), 10, ri(0, 59));
    const due = new Date(createdAt.getTime() + ri(7, 30) * DAY);
    poRows.push({
      id: poId, outletId, vendorId: v.id, status: st, totalPaise: total, paidPaise: paid,
      invoiceNo: `INV-${2600 + i}`, invoiceDate: createdAt, dueDate: due,
      notes: null, createdAt,
    });
  }
  await insertMany(prisma.purchaseOrder, poRows);

  const supPayRows: any[] = [];
  for (let i = 0; i < CFG.supplierPayments; i++) {
    const v = pick(vendorRows);
    const pos = poIdsByVendor[v.id];
    supPayRows.push({
      id: randomUUID(), outletId, vendorId: v.id,
      poId: pos && chance(0.6) ? pick(pos) : null,
      amountPaise: ri(1000, 30000) * 100,
      method: pick(['upi', 'bank', 'cash', 'cheque', 'card'] as const),
      reference: chance(0.5) ? `TXN${ri(100000, 999999)}` : null,
      paidAt: atDay(ri(1, 35), ri(10, 18), ri(0, 59)),
    });
  }
  await insertMany(prisma.supplierPayment, supPayRows);

  // ---------- stock items + waste + consumption + low-stock alerts ----------
  const STOCK = [
    ['Arabica Beans', 'g'], ['Robusta Beans', 'g'], ['Full Cream Milk', 'ml'], ['Oat Milk', 'ml'], ['Almond Milk', 'ml'],
    ['Sugar', 'g'], ['Brown Sugar', 'g'], ['Tea Leaves', 'g'], ['Green Tea', 'g'], ['Cocoa Powder', 'g'],
    ['Chocolate Syrup', 'ml'], ['Caramel Syrup', 'ml'], ['Hazelnut Syrup', 'ml'], ['Vanilla Extract', 'ml'], ['Butter', 'g'],
    ['All-Purpose Flour', 'g'], ['Eggs', 'pcs'], ['Paneer', 'g'], ['Chicken', 'g'], ['Cheese Slices', 'pcs'],
    ['Tomatoes', 'g'], ['Onions', 'g'], ['Lemons', 'pcs'], ['Paper Cups 8oz', 'pcs'], ['Napkins', 'pcs'], ['Ice', 'g'],
  ];
  const stockRows = STOCK.slice(0, CFG.stockItems).map(([name, unit], i) => {
    const reorder = ri(500, 3000);
    // ~30% low/critical to light up inventory alerts + monitor
    const factor = i % 7 === 0 ? 0.3 : i % 5 === 0 ? 0.7 : ri(12, 60) / 10;
    const onHand = Math.round(reorder * factor);
    return {
      id: randomUUID(), outletId, name, unit,
      qtyOnHand: onHand, reorderLevel: reorder,
      avgCostPaise: ri(20, 600), expiryTracking: chance(0.3),
    };
  });
  await insertMany(prisma.stockItem, stockRows);

  const wasteRows = Array.from({ length: 14 }, () => {
    const s = pick(stockRows);
    return {
      id: randomUUID(), outletId, stockItemId: s.id,
      qty: ri(5, 120), reason: pick(['spoilage', 'spill', 'training', 'return'] as const),
      costPaise: ri(50, 4000), createdAt: atDay(ri(0, 20), ri(9, 20), ri(0, 59)),
    };
  });
  await insertMany(prisma.wasteLog, wasteRows);

  const ledgerRows = Array.from({ length: 24 }, () => {
    const s = pick(stockRows);
    return {
      id: randomUUID(), outletId, stockItemId: s.id,
      change: -ri(2, 40), reason: 'sale', refId: randomUUID(),
      createdAt: atDay(ri(0, 6), ri(9, 21), ri(0, 59)),
    };
  });
  await insertMany(prisma.stockLedger, ledgerRows);

  const critical = stockRows.filter((s) => Number(s.qtyOnHand) <= Number(s.reorderLevel));
  const notifRows = critical.slice(0, 8).map((s) => {
    const out = Number(s.qtyOnHand) <= 0;
    return {
      id: randomUUID(), outletId,
      type: out ? 'out_of_stock' : 'low_stock',
      severity: out ? 'critical' : 'warn',
      title: `${s.name} ${out ? 'out of stock' : 'running low'}`,
      body: `On hand ${s.qtyOnHand}${s.unit}, reorder at ${s.reorderLevel}${s.unit}.`,
      entity: 'stock_item', entityId: s.id, audience: 'owner',
      createdAt: atDay(0, ri(8, 12), ri(0, 59)),
    };
  });
  await insertMany(prisma.notification, notifRows);

  // ---------- loyalty ledger ----------
  const loyaltyRows: any[] = [];
  for (const cid of shuffle(custIds).slice(0, 160)) {
    const n = ri(1, 5);
    for (let i = 0; i < n; i++) {
      loyaltyRows.push({
        id: randomUUID(), customerId: cid, outletId,
        type: pick(['earn', 'earn', 'earn', 'burn', 'adjust'] as const),
        points: ri(10, 300), source: pick(['order', 'order', 'game', 'referral', 'checkin', 'birthday'] as const),
        createdAt: atDay(ri(0, 40), ri(9, 21), ri(0, 59)),
      });
    }
  }
  await insertMany(prisma.loyaltyLedger, loyaltyRows);

  // ---------- coupons ----------
  const couponRows = Array.from({ length: CFG.coupons }, (_, i) => ({
    id: randomUUID(), tenantId,
    customerId: chance(0.8) ? pick(custIds) : null,
    code: `KAHWA${String(1000 + i)}`,
    status: pick(['issued', 'issued', 'redeemed', 'expired'] as const),
    source: pick(['reward', 'referral', 'birthday', 'promo'] as const),
    expiresAt: new Date(Date.now() + ri(-20, 40) * DAY),
    createdAt: atDay(ri(0, 40), 12, 0),
  }));
  await insertMany(prisma.coupon, couponRows);

  // ---------- segments + campaigns + sends ----------
  const segRows = ['High Value', 'Lapsed 60d+', 'Birthday This Month', 'New Members'].map((name) => ({
    id: randomUUID(), tenantId, name, rules: {},
  }));
  await insertMany(prisma.segment, segRows);

  const campRows = Array.from({ length: 5 }, (_, i) => ({
    id: randomUUID(), tenantId,
    channel: pick(['whatsapp', 'sms', 'push'] as const),
    segmentId: pick(segRows).id,
    template: { title: `Campaign ${i + 1}` },
    status: pick(['sent', 'sent', 'scheduled', 'draft'] as const),
    scheduledAt: atDay(ri(0, 20), 10, 0),
  }));
  await insertMany(prisma.campaign, campRows);

  const sendRows: any[] = [];
  for (const c of campRows) {
    if (c.status !== 'sent') continue;
    for (const cid of shuffle(custIds).slice(0, ri(30, 80))) {
      const opened = chance(0.55);
      sendRows.push({
        id: randomUUID(), campaignId: c.id, customerId: cid,
        status: 'sent', sentAt: c.scheduledAt,
        openedAt: opened ? new Date(c.scheduledAt.getTime() + ri(5, 600) * 60_000) : null,
        clickedAt: opened && chance(0.4) ? new Date(c.scheduledAt.getTime() + ri(10, 900) * 60_000) : null,
      });
    }
  }
  await insertMany(prisma.campaignSend, sendRows);

  // ---------- game sessions ----------
  let game = await prisma.game.findFirst({ where: { tenantId } });
  if (!game) game = await prisma.game.create({ data: { tenantId, key: 'spin_wheel', name: 'Spin the Wheel', active: true } });
  const gameRows = Array.from({ length: CFG.gameSessions }, () => {
    const started = atDay(ri(0, 30), ri(9, 21), ri(0, 59));
    return {
      id: randomUUID(), customerId: pick(custIds), outletId, gameId: game!.id,
      result: { prize: pick(['free_coffee', 'no_win', '50pts', 'bogo']) },
      startedAt: started, endedAt: new Date(started.getTime() + ri(10, 90) * 1000),
    };
  });
  await insertMany(prisma.gameSession, gameRows);

  // ---------- update tenant usage counters ----------
  await prisma.usageCounter.upsert({
    where: { tenantId_metric_period: { tenantId, metric: 'customers', period: 'all' } },
    create: { tenantId, metric: 'customers', value: CFG.customers },
    update: { value: CFG.customers },
  });
  await prisma.usageCounter.upsert({
    where: { tenantId_metric_period: { tenantId, metric: 'staff', period: 'all' } },
    create: { tenantId, metric: 'staff', value: allStaff.length },
    update: { value: allStaff.length },
  });

  // ---------- summary ----------
  const settledCount = orderRows.filter((o) => o.status === 'settled').length;
  const revenue = orderRows.filter((o) => o.status === 'settled').reduce((s, o) => s + o.totalPaise, 0);
  console.log('✅  Bulk demo data generated for tenant', tenant.name, `(${CFG.subdomain})`);
  console.table({
    customers: customerRows.length,
    menuItemsAdded: demoItems.length,
    menuPoolSize: menuPool.length,
    demoStaff: demoStaffRows.length,
    orders: orderRows.length,
    settledOrders: settledCount,
    orderItems: itemRows.length,
    payments: paymentRows.length,
    shifts: shiftRows.length,
    attendanceToday: attRows.length,
    salaryPayments: salRows.length,
    vendors: vendorRows.length,
    purchaseOrders: poRows.length,
    supplierPayments: supPayRows.length,
    stockItems: stockRows.length,
    wasteLogs: wasteRows.length,
    lowStockAlerts: notifRows.length,
    loyaltyLedger: loyaltyRows.length,
    coupons: couponRows.length,
    campaigns: campRows.length,
    campaignSends: sendRows.length,
    gameSessions: gameRows.length,
    revenueRupees: Math.round(revenue / 100).toLocaleString('en-IN'),
  });
  console.log('    Demo staff PINs → Manager 4444 · Aisha 5001 · Rahul 5002 · Sana 5003 · Vikram 5004 · Neha 5005 · Imran 5006 · Deepa 5007');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
