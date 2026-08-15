'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, Filter, Download, ChevronDown, MoreHorizontal, Settings2, ShieldBan, UserCheck, AlertCircle } from 'lucide-react';

const STATUS_BG: Record<string, string> = {
  active: 'var(--ok-bg)',
  trialing: 'var(--info-bg)',
  suspended: 'var(--warn-bg)',
  expired: 'var(--danger-bg)',
  past_due: 'var(--warn-bg)',
  cancelled: 'var(--paper-2)',
};
const STATUS_INK: Record<string, string> = {
  active: 'var(--ok-ink)',
  trialing: 'var(--info-ink)',
  suspended: 'var(--warn-ink)',
  expired: 'var(--danger-ink)',
  past_due: 'var(--warn-ink)',
  cancelled: 'var(--ink-3)',
};

export function CafeList({ initialTenants }: { initialTenants: any[] }) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filter & Search logic
  const filtered = initialTenants.filter(t => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!t.name.toLowerCase().includes(q) && !(t.subdomain || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const toggleAll = () => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(t => t.id)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  return (
    <div className="lux-card card-glow flex flex-col h-full bg-[var(--paper-2)]">
      {/* Toolbar */}
      <div className="p-4 border-b border-[var(--line)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative group min-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-3)]" size={16} />
            <input 
              type="text" 
              placeholder="Search cafes, owners, phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="inp w-full pl-9 h-10 text-sm focus:border-[var(--gold)] focus:ring-[var(--gold)]"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-[var(--ink-3)]" />
            <select 
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="inp h-10 text-sm py-0 pl-3 pr-8 min-w-[140px] focus:border-[var(--gold)] focus:ring-[var(--gold)]"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="trialing">Trialing</option>
              <option value="suspended">Suspended</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 mr-2 border-r border-[var(--line)] pr-4">
              <span className="text-xs font-bold text-[var(--ink-2)]">{selectedIds.size} selected</span>
              <button className="p-2 rounded-lg hover:bg-[var(--paper-3)] text-[var(--warn)] transition" title="Suspend">
                <ShieldBan size={18} />
              </button>
              <button className="p-2 rounded-lg hover:bg-[var(--paper-3)] text-[var(--ok)] transition" title="Activate">
                <UserCheck size={18} />
              </button>
            </div>
          )}
          
          <button className="btn btn-ghost btn-sm h-10 gap-2 text-[var(--ink-2)]">
            <Settings2 size={16} />
            Columns
          </button>
          <button className="btn btn-ghost btn-sm h-10 gap-2 text-[var(--ink-2)]">
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto min-h-[400px]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--line)] bg-[var(--paper-3)] text-left text-xs uppercase tracking-wider text-[var(--ink-3)]">
              <th className="px-4 py-3 w-10">
                <input 
                  type="checkbox" 
                  className="rounded border-[var(--line)] text-[var(--gold)] focus:ring-[var(--gold)]" 
                  checked={filtered.length > 0 && selectedIds.size === filtered.length}
                  onChange={toggleAll}
                />
              </th>
              <th className="px-4 py-3 font-semibold">Cafe</th>
              <th className="px-4 py-3 font-semibold">Owner</th>
              <th className="px-4 py-3 font-semibold">Plan</th>
              <th className="px-4 py-3 font-semibold">Subscription</th>
              <th className="px-4 py-3 font-semibold">Usage</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => {
              const st = t.subscription?.status ?? '—';
              const isSelected = selectedIds.has(t.id);
              return (
                <tr key={t.id} className={`border-b transition-colors hover:bg-[var(--paper-3)] ${isSelected ? 'bg-[var(--gold)]/5' : ''}`} style={{ borderColor: 'var(--line)' }}>
                  <td className="px-4 py-4">
                    <input 
                      type="checkbox" 
                      className="rounded border-[var(--line)] text-[var(--gold)] focus:ring-[var(--gold)]" 
                      checked={isSelected}
                      onChange={() => toggleOne(t.id)}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[var(--paper-3)] border border-[var(--line)] flex items-center justify-center font-display text-lg text-[var(--gold-d)]">
                        {t.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-[var(--ink)]">{t.name}</div>
                        <div className="text-xs text-[var(--ink-3)]">{t.subdomain ?? '—'}.chayaone.com</div>
                        <div className="text-xs text-[var(--ink-3)] mt-0.5">Bangalore, KA</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-[var(--ink-2)] font-medium">Owner Name</div>
                    <div className="text-xs text-[var(--ink-3)]">+91 98765 43210</div>
                    <div className="text-xs text-[var(--ink-3)]">owner@example.com</div>
                  </td>
                  <td className="px-4 py-4 capitalize font-semibold text-[var(--ink-2)]">{t.subscription?.plan.name ?? t.plan}</td>
                  <td className="px-4 py-4">
                    <span className="rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide" style={{ background: STATUS_BG[st] ?? 'var(--paper-2)', color: STATUS_INK[st] ?? 'var(--ink-2)' }}>{st}</span>
                  </td>
                  <td className="px-4 py-4 text-xs font-medium text-[var(--ink-2)]">
                    <div className="flex gap-3">
                      <span>{t._count.outlets} <span className="text-[var(--ink-3)]">br</span></span>
                      <span>{t._count.staff} <span className="text-[var(--ink-3)]">staff</span></span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide" style={{ background: STATUS_BG[t.status] ?? 'var(--paper-2)', color: STATUS_INK[t.status] ?? 'var(--ink-2)' }}>{t.status}</span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/admin/cafes/${t.id}`} className="btn btn-sm btn-ghost text-[var(--gold-d)] border-[var(--gold)]/30 hover:border-[var(--gold)] hover:bg-[var(--gold)]/10">Manage</Link>
                      <button className="btn btn-sm btn-icon btn-ghost text-[var(--ink-3)] hover:text-[var(--ink)]">
                        <MoreHorizontal size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center">
                  <div className="inline-flex flex-col items-center">
                    <AlertCircle size={32} className="text-[var(--ink-3)] mb-3" />
                    <p className="text-[var(--ink-2)] font-semibold">No cafes found</p>
                    <p className="text-sm text-[var(--ink-3)] mt-1">Try adjusting your filters or search query.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination Footer */}
      <div className="p-4 border-t border-[var(--line)] flex items-center justify-between text-sm text-[var(--ink-2)]">
        <div>Showing {filtered.length} entries</div>
        <div className="flex gap-1">
          <button className="px-3 py-1.5 rounded-lg border border-[var(--line)] hover:bg-[var(--paper-3)] transition-colors disabled:opacity-50" disabled>Previous</button>
          <button className="px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--gold)]/10 text-[var(--gold-d)] border-[var(--gold)]/30 font-bold">1</button>
          <button className="px-3 py-1.5 rounded-lg border border-[var(--line)] hover:bg-[var(--paper-3)] transition-colors">2</button>
          <button className="px-3 py-1.5 rounded-lg border border-[var(--line)] hover:bg-[var(--paper-3)] transition-colors">Next</button>
        </div>
      </div>
    </div>
  );
}
