import { useState } from 'react';
import { Sun, Moon, Printer, FileDown, RefreshCw } from 'lucide-react';
import { useThemeStore } from '../store/theme';
import { useSalesData } from '../hooks/useSalesData';
import { exportActivePageToPdf, exportFullReportToPdf } from '../lib/exportPdf';

export default function TopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  const { dark, toggle } = useThemeStore();
  const { reload, lastUpdated, loading } = useSalesData();
  const [exporting, setExporting] = useState<'page' | 'full' | null>(null);

  async function handleExportPage() {
    setExporting('page');
    try { await exportActivePageToPdf(title); } finally { setExporting(null); }
  }

  async function handleExportFull() {
    setExporting('full');
    try { await exportFullReportToPdf(); } finally { setExporting(null); }
  }

  return (
    <header className="no-print sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 dark:border-ink-800 bg-white/90 dark:bg-ink-900/90 backdrop-blur px-6 py-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-ink-400 font-medium mt-0.5">{subtitle}</p>}
        {lastUpdated && (
          <p className="text-[11px] text-ink-400 mt-0.5">
            Data dimuat: {lastUpdated.toLocaleString('id-ID')}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => reload()}
          disabled={loading}
          title="Muat ulang data terbaru dari repository"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-ink-200 dark:border-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>

        <button
          onClick={handleExportPage}
          disabled={exporting !== null}
          title="Cetak / unduh halaman aktif"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-ink-200 dark:border-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800 disabled:opacity-50"
        >
          <Printer size={14} /> {exporting === 'page' ? 'Memproses...' : 'Ekspor Halaman Aktif'}
        </button>

        <button
          onClick={handleExportFull}
          disabled={exporting !== null}
          title="Cetak / unduh laporan lengkap (semua halaman)"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-ink-200 dark:border-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800 disabled:opacity-50"
        >
          <FileDown size={14} /> {exporting === 'full' ? 'Memproses...' : 'Ekspor Laporan Lengkap'}
        </button>

        <button
          onClick={toggle}
          title="Ganti tema gelap / terang"
          className="flex items-center justify-center h-9 w-9 rounded-lg border border-ink-200 dark:border-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800"
        >
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
}
