import { getSession } from '@/lib/auth';
import { landingDisplay, landingBody } from '@/components/landing/fonts';
import { Landing } from '@/components/landing/Landing';

export const dynamic = 'force-dynamic';

/**
 * Hidden preview of the new premium marketing landing (components/landing/).
 * Not linked from anywhere — reachable only at /preview so the redesign is
 * preserved while `/` stays the launcher for the demo. Finish its real content
 * here, then promote it to `/` when ready.
 */
export default async function LandingPreview() {
  const session = await getSession();
  return (
    <div className={`${landingDisplay.variable} ${landingBody.variable}`}>
      <Landing signedIn={!!session} />
    </div>
  );
}
