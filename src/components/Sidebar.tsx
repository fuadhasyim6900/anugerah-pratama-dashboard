import { NavLink } from 'react-router-dom';
import { useFilterStore } from '../store/filters';
import { useSalesData } from '../hooks/useSalesData';
import { DEPO_LIST_EXCLUDING_ADMIN } from '../lib/aggregate';
import { MONTH_NAMES_FULL_ID } from '../lib/types';
import clsx from 'clsx';
import {
  LayoutDashboard, Users, TrendingUp, ClipboardList, Building2, CalendarDays, CalendarRange,
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
  if (years.length === 0) years.push(2026);

  return (
    <aside className="no-print w-72 shrink-0 h-screen sticky top-0 flex flex-col bg-white dark:bg-ink-900 border-r border-ink-100 dark:border-ink-800">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-ink-100 dark:border-ink-800">
        <img src="/Logo-AP_PNG.webp" alt="Logo CV Anugerah Pratama" className="h-10 w-10 object-contain" />
        <div>
          <div className="font-extrabold leading-tight text-sm tracking-tight">CV ANUGERAH PRATAMA</div>
          <div className="text-[11px] text-ink-400 font-medium">Sales &amp; AO Dashboard</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
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

        <label className="block">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1">
            <Building2 size={13} /> Depo
          </span>
          <select
            value={depo}
            onChange={(e) => setDepo(e.target.value)}
            className="w-full text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-ink-50 dark:bg-ink-800 px-3 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="ALL">Semua Depo</option>
            {depoList.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1">
            <CalendarDays size={13} /> Bulan
          </span>
          <select
            value={bulan}
            onChange={(e) => setBulan(Number(e.target.value))}
            className="w-full text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-ink-50 dark:bg-ink-800 px-3 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value={0}>Semua Bulan (YTD)</option>
            {MONTH_NAMES_FULL_ID.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1">
            <CalendarRange size={13} /> Tahun
          </span>
          <select
            value={tahun}
            onChange={(e) => setTahun(Number(e.target.value))}
            className="w-full text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-ink-50 dark:bg-ink-800 px-3 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
      </div>

      <div className="px-5 py-3 text-[11px] text-ink-400 border-t border-ink-100 dark:border-ink-800">
        © {new Date().getFullYear()} CV Anugerah Pratama
      </div>
    </aside>
  );
}
