import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import LoginClient from './LoginClient';

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

  return <LoginClient next={searchParams.next ?? '/dashboard'} />;
}
