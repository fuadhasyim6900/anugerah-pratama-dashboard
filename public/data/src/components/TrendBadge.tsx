import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

export default function TrendBadge({
  pct, label, previousValue,
}: {
  pct: number | null;
  label: string;
  /** Formatted value of the comparison period (e.g. "Rp 30.174.101.876"), shown under the badge so the % is traceable. */
  previousValue?: string;
}) {
  if (pct === null) {
    return <p className="text-[11px] text-ink-400 font-medium mt-1">{label}: data pembanding belum ada</p>;
  }
  const isUp = pct > 0.001;
  const isDown = pct < -0.001;
  const Icon = isUp ? ArrowUp : isDown ? ArrowDown : Minus;
  const colorClass = isUp
    ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20'
    : isDown
      ? 'text-brand-600 bg-brand-50 dark:bg-brand-900/20'
      : 'text-ink-500 bg-ink-100 dark:bg-ink-800';

  return (
    <div className="mt-1">
      <div className="flex items-center gap-1.5">
        <span className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[11px] font-bold ${colorClass}`}>
          <Icon size={11} />
          {Math.abs(pct).toFixed(1)}%
        </span>
        <span className="text-[11px] text-ink-400 font-medium">{label}</span>
      </div>
      {previousValue && (
        <p className="text-xs text-ink-500 dark:text-ink-400 font-semibold mt-1">
          {previousValue}
        </p>
      )}
    </div>
  );
}
