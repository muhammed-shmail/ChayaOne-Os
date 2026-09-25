import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import LoginClient from './LoginClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sign in',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const session = await getSession();
  if (session) {
    redirect(searchParams.next ?? '/dashboard');
  }

  let businessName = 'ChayaOne';
  let logoUrl: string | null = null;

  try {
    const outlet = await prisma.outlet.findFirst({
      select: {
        name: true,
        settings: true,
        tenant: { select: { name: true } },
      },
    });
    businessName = outlet?.tenant?.name || outlet?.name || 'ChayaOne';
    logoUrl = (outlet?.settings as any)?.logoUrl || null;
  } catch {
    // fallback if db error
  }

  return (
    <LoginClient
      next={searchParams.next ?? '/dashboard'}
      initialBusinessName={businessName}
      initialLogoUrl={logoUrl}
    />
  );
}

