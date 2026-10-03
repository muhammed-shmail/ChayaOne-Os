import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100">
      <div className="max-w-md w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-8 shadow-lg">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-amber-700 dark:text-amber-400 font-mono text-2xl font-bold">
          404
        </div>
        <h2 className="text-xl font-bold mb-2">Page Not Found</h2>
        <p className="text-sm text-stone-600 dark:text-stone-400 mb-6 leading-relaxed">
          The requested page or resource could not be found. Please check the URL or navigate back to the dashboard.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center w-full px-5 py-2.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
