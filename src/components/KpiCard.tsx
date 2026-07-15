import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

export default function KpiCard({
  label, value, icon: Icon, sub, accent = 'brand', footer,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  sub?: ReactNode;
  accent?: 'brand' | 'ink';
  footer?: ReactNode;
}) {
  return (
    <div className="card p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wide">{label}</span>
        {Icon && (
          <span className={clsx(
            'h-8 w-8 rounded-lg flex items-center justify-center',
            accent === 'brand' ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400' : 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300'
          )}>
            <Icon size={16} />
          </span>
        )}
      </div>
      <div className="text-lg sm:text-xl xl:text-2xl font-extrabold tracking-tight leading-snug [overflow-wrap:normal] whitespace-normal">{value}</div>
      {sub && <div className="text-xs text-ink-400 font-medium">{sub}</div>}
      {footer}
    </div>
  );
}
