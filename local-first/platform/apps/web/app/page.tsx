import { getSession } from '@/lib/auth';
import { landingDisplay, landingBody } from '@/components/landing/fonts';
import { Landing } from '@/components/landing/Landing';
import { prisma } from '@cafeos/db';

export const dynamic = 'force-dynamic';

// Home = the premium guided marketing landing (Hero + live "watch your café run"
// demo, feature story, pricing, testimonials). The staff launcher lives at /launch.
export default async function Home() {
  const session = await getSession();
  const dbPlans = await prisma.planDefinition.findMany({
    where: { active: true },
    orderBy: { key: 'asc' },
  });

  return (
    <div className={`${landingDisplay.variable} ${landingBody.variable}`}>
      <Landing signedIn={!!session} dbPlans={dbPlans} />
    </div>
  );
}
