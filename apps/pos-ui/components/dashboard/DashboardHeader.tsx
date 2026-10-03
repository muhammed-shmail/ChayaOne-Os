import React from 'react';

interface DashboardHeaderProps {
  title: string | React.ReactNode;
  subtitle: string | React.ReactNode;
  drawerTrigger?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function DashboardHeader({ title, subtitle, drawerTrigger, actions, className = '' }: DashboardHeaderProps) {
  // Default styling for POS dashboard: border-b with padding
  // But allow overrides via className
  const defaultClass = className ? className : "flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b";

  return (
    <header className={defaultClass} style={className ? {} : { borderColor: 'var(--line)' }}>
      <div className="flex items-center gap-3 min-w-0">
        {drawerTrigger && drawerTrigger}
        <div className="min-w-0">
          <h1 className="font-display text-2xl sm:text-3xl md:text-4xl leading-tight truncate">
            {title}
          </h1>
          <p className="text-xs md:text-sm font-bold truncate" style={{ color: 'var(--ink-3)' }}>
            {subtitle}
          </p>
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap justify-end ml-auto">
          {actions}
        </div>
      )}
    </header>
  );
}
