import StaffRuntime from '@/components/StaffRuntime';

// Owners/managers also run on short access tokens now — keep their session alive
// while the dashboard is open (no install banner / SW here; the dashboard is a
// desktop surface, not the phone PWA).
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <StaffRuntime />
    </>
  );
}
