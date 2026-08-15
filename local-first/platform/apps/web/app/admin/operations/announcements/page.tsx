import { prisma } from '@cafeos/db';
import { getPlatformSession } from '@/lib/platform-session';
import { redirect } from 'next/navigation';
import { Megaphone, Plus } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AnnouncementsPage() {
  const s = await getPlatformSession();
  if (!s) redirect('/admin/login');
  
  const announcements = await prisma.announcement.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50
  });

  return (
    <div className="p-6 max-w-[1600px] mx-auto h-full flex flex-col">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold">Announcements</h1>
          <p className="text-sm mt-2 text-[var(--ink-3)]">Broadcast messages to cafe owners.</p>
        </div>
        <button className="btn btn-primary bg-[var(--gold)] text-[#2A1607] hover:bg-[var(--gold-d)] gap-2 flex items-center">
          <Plus size={16} /> New Announcement
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {announcements.map((a) => (
          <div key={a.id} className="lux-card card-glow p-6 flex flex-col relative">
            {!a.publishedAt && (
              <span className="absolute top-4 right-4 text-[10px] uppercase font-bold px-2 py-1 bg-[var(--warn-bg)] text-[var(--warn-ink)] rounded">Draft</span>
            )}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[var(--paper-3)] border border-[var(--line)] flex items-center justify-center text-[var(--gold)]">
                <Megaphone size={18} />
              </div>
              <div>
                <h3 className="font-bold text-lg leading-tight">{a.title}</h3>
                <p className="text-xs text-[var(--ink-3)] mt-0.5">Audience: {a.audience}</p>
              </div>
            </div>
            <p className="text-sm text-[var(--ink-2)] flex-1 line-clamp-3">{a.body}</p>
            <div className="mt-4 pt-4 border-t border-[var(--line)] flex justify-between items-center text-xs text-[var(--ink-3)]">
              <span>{a.publishedAt ? Published  : Created }</span>
              <button className="text-[var(--gold-d)] font-semibold hover:underline">Edit</button>
            </div>
          </div>
        ))}
        {announcements.length === 0 && (
          <div className="col-span-full py-12 text-center text-[var(--ink-3)]">No announcements found.</div>
        )}
      </div>
    </div>
  );
}
