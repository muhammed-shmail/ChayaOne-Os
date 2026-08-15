export default function ErrorLogsPage() {
  return (
    <div className="p-6 max-w-[1600px] mx-auto h-full flex flex-col">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold">Error Logs</h1>
        <p className="text-sm mt-2 text-[var(--ink-3)]">Track application exceptions and crashes.</p>
      </header>
      <div className="lux-card card-glow p-8 bg-[var(--paper-2)] min-h-[500px] flex flex-col">
        <div className="flex-1 bg-[#1a0f0f] border border-[var(--danger)]/30 rounded-lg p-4 font-mono text-xs text-red-400 overflow-y-auto">
          <div className="mb-4">
            <span className="bg-red-500/20 px-2 py-0.5 rounded font-bold">ERROR</span>
            <span className="ml-2">[PrismaClientKnownRequestError]: Invalid prisma.tenant.findUnique() invocation</span>
            <div className="ml-12 mt-1 text-red-400/70">Inconsistent column data: Error creating UUID, invalid character: expected an optional prefix of urn:uuid: followed by [0-9a-fA-F-], found 	 at 1</div>
          </div>
          <div className="mb-4">
             <span className="bg-red-500/20 px-2 py-0.5 rounded font-bold">FATAL</span>
             <span className="ml-2">Webhook processing failed (Stripe signature mismatch)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
