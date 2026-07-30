import { redirect } from 'next/navigation';
import { getPlatformSession } from '@/lib/platform-session';
import { ShieldCheck, Settings, Key, Zap } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function PlatformPage() {
  const s = await getPlatformSession();
  if (!s) redirect('/admin/login');

  const sections = [
    { title: 'White Label', icon: Settings, desc: 'Manage global branding, default themes, and domains.', href: '/admin/platform/white-label' },
    { title: 'Integrations', icon: Zap, desc: 'Configure global integrations and webhooks.', href: '/admin/platform/integrations' },
    { title: 'Security', icon: ShieldCheck, desc: 'Platform security policies and audit trails.', href: '/admin/platform/security' },
    { title: 'API Keys', icon: Key, desc: 'Manage master API keys and access tokens.', href: '/admin/platform/keys' },
  ];

  return (
    <div className="p-6 max-w-[1600px] mx-auto h-full flex flex-col">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold flex items-center gap-3">
          <ShieldCheck size={28} className="text-[var(--gold)]" />
          Platform Settings
        </h1>
        <p className="text-sm mt-2 text-[var(--ink-3)]">Configure global platform behavior and security.</p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {sections.map(section => (
          <Link key={section.title} href={section.href} className="lux-card card-glow p-6 block hover:bg-[var(--paper-3)] transition-colors">
            <div className="p-3 bg-[var(--paper-2)] border border-[var(--line)] rounded-xl w-fit mb-4 text-[var(--gold-d)]">
              <section.icon size={24} />
            </div>
            <h3 className="font-bold text-lg mb-2">{section.title}</h3>
            <p className="text-sm text-[var(--ink-2)]">{section.desc}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
