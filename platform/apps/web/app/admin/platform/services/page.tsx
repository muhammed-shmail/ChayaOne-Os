export default function ServicesPage() {
  return (
    <div className="p-6 max-w-[1600px] mx-auto h-full flex flex-col">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold">Platform Services</h1>
        <p className="text-sm mt-2 text-[var(--ink-3)]">Toggle global features affecting all tenants.</p>
      </header>
      <div className="lux-card card-glow p-8 bg-[var(--paper-2)]">
        <div className="space-y-6 max-w-2xl">
           <div className="flex items-center justify-between">
              <div>
                 <h3 className="font-bold">Maintenance Mode</h3>
                 <p className="text-xs text-[var(--ink-3)] mt-1">Block all non-admin traffic to the platform.</p>
              </div>
              <div className="w-12 h-6 bg-[var(--paper-3)] rounded-full border border-[var(--line)] relative cursor-pointer">
                 <div className="absolute left-1 top-1 w-4 h-4 bg-[var(--ink-3)] rounded-full" />
              </div>
           </div>
           
           <div className="flex items-center justify-between border-t border-[var(--line-2)] pt-6">
              <div>
                 <h3 className="font-bold">Global Gamification Engine</h3>
                 <p className="text-xs text-[var(--ink-3)] mt-1">Allow tenants to run Spin the Wheel and Scratch Cards.</p>
              </div>
              <div className="w-12 h-6 bg-[var(--ok)] rounded-full border border-[var(--ok-bg)] relative cursor-pointer">
                 <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
              </div>
           </div>

           <div className="flex items-center justify-between border-t border-[var(--line-2)] pt-6">
              <div>
                 <h3 className="font-bold">New Registrations</h3>
                 <p className="text-xs text-[var(--ink-3)] mt-1">Allow self-serve signup for new cafes.</p>
              </div>
              <div className="w-12 h-6 bg-[var(--ok)] rounded-full border border-[var(--ok-bg)] relative cursor-pointer">
                 <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
