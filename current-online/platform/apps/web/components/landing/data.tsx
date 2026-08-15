import {
  Receipt, ChefHat, Gift, BarChart3, Package, CreditCard, Tablet, LayoutDashboard,
  Smartphone, QrCode, Users, Sparkles, Bot, Coffee, ShieldCheck, Bell, Clock3,
  type LucideIcon,
} from 'lucide-react';

export type Feature = { Icon: LucideIcon; title: string; desc: string; live?: boolean };

/** Quick-scan capability pills (feature chips). */
export const chips: { Icon: LucideIcon; label: string }[] = [
  { Icon: Receipt, label: 'GST Billing' },
  { Icon: Tablet, label: 'Tablet POS' },
  { Icon: ChefHat, label: 'Kitchen Display' },
  { Icon: QrCode, label: 'QR Ordering' },
  { Icon: CreditCard, label: 'UPI & Card Payments' },
  { Icon: Package, label: 'Inventory' },
  { Icon: Gift, label: 'Rewards & Loyalty' },
  { Icon: Users, label: 'CRM' },
  { Icon: BarChart3, label: 'Analytics' },
  { Icon: Bot, label: 'AI Assistant' },
  { Icon: Smartphone, label: 'Customer App' },
  { Icon: ShieldCheck, label: 'Security' },
];

/** Marquee feature cards grouped by where they live in a real café. */
export const heroCards: (Feature & { zone: string })[] = [
  {
    zone: 'Front of house', Icon: Tablet, title: 'Tablet POS & GST Billing', live: true,
    desc: 'Ring up orders, split tables, print GST-perfect bills and fire KOTs — in a couple of taps.'
  },
  {
    zone: 'Back of house', Icon: ChefHat, title: 'Kitchen Display', live: true,
    desc: 'Tickets land the instant an order is placed. Live timers keep every station honest.'
  },
  {
    zone: 'The books', Icon: LayoutDashboard, title: 'Owner Dashboard & AI', live: true,
    desc: 'Revenue, top-sellers and staff performance — with an AI that tells you what to do next.'
  },
];

/** Supporting feature grid. */
export const gridCards: Feature[] = [
  { Icon: Receipt, title: 'GST Billing', desc: 'Compliant invoices, HSN codes and tax splits, done automatically.' },
  { Icon: QrCode, title: 'QR Ordering', desc: 'Guests scan, browse and order from the table — no app to install.' },
  { Icon: CreditCard, title: 'Payments', desc: 'UPI, cards and cash reconciled into one clean end-of-day total.' },
  { Icon: Package, title: 'Inventory', desc: 'Recipe-level stock that deducts as you sell and flags low items.' },
  { Icon: Gift, title: 'Rewards & Loyalty', desc: 'Points, tiers and playful games that bring regulars back.' },
  { Icon: Smartphone, title: 'Customer App', desc: 'Your own branded PWA for ordering, tracking and earning points.' },
  { Icon: Users, title: 'CRM', desc: 'Every guest, visit and spend in one profile you can act on.' },
  { Icon: Clock3, title: 'Live Orders', desc: 'Watch service unfold across counter, kitchen and tables in real time.' },
];

export const stats: { value: number; prefix?: string; suffix: string; decimals?: number; label: string }[] = [
  { value: 2.3, prefix: '₹', suffix: 'Cr+', decimals: 1, label: 'Revenue processed' },
  { value: 150, suffix: '+', label: 'Cafés running on it' },
  { value: 40, suffix: 'K+', label: 'Orders served' },
  { value: 99.9, suffix: '%', decimals: 1, label: 'Uptime, every month' },
];

export type Testimonial = { quote: string; name: string; cafe: string };
export const testimonials: Testimonial[] = [
  {
    quote: 'Billing that used to take my staff a minute now takes ten seconds. Evening rush finally feels calm.',
    name: 'Ananya Rao', cafe: 'Filter & Co. · Bengaluru'
  },
  {
    quote: 'The kitchen display ended the paper-chit chaos. Nothing gets missed, and my cooks love the timers.',
    name: 'Imran Qureshi', cafe: 'Chai Darbar · Hyderabad'
  },
  {
    quote: 'I can see exactly which items make money from my phone. It changed how I plan the menu.',
    name: 'Meera Nair', cafe: 'Coastline Brew · Kochi'
  },
  {
    quote: 'Rewards brought my regulars back twice as often. Setup took an afternoon, not a project.',
    name: 'Rohit Sethi', cafe: 'The Roastery · Pune'
  },
  {
    quote: 'GST filing stopped being a nightmare. Every bill is clean and the reports just export.',
    name: 'Kavya Menon', cafe: 'Verandah Cafe · Chennai'
  },
];

export type Plan = {
  name: string; note: string; price: string; unit?: string; popular?: boolean;
  cta: string; feats: string[];
};
/** NOTE for the team: swap these indicative figures for your live pricing. */
export const plans: Plan[] = [
  {
    name: 'Starter', note: 'For a single counter finding its feet.', price: '₹999', unit: '/mo',
    cta: 'Start free trial',
    feats: ['Tablet POS & GST billing', 'Kitchen display', 'UPI & card payments', 'Daily sales reports']
  },
  {
    name: 'Growth', note: 'For busy cafés ready to scale.', price: '₹1,999', unit: '/mo', popular: true,
    cta: 'Start free trial',
    feats: ['Everything in Starter', 'Inventory & suppliers', 'Loyalty, rewards & games', 'Customer app & QR ordering', 'Advanced analytics']
  },
  {
    name: 'Pro', note: 'For multi-outlet brands.', price: "Let's talk", unit: '',
    cta: 'Book a demo',
    feats: ['Everything in Growth', 'AI sales assistant', 'Multi-outlet control', 'CRM & campaigns', 'Priority support & onboarding']
  },
];

export const navLinks = [
  { label: 'Features', href: '#features' },
  //{ label: 'Pricing', href: '#pricing' },//
  { label: 'Customers', href: '#customers' },
  { label: 'About', href: '#about' },
  { label: 'Contact', href: '#contact' },
];
