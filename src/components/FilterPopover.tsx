import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, UserRound, PackageSearch, CalendarDays, CalendarRange, SlidersHorizontal, X } from 'lucide-react';
import clsx from 'clsx';
import { useFilterStore } from '../store/filters';
import { useSalesData } from '../hooks/useSalesData';
import { DEPO_LIST_EXCLUDING_ADMIN, SUPP_LIST, activeDsrList } from '../lib/aggregate';
import { MONTH_NAMES_FULL_ID } from '../lib/types';
import MultiSelect from './MultiSelect';

// Filter Depo/Sales DSR/SUPP/Bulan/Tahun global, sebelumnya berupa panel
// tetap di Sidebar, sekarang dipindah ke sebuah dropdown popup di TopBar
// (tombol "Filter") supaya sidebar hanya berisi navigasi. Perilaku filter
// itu sendiri (menyaring seluruh halaman lewat useFilterStore) tidak
// berubah.
export default function FilterPopover() {
  const { depo, dsr, supp, bulan, tahun, setDepo, setDsr, setSupp, setBulan, setTahun, reset } = useFilterStore();
  const { sales } = useSalesData();
  const depoList = DEPO_LIST_EXCLUDING_ADMIN(sales);
  const dsrList = useMemo(
    () => activeDsrList(sales, depo, bulan, tahun),
    [sales, depo, bulan, tahun]
  );
  const suppList = SUPP_LIST(sales);
  const years = Array.from(new Set(sales.map((r) => r.tahun))).sort();

  // Drop any selected DSR that's no longer active for the current Depo /
  // Bulan (or latest-month fallback) / Tahun scope, so switching e.g. Depo
  // doesn't silently keep filtering by a DSR that isn't in that depo.
  useEffect(() => {
    const stillValid = dsr.filter((d) => dsrList.includes(d));
    if (stillValid.length !== dsr.length) setDsr(stillValid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dsrList]);

  // Default to the current running month & year the first time data loads
  // (e.g. Juli 2026), so the dashboard opens already filtered to "today".
  // Falls back to just the latest available year (all months) if the
  // current month isn't in the data yet.
  useEffect(() => {
    if (years.length && tahun.length === 0 && bulan.length === 0) {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      const hasCurrentPeriod = sales.some(
        (r) => r.tahun === currentYear && r.monthNum === currentMonth
      );
      if (hasCurrentPeriod) {
        setTahun([currentYear]);
        setBulan([currentMonth]);
      } else {
        setTahun([years[years.length - 1]]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [years.join(','), sales.length]);

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const activeCount = depo.length + dsr.length + supp.length + bulan.length + tahun.length;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Filter Data"
        className={clsx(
          'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border',
          activeCount > 0
            ? 'border-brand-300 dark:border-brand-700 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400'
            : 'border-ink-200 dark:border-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800'
        )}
      >
        <SlidersHorizontal size={14} />
        <span className="hidden sm:inline">Filter</span>
        {activeCount > 0 && (
          <span className="flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-brand-600 text-white text-[10px] font-bold">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(90vw,340px)] max-h-[80vh] overflow-y-auto overscroll-contain rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 shadow-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400">Filter Data</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center h-6 w-6 rounded-md text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800"
              aria-label="Tutup filter"
            >
              <X size={14} />
            </button>
          </div>

          <MultiSelect
            label="Depo"
            icon={<Building2 size={13} />}
            options={depoList.map((d) => ({ value: d, label: d }))}
            selected={depo}
            onChange={setDepo}
            allLabel="Semua Depo"
          />

          <div>
            <MultiSelect
              label="Sales DSR"
              icon={<UserRound size={13} />}
              options={dsrList.map((d) => ({ value: d, label: d }))}
              selected={dsr}
              onChange={setDsr}
              allLabel="Semua DSR"
            />
            <p className="text-[10px] text-ink-400 mt-1 leading-snug">
              Hanya menampilkan DSR aktif di {bulan.length ? 'bulan yang dipilih' : 'bulan terbaru'}{depo.length ? ` · ${depo.length === 1 ? depo[0] : `${depo.length} Depo`}` : ''}
            </p>
          </div>

          <MultiSelect
            label="SUPP"
            icon={<PackageSearch size={13} />}
            options={suppList.map((s) => ({ value: s, label: s }))}
            selected={supp}
            onChange={setSupp}
            allLabel="Semua Supplier"
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

          {activeCount > 0 && (
            <button
              type="button"
              onClick={reset}
              className="w-full text-center px-3 py-2 rounded-lg text-xs font-semibold border border-ink-200 dark:border-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800"
            >
              Reset Semua Filter
            </button>
          )}
        </div>
      )}
    </div>
  );
}
