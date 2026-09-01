import { PageHeader } from '@/components/ui/PageHeader';
export default function SystemLogsPage() {
  return (
    <div className="p-6 max-w-[1600px] mx-auto h-full flex flex-col">
      <PageHeader title="System Logs" description="Live stream of underlying server operations." />
      <div className="lux-card card-glow p-8 bg-[var(--paper-2)] min-h-[500px] flex flex-col">
        <div className="flex-1 bg-black rounded-lg p-4 font-mono text-xs text-green-400 overflow-y-auto">
          <div>[INFO] System initialized.</div>
          <div>[INFO] Connecting to database...</div>
          <div>[OK] Database connected.</div>
          <div>[WARN] Redis latency spike detected (120ms).</div>
          <div>[INFO] Incoming request to /api/auth/login.</div>
          <div>[OK] Request processed in 45ms.</div>
          <div className="mt-4 text-green-700 animate-pulse">Waiting for new logs...</div>
        </div>
      </div>
    </div>
  );
}
