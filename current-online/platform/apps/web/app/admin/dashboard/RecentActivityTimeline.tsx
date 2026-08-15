'use client';

import { Activity } from 'lucide-react';

const mockActivities = [
  { id: '1', title: 'Subscription Renewed', entity: 'Cafe Mocha', time: '10 mins ago', type: 'success' },
  { id: '2', title: 'Payment Failed', entity: 'Urban Roasters', time: '1 hr ago', type: 'error' },
  { id: '3', title: 'New Cafe Created', entity: 'Bean Scene', time: '2 hrs ago', type: 'info' },
  { id: '4', title: 'Feature Enabled', entity: 'Tea Time (Kitchen Display)', time: '3 hrs ago', type: 'default' },
  { id: '5', title: 'Owner Updated', entity: 'Daily Grind', time: '5 hrs ago', type: 'default' },
];

export function RecentActivityTimeline() {
  return (
    <div className="lux-card card-glow flex flex-col h-full">
      <div className="p-5 border-b border-[var(--line)]">
        <h3 className="font-display text-lg font-bold flex items-center gap-2">
          <Activity size={18} className="text-[var(--gold)]" />
          Recent Activity
        </h3>
      </div>
      <div className="p-5 flex-1">
        <div className="relative border-l border-[var(--line-2)] ml-3 space-y-6 pb-2">
          {mockActivities.map((activity, i) => (
            <div key={activity.id} className="relative pl-6">
              <span className={`absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full border-2 border-[var(--paper-2)] ${
                activity.type === 'success' ? 'bg-[var(--ok)]' :
                activity.type === 'error' ? 'bg-[var(--danger)]' :
                activity.type === 'info' ? 'bg-[var(--gold)]' :
                'bg-[var(--ink-3)]'
              }`}></span>
              <div>
                <p className="text-sm font-semibold text-[var(--ink)]">{activity.title}</p>
                <div className="flex justify-between items-center mt-1">
                  <p className="text-xs text-[var(--ink-2)]">{activity.entity}</p>
                  <p className="text-[11px] text-[var(--ink-3)] font-medium">{activity.time}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
