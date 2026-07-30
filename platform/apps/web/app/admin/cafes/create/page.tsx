import { NewTenant } from '../NewTenant';

export default function CreateCafePage() {
  return (
    <div className="p-6 max-w-[1600px] mx-auto h-full flex flex-col">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold">Create Cafe</h1>
      </header>
      <div className="lux-card card-glow p-8 bg-[var(--paper-2)]">
        <NewTenant />
      </div>
    </div>
  );
}
