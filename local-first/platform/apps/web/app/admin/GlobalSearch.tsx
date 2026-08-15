'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function GlobalSearch() {
  const [query, setQuery] = useState('');
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/admin/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <form onSubmit={handleSearch} className="flex-1 max-w-xl hidden sm:block relative group">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-3)]" size={18} />
      <input 
        type="text" 
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search cafes, owners, phones, invoices..." 
        className="inp w-full pl-10 h-11 text-sm bg-[var(--paper-2)] border-transparent group-hover:border-[var(--line)] transition-colors focus:bg-[var(--paper)] focus:border-[var(--gold)] focus:ring-1 focus:ring-[var(--gold)]"
      />
    </form>
  );
}
