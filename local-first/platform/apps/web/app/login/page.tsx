import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@cafeos/db';
import LoginClient from './LoginClient';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    let outlet = null;
    let staff = null;
    try {
      [outlet, staff] = await Promise.all([
        prisma.outlet.findUnique({ where: { id: session.outletId } }),
        prisma.staffUser.findUnique({ where: { id: session.staffId } }),
      ]);
    } catch (err) {
      console.error('[LoginPage] DB query failed during session check:', err);
    }
    if (outlet && staff) {
      redirect(session.role === 'kitchen' ? '/kds' : (session.role === 'owner' || session.role === 'manager' || session.role === 'cashier' || session.role === 'accountant' ? '/dashboard' : '/pos'));
    } else if (outlet || staff) {
      redirect('/api/auth/logout');
    }
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
  } catch (err) {
    console.error('[LoginPage] Could not load outlet details from database:', err);
  }

  return <LoginClient initialBusinessName={businessName} initialLogoUrl={logoUrl} />;
}
