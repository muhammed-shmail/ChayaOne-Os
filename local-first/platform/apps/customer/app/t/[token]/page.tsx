import { CustomerAppClient } from '@/components/CustomerAppClient';

export const dynamic = 'force-dynamic';

export default function CustomerTableQrPage({ params }: { params: { token: string } }) {
  return <CustomerAppClient initialToken={params.token} />;
}
