import PwaClient from '../app/PwaClient';

export const dynamic = 'force-dynamic';

/**
 * /customer — Direct URL for the Customer QR & Menu App on the Main PC server.
 */
export default function CustomerEntryPage({ searchParams }: { searchParams: { t?: string } }) {
  return <PwaClient qrToken={searchParams.t ?? null} />;
}
