import React from 'react';

interface KPIItem {
  label: string;
  value: string;
  icon?: React.ReactNode;
}

interface KPIGroupProps {
  title: string;
  items: KPIItem[];
}

export const KPIGroup: React.FC<KPIGroupProps> = ({ title, items }) => {
  return (
    <section className="card p-4" style={{ background: 'var(--paper-2)' }}>
      <h4 className="font-bold mb-3" style={{ color: 'var(--ink-2)' }}>{title}</h4>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-start gap-2.5 p-2.5 rounded-lg"
            style={{ background: 'var(--paper-3)' }}
          >
            {item.icon && (
              <span
                className="flex items-center justify-center w-7 h-7 rounded-full shrink-0 mt-0.5"
                style={{ background: 'var(--turmeric)', color: '#2A1607' }}
              >
                {item.icon}
              </span>
            )}
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold tracking-wider" style={{ color: 'var(--ink-3)' }}>{item.label}</span>
              <span className="block text-sm font-extrabold" style={{ color: 'var(--ink)' }}>{item.value}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
