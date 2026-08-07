type Status = 'draft' | 'active' | 'pending' | 'claiming' | 'claimed' | 'expired' | 'ready' | 'completed';

const STATUS_CLASSES: Record<Status, string> = {
  draft: 'bg-white/10 text-white/50',
  active: 'bg-white/15 text-white',
  pending: 'bg-amber-500/20 text-amber-200',
  claiming: 'bg-blue-500/20 text-blue-200',
  claimed: 'bg-green-500/20 text-green-300',
  expired: 'bg-red-500/20 text-red-300',
  ready: 'bg-green-500/20 text-green-200',
  completed: 'bg-green-500/20 text-green-300',
};

interface StatusBadgeProps {
  status: string | null | undefined;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const normalized = (status || 'pending').toLowerCase() as Status;
  const classes = STATUS_CLASSES[normalized] ?? STATUS_CLASSES.pending;
  const label = normalized.charAt(0).toUpperCase() + normalized.slice(1);

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${classes} ${className}`}>
      {label}
    </span>
  );
}
