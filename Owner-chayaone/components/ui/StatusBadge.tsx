type StatusType = 'online' | 'offline' | 'unknown' | 'syncing' | 'warning';

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  size?: 'sm' | 'md';
}

const STATUS_CONFIG: Record<StatusType, { dot: string; bg: string; text: string; label: string }> = {
  online:   { dot: 'bg-emerald-500', bg: 'bg-emerald-50',  text: 'text-emerald-700', label: 'Online' },
  offline:  { dot: 'bg-red-400',     bg: 'bg-red-50',      text: 'text-red-700',     label: 'Offline' },
  unknown:  { dot: 'bg-gray-400',    bg: 'bg-gray-100',    text: 'text-gray-600',    label: 'Unknown' },
  syncing:  { dot: 'bg-blue-500',    bg: 'bg-blue-50',     text: 'text-blue-700',    label: 'Syncing' },
  warning:  { dot: 'bg-amber-400',   bg: 'bg-amber-50',    text: 'text-amber-700',   label: 'Warning' },
};

export function StatusBadge({ status, label, size = 'sm' }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status];
  const sizeClass = size === 'md' ? 'px-3 py-1.5 text-sm' : 'px-2 py-0.5 text-xs';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${cfg.bg} ${cfg.text} ${sizeClass}`}>
      <span className={`h-2 w-2 rounded-full ${cfg.dot} ${status === 'syncing' ? 'animate-pulse' : ''}`} />
      {label ?? cfg.label}
    </span>
  );
}
