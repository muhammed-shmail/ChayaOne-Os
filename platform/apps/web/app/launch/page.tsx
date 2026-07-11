import Link from 'next/link';
import {
  ThemeToggle, AlphaTag, ArrowRight,
  Table2, ChefHat, Smartphone, LayoutDashboard,
  Receipt, Gift, BarChart3, Package, CreditCard,
  type LucideIcon,
} from '@/components/ui';

export const dynamic = 'force-dynamic';

// App surfaces — cards link signed-in staff into each product area (role-gated).
const surfaces: { href: string; surface: string; Icon: LucideIcon; title: string; desc: string; live: boolean }[] = [
  { href: '/pos', surface: 'pos', Icon: Table2, title: 'Tablet POS', desc: 'Billing, GST, KOT & payments.', live: true },
  { href: '/kds', surface: 'kds', Icon: ChefHat, title: 'Kitchen Display', desc: 'Live ticket queue & timers.', live: true },
  { href: '/app', surface: 'app', Icon: Smartphone, title: 'Customer PWA', desc: 'Scan, track, play, earn.', live: true },
  { href: '/dashboard', surface: 'dashboard', Icon: LayoutDashboard, title: 'Owner Dashboard', desc: 'Analytics & AI assistants.', live: true },
];

// Capability chips — Lucide icons (no emoji), Coffee-Gold, stroke 2.
const chips: { Icon: LucideIcon; label: string }[] = [
  { Icon: Receipt, label: 'GST Billing & KOT' },
  { Icon: ChefHat, label: 'Live Kitchen Display' },
  { Icon: Gift, label: 'Loyalty, Rewards & Games' },
  { Icon: BarChart3, label: 'AI-Powered Analytics' },
  { Icon: Package, label: 'Inventory & Suppliers' },
  { Icon: CreditCard, label: 'UPI & Card Payments' },
];

export default function LaunchHub() {
  // Show every surface card to everyone — each page still gatekeeps by role/login on open.
  const visible = surfaces;

  return (
    <main
      className="min-h-screen grid place-items-center px-6 py-12 sm:p-10"
      style={{ background: 'radial-gradient(90% 60% at 50% -10%, color-mix(in srgb, var(--turmeric) 12%, transparent), transparent 60%), var(--paper)' }}
    >
      <div className="fixed top-4 right-4 z-10"><ThemeToggle /></div>

      <div className="max-w-3xl w-full">
        <p className="lux-eyebrow mb-5">Growth Operating System · for cafés</p>

        {/* brand lockup: Chaya.One logo · CafeOS wordmark, vertically centred */}
        <div className="flex items-center gap-4 sm:gap-5 mb-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo chaya one.png" alt="Chaya.One" className="brand-logo h-14 sm:h-16 w-auto object-contain shrink-0" />
          <span className="w-px self-stretch my-1 shrink-0" style={{ background: 'var(--gold-hair)' }} aria-hidden />
          <h1 className="font-display font-semibold text-5xl sm:text-6xl leading-[0.9] tracking-tight">
            Cafe<span className="text-gold-d">OS</span>
          </h1>
        </div>

        <AlphaTag className="mb-6" />

        <p className="text-ink-2 text-lg mb-6 max-w-xl leading-relaxed">
          Everything your café needs to run and grow — billing, kitchen, customers, and
          insights in one beautifully simple system.
        </p>

        {/* capability chips */}
        <div className="flex flex-wrap gap-2.5 mb-10 max-w-xl">
          {chips.map(({ Icon, label }) => (
            <span key={label} className="pill gap-2 px-3.5 py-2 text-[13px]" style={{ background: 'var(--paper-3)' }}>
              <Icon size={16} strokeWidth={2} className="text-gold-d shrink-0" aria-hidden />
              {label}
            </span>
          ))}
        </div>

        {/* app surfaces */}
        <div className="grid sm:grid-cols-2 gap-4">
          {visible.map((s) => {
            const Ic = s.Icon;
            const inner = (
              <>
                <span className={`pill absolute top-4 right-4 ${s.live ? 'pill-ok' : ''}`}>
                  {s.live ? '● live' : 'soon'}
                </span>
                <span
                  className="inline-grid place-items-center w-12 h-12 rounded-2xl mb-4 text-gold-d"
                  style={{
                    background: 'linear-gradient(140deg, color-mix(in srgb, var(--gold) 16%, transparent), color-mix(in srgb, var(--gold) 4%, transparent))',
                    border: '1px solid var(--gold-hair)',
                  }}
                >
                  <Ic size={23} strokeWidth={1.9} aria-hidden />
                </span>
                <h3 className="font-display text-2xl mb-1 leading-tight">{s.title}</h3>
                <p className="text-ink-2 text-sm leading-relaxed">{s.desc}</p>
                {s.live && (
                  <ArrowRight
                    size={18}
                    strokeWidth={2}
                    aria-hidden
                    className="absolute bottom-5 right-5 text-gold-d opacity-0 transition-opacity duration-200 group-hover:opacity-100 motion-reduce:transition-none"
                  />
                )}
              </>
            );
            return s.live ? (
              <Link key={s.href} href={s.href} className="lux-card card-hover card-glow p-6 pr-14 transition relative group">{inner}</Link>
            ) : (
              <div key={s.href} className="lux-card p-6 relative opacity-60">{inner}</div>
            );
          })}
        </div>
      </div>

      {/* subtle hover affordance for the surface arrow — restrained, respects reduced-motion */}
      {/* raster logo is dark-on-transparent; lift it so it reads on the dark theme.
          Unquoted attribute selector — a quoted "dark" gets escaped in the server
          HTML and triggers a hydration text-mismatch. */}
      <style dangerouslySetInnerHTML={{ __html: `[data-theme=dark] .brand-logo{ filter:brightness(1.55) contrast(1.05); }` }} />
    </main>
  );
}
