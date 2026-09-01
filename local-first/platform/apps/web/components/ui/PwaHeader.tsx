import React from 'react';

interface PwaHeaderProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function PwaHeader({ title, subtitle, children, className = '', style }: PwaHeaderProps) {
  return (
    <header className={`pwa-h ${className}`} style={style}>
      {title && <h3>{title}</h3>}
      {subtitle && <span>{subtitle}</span>}
      {children}
    </header>
  );
}
