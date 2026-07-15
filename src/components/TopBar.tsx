import { useState } from 'react';
import { Sun, Moon, Printer, FileDown, RefreshCw, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useThemeStore } from '../store/theme';
import { useUIStore } from '../store/ui';
import { useSalesData } from '../hooks/useSalesData';
import { exportActivePageToPdf, exportFullReportToPdf } from '../lib/exportPdf';

export default function TopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  const { dark, toggle } = useThemeStore();
  const { reload, lastUpdated, loading } = useSalesData();
  const { sidebarCollapsed, toggleSidebarCollapsed, setMobileNavOpen } = useUIStore();
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
    <header className="no-print sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 dark:border-ink-800 bg-white/90 dark:bg-ink-900/90 backdrop-blur px-4 sm:px-6 py-3 sm:py-4">
      <div className="flex items-start gap-2 min-w-0">
        <button
          onClick={() => setMobileNavOpen(true)}
          title="Buka menu"
          className="md:hidden flex items-center justify-center h-9 w-9 shrink-0 rounded-lg border border-ink-200 dark:border-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800"
        >
          <Menu size={16} />
        </button>
        <button
          onClick={toggleSidebarCollapsed}
          title={sidebarCollapsed ? 'Tampilkan sidebar' : 'Sembunyikan sidebar'}
          className="hidden md:flex items-center justify-center h-9 w-9 shrink-0 rounded-lg border border-ink-200 dark:border-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800"
        >
          {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
        <div className="min-w-0">
          <h1 className="text-base sm:text-xl font-extrabold tracking-tight truncate">{title}</h1>
          {subtitle && <p className="text-xs text-ink-400 font-medium mt-0.5 truncate">{subtitle}</p>}
          {lastUpdated && (
            <p className="text-[11px] text-ink-400 mt-0.5">
              Data dimuat: {lastUpdated.toLocaleString('id-ID')}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => reload()}
          disabled={loading}
          title="Muat ulang data terbaru dari repository"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-ink-200 dark:border-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> <span className="hidden sm:inline">Refresh</span>
        </button>

        <button
          onClick={handleExportPage}
          disabled={exporting !== null}
          title="Cetak / unduh halaman aktif"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-ink-200 dark:border-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800 disabled:opacity-50"
        >
          <Printer size={14} /> <span className="hidden sm:inline">{exporting === 'page' ? 'Memproses...' : 'Ekspor Halaman Aktif'}</span>
        </button>

        <button
          onClick={handleExportFull}
          disabled={exporting !== null}
          title="Cetak / unduh laporan lengkap (semua halaman)"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-ink-200 dark:border-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800 disabled:opacity-50"
        >
          <FileDown size={14} /> <span className="hidden sm:inline">{exporting === 'full' ? 'Memproses...' : 'Ekspor Laporan Lengkap'}</span>
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
