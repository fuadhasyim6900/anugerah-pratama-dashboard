import { useState, useRef, useEffect, type ReactNode } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import clsx from 'clsx';

export interface MultiSelectOption {
  value: string;
  label: string;
}

export default function MultiSelect({
  label, icon, options, selected, onChange, allLabel = 'Semua',
}: {
  label?: string;
  icon?: ReactNode;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  allLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function toggle(value: string) {
    if (selected.includes(value)) onChange(selected.filter((v) => v !== value));
    else onChange([...selected, value]);
  }

  const displayText = selected.length === 0
    ? allLabel
    : selected.length === 1
      ? (options.find((o) => o.value === selected[0])?.label || selected[0])
      : `${selected.length} dipilih`;

  return (
    <div className="relative" ref={ref}>
      {label && (
        <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1">
          {icon} {label}
        </span>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-ink-50 dark:bg-ink-800 px-3 py-2.5 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        <span className="truncate text-left leading-6">{displayText}</span>
        <ChevronDown size={14} className={clsx('shrink-0 transition-transform text-ink-400', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[180px] max-h-[45vh] sm:max-h-64 overflow-y-auto overscroll-contain rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 shadow-card p-1">
          <button
            type="button"
            onClick={() => onChange([])}
            className={clsx(
              'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm font-semibold text-left',
              selected.length === 0 ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400' : 'hover:bg-ink-50 dark:hover:bg-ink-800'
            )}
          >
            <span className={clsx(
              'h-4 w-4 rounded border flex items-center justify-center shrink-0',
              selected.length === 0 ? 'bg-brand-600 border-brand-600' : 'border-ink-300 dark:border-ink-600'
            )}>
              {selected.length === 0 && <Check size={11} className="text-white" />}
            </span>
            {allLabel}
          </button>
          <div className="my-1 border-t border-ink-100 dark:border-ink-800" />
          {options.map((o) => {
            const checked = selected.includes(o.value);
            return (
              <button
                type="button"
                key={o.value}
                onClick={() => toggle(o.value)}
                className={clsx(
                  'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm font-medium text-left',
                  checked ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400' : 'hover:bg-ink-50 dark:hover:bg-ink-800'
                )}
              >
                <span className={clsx(
                  'h-4 w-4 rounded border flex items-center justify-center shrink-0',
                  checked ? 'bg-brand-600 border-brand-600' : 'border-ink-300 dark:border-ink-600'
                )}>
                  {checked && <Check size={11} className="text-white" />}
                </span>
                <span className="truncate">{o.label}</span>
              </button>
            );
          })}
          {options.length === 0 && (
            <p className="text-xs text-ink-400 text-center py-3">Tidak ada opsi</p>
          )}
        </div>
      )}
    </div>
  );
}
