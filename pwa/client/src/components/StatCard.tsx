import { cn, formatDuration } from '../lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  color?: string;
  className?: string;
}

export default function StatCard({ label, value, subtitle, icon, color, className }: StatCardProps) {
  return (
    <div className={cn('card p-4 md:p-5', className)}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-medium text-muted uppercase tracking-wide">{label}</p>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <p className={cn('stat-value', color)}>{value}</p>
      {subtitle && <p className="text-xs text-muted mt-1">{subtitle}</p>}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="card p-5 animate-pulse">
      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-20 mb-3" />
      <div className="h-7 bg-slate-200 dark:bg-slate-700 rounded w-16 mb-2" />
      <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-24" />
    </div>
  );
}

export function HoursStat({ minutes, label }: { minutes: number; label: string }) {
  return <StatCard label={label} value={formatDuration(minutes)} />;
}
