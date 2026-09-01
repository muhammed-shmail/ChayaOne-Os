import React from 'react';

interface PageHeaderProps {
  title: string | React.ReactNode;
  description?: string | React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, children, className = '' }: PageHeaderProps) {
  return (
    <header className={`flex flex-wrap items-center justify-between gap-4 mb-8 ${className}`}>
      <div className="min-w-0">
        {typeof title === 'string' ? (
          <h1 className="text-2xl md:text-3xl font-display font-extrabold mb-1 truncate">{title}</h1>
        ) : (
          <div className="text-2xl md:text-3xl font-display font-extrabold mb-1 truncate">{title}</div>
        )}
        {description && (
          typeof description === 'string' ? (
            <p className="text-sm font-bold truncate" style={{ color: 'var(--ink-3)' }}>
              {description}
            </p>
          ) : (
            <div className="text-sm font-bold truncate" style={{ color: 'var(--ink-3)' }}>
              {description}
            </div>
          )
        )}
      </div>
      {children && (
        <div className="flex items-center gap-2 shrink-0">
          {children}
        </div>
      )}
    </header>
  );
}
