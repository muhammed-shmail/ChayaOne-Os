import { CustomerAppClient } from '@/components/CustomerAppClient';

export const dynamic = 'force-dynamic';

export default function CustomerIndexPage({ searchParams }: { searchParams: { t?: string } }) {
  return <CustomerAppClient initialToken={searchParams.t ?? null} />;
}
