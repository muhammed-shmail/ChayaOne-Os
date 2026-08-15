import { redirect } from 'next/navigation';

// The premium landing was promoted to `/`. Keep this route as a redirect so any
// old /preview bookmark still lands on the live home page.
export default function Preview() {
  redirect('/');
}
