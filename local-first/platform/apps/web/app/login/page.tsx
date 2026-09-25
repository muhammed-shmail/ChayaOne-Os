import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@cafeos/db';
import LoginClient from './LoginClient';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    const [outlet, staff] = await Promise.all([
      prisma.outlet.findUnique({ where: { id: session.outletId } }),
      prisma.staffUser.findUnique({ where: { id: session.staffId } }),
    ]);
    if (outlet && staff) {
      redirect(session.role === 'kitchen' ? '/kds' : (session.role === 'owner' || session.role === 'manager' || session.role === 'cashier' || session.role === 'accountant' ? '/dashboard' : '/pos'));
    } else {
      redirect('/api/auth/logout');
    }
  }
  const outlet = await prisma.outlet.findFirst({
    select: {
      name: true,
      settings: true,
      tenant: { select: { name: true } },
    },
  });

  const businessName = outlet?.tenant?.name || outlet?.name || 'ChayaOne';
  const logoUrl = (outlet?.settings as any)?.logoUrl || null;

  return <LoginClient initialBusinessName={businessName} initialLogoUrl={logoUrl} />;
}
