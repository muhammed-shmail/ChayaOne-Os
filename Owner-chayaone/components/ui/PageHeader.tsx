import React from 'react';

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string | React.ReactNode;
  subtitle?: string | React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b" style={{ borderColor: 'var(--line)' }}>
      <div>
        <h1 className="text-2xl font-bold font-display" style={{ color: 'var(--ink)' }}>{title}</h1>
        {subtitle && <p className="text-xs mt-1" style={{ color: 'var(--ink-3)' }}>{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
