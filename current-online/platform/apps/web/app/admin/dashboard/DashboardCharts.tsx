'use client';

import { BarChart3, TrendingUp } from 'lucide-react';
import { useState } from 'react';

// A generic mock chart to represent the Revenue and Growth charts
// since we don't have a charting library installed right now.
export function DashboardCharts() {
  const [filter, setFilter] = useState('30 Days');
  const filters = ['Today', 'Yesterday', '7 Days', '30 Days', '12 Months'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Interactive Revenue Chart */}
      <div className="lg:col-span-2 lux-card card-glow flex flex-col h-full">
        <div className="p-5 border-b border-[var(--line)] flex justify-between items-center flex-wrap gap-4">
          <h3 className="font-display text-lg font-bold flex items-center gap-2">
            <BarChart3 size={18} className="text-[var(--gold)]" />
            Revenue & Orders
          </h3>
          
          <div className="flex gap-2 bg-[var(--paper-3)] p-1 rounded-lg">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  filter === f 
                    ? 'bg-[var(--gold)] text-[#2A1607] shadow-sm' 
                    : 'text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--paper-2)]'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        
        <div className="p-5 flex-1 min-h-[300px] flex items-end gap-2">
          {/* Mock Bars */}
          {[40, 70, 45, 90, 60, 100, 80, 120, 95, 110, 130, 85].map((height, i) => (
            <div key={i} className="flex-1 flex flex-col justify-end gap-2 group h-full relative">
              {/* Tooltip on hover */}
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-[var(--ink)] text-[var(--paper)] text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                ₹{height * 100}
              </div>
              <div 
                className="w-full bg-[var(--gold)]/20 hover:bg-[var(--gold)]/40 rounded-t-sm transition-colors relative overflow-hidden"
                style={{ height: `${height}%` }}
              >
                <div 
                  className="absolute bottom-0 w-full bg-[var(--gold)] rounded-t-sm" 
                  style={{ height: '30%' }}
                />
              </div>
            </div>
          ))}
        </div>
        
        <div className="p-4 border-t border-[var(--line)] flex gap-6 text-sm text-[var(--ink-2)] font-semibold">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-[var(--gold)] inline-block"></span>
            Revenue
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-[var(--gold)]/20 inline-block"></span>
            Orders
          </div>
        </div>
      </div>

      {/* Growth Analytics Cards */}
      <div className="lg:col-span-1 flex flex-col gap-4">
        <div className="lux-card card-glow p-5">
          <div className="flex justify-between items-start">
            <div className="p-2.5 rounded-xl bg-[var(--paper-3)] text-[var(--ink-2)]">
              <TrendingUp size={20} />
            </div>
            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-[var(--ok-bg)] text-[var(--ok-ink)]">
              +12%
            </span>
          </div>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--ink-3)] mt-4">New Cafes</p>
          <div className="font-display text-3xl leading-tight mt-1 text-[var(--ink)]">48</div>
        </div>

        <div className="lux-card card-glow p-5">
          <div className="flex justify-between items-start">
            <div className="p-2.5 rounded-xl bg-[var(--paper-3)] text-[var(--ink-2)]">
              <TrendingUp size={20} />
            </div>
            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-[var(--ok-bg)] text-[var(--ok-ink)]">
              +24%
            </span>
          </div>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--ink-3)] mt-4">Converted to Paid</p>
          <div className="font-display text-3xl leading-tight mt-1 text-[var(--ink)]">32</div>
        </div>

        <div className="lux-card card-glow p-5">
           <div className="flex justify-between items-start">
            <div className="p-2.5 rounded-xl bg-[var(--paper-3)] text-[var(--ink-2)]">
              <TrendingUp size={20} />
            </div>
            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-[var(--danger-bg)] text-[var(--danger-ink)]">
              -3%
            </span>
          </div>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--ink-3)] mt-4">Retention Rate</p>
          <div className="font-display text-3xl leading-tight mt-1 text-[var(--ink)]">91%</div>
        </div>
      </div>
    </div>
  );
}
