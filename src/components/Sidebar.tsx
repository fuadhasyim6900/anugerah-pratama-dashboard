import { NavLink } from 'react-router-dom';
import { useEffect } from 'react';
import { useFilterStore } from '../store/filters';
import { useUIStore } from '../store/ui';
import { useSalesData } from '../hooks/useSalesData';
import { DEPO_LIST_EXCLUDING_ADMIN } from '../lib/aggregate';
import { MONTH_NAMES_FULL_ID } from '../lib/types';
import MultiSelect from './MultiSelect';
import clsx from 'clsx';
import {
  LayoutDashboard, Users, TrendingUp, ClipboardList, Building2, CalendarDays, CalendarRange, X,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', label: 'Executive Dashboard', icon: LayoutDashboard },
  { to: '/kinerja-dsr', label: 'Kinerja DSR', icon: Users },
  { to: '/proyeksi-s2', label: 'Proyeksi Semester', icon: TrendingUp },
  { to: '/review-dsr', label: 'Review & Solusi DSR', icon: ClipboardList },
];

export default function Sidebar() {
  const { depo, bulan, tahun, setDepo, setBulan, setTahun } = useFilterStore();
  const { sales } = useSalesData();
  const depoList = DEPO_LIST_EXCLUDING_ADMIN(sales);
  const years = Array.from(new Set(sales.map((r) => r.tahun))).sort();

  // Default to the latest available year the first time data loads, so the
  // dashboard opens on a sensible period instead of "semua tahun".
  useEffect(() => {
    if (years.length && tahun.length === 0) {
      setTahun([years[years.length - 1]]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [years.join(',')]);

  const { sidebarCollapsed, mobileNavOpen, setMobileNavOpen } = useUIStore();

  return (
    <>
      {/* Mobile backdrop */}
      {mobileNavOpen && (
        <div
          className="no-print fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <aside
        className={clsx(
          'no-print w-72 shrink-0 flex flex-col bg-white dark:bg-ink-900 border-r border-ink-100 dark:border-ink-800',
          'fixed inset-y-0 left-0 z-50 h-full transition-transform duration-200 ease-out',
          'overflow-y-auto overscroll-contain',
          'md:sticky md:top-0 md:h-screen md:z-30 md:transition-[margin,transform] md:duration-200',
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full',
          'md:translate-x-0',
          sidebarCollapsed && 'md:-ml-72 md:pointer-events-none md:opacity-0',
        )}
      >
        <div className="flex items-center gap-3 px-5 py-5 border-b border-ink-100 dark:border-ink-800 sticky top-0 z-10 bg-white dark:bg-ink-900">
          <img src="/Logo-AP_PNG.webp" alt="Logo CV Anugerah Pratama" className="h-10 w-10 object-contain shrink-0" />
          <div className="min-w-0">
            <div className="font-extrabold leading-tight text-sm tracking-tight">CV ANUGERAH PRATAMA</div>
            <div className="text-[11px] text-ink-400 font-medium">Sales &amp; AO Dashboard</div>
          </div>
          <button
            onClick={() => setMobileNavOpen(false)}
            className="ml-auto md:hidden flex items-center justify-center h-8 w-8 rounded-lg text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800 shrink-0"
            aria-label="Tutup menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="shrink-0 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setMobileNavOpen(false)}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors',
                isActive
                  ? 'bg-brand-600 text-white shadow-card'
                  : 'text-ink-600 dark:text-ink-300 hover:bg-brand-50 dark:hover:bg-ink-800 hover:text-brand-700 dark:hover:text-brand-400'
              )}
            >
              <Icon size={18} strokeWidth={2.2} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-ink-100 dark:border-ink-800 space-y-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400">Filter Data</p>

          <MultiSelect
            label="Depo"
            icon={<Building2 size={13} />}
            options={depoList.map((d) => ({ value: d, label: d }))}
            selected={depo}
            onChange={setDepo}
            allLabel="Semua Depo"
          />

          <MultiSelect
            label="Bulan"
            icon={<CalendarDays size={13} />}
            options={MONTH_NAMES_FULL_ID.map((m, i) => ({ value: String(i + 1), label: m }))}
            selected={bulan.map(String)}
            onChange={(v) => setBulan(v.map(Number))}
            allLabel="Semua Bulan (YTD)"
          />

          <MultiSelect
            label="Tahun"
            icon={<CalendarRange size={13} />}
            options={years.map((y) => ({ value: String(y), label: String(y) }))}
            selected={tahun.map(String)}
            onChange={(v) => setTahun(v.map(Number))}
            allLabel="Semua Tahun"
          />
        </div>

        <div className="px-5 py-3 text-[11px] text-ink-400 border-t border-ink-100 dark:border-ink-800 mt-auto">
          © {new Date().getFullYear()} CV Anugerah Pratama
        </div>
      </aside>
    </>
  );
}
