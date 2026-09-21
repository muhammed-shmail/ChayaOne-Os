import { redirect } from 'next/navigation';
import { prisma } from '@cafeos/db';
import { getSession } from '@/lib/auth';
import { canManageDayClosing } from '@/lib/rbac';
import { DayClosingView } from '@/components/finance/DayClosingView';

export const revalidate = 0;

export default async function DayClosingPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const outlet = await prisma.outlet.findUnique({
    where: { id: session.outletId },
    select: {
      id: true,
      name: true,
      address: true,
      gstin: true,
      timezone: true,
      settings: true,
    },
  });

  if (!outlet) redirect('/api/auth/logout');

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)] p-4 md:p-8">
      <DayClosingView
        outlet={outlet}
        currentStaff={session}
        isStandalonePage={true}
      />
    </div>
  );
}
