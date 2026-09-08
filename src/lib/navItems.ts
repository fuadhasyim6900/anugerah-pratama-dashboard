import type { LucideIcon } from 'lucide-react';
import { LayoutDashboard, Users, TrendingUp, ClipboardList, Wallet, CalendarClock } from 'lucide-react';

export interface NavSection {
  /** Matches the `id` attribute on that section's card in the page. */
  id: string;
  label: string;
}

export interface NavItem {
  to: string;
  label: string;
  shortLabel: string; // compact label for the mobile bottom tab bar
  icon: LucideIcon;
  /**
   * Chart/table sections within that page, shown as a collapsible list
   * under the sidebar link so people can jump straight to one and see
   * what's on the page at a glance. Deliberately excludes KPI cards and
   * filter/settings panels — only the actual chart/table content blocks.
   */
  sections?: NavSection[];
}

export const NAV_ITEMS: NavItem[] = [
  {
    to: '/', label: 'Executive Dashboard', shortLabel: 'Dashboard', icon: LayoutDashboard,
    sections: [
      { id: 'sec-omset-per-kota', label: 'Omset per Kota' },
      { id: 'sec-omset-per-depo', label: 'Omset per Depo' },
      { id: 'sec-target-vs-realisasi', label: 'Target vs Realisasi' },
      { id: 'sec-ao-persupplier', label: 'AO Persupplier' },
    ],
  },
  {
    to: '/kinerja-dsr', label: 'Kinerja DSR', shortLabel: 'DSR', icon: Users,
    sections: [
      { id: 'sec-peringkat-dsr', label: 'Peringkat Penjualan DSR' },
      { id: 'sec-ao-dsr', label: 'Outlet Aktif (AO) DSR' },
      { id: 'sec-ranking-dsr-supplier', label: 'Ranking DSR per Supplier' },
      { id: 'sec-perbandingan-dsr', label: 'Tabel Rincian Perbandingan Bulanan' },
      { id: 'sec-target-omset-supplier', label: 'Target vs Omset per Supplier' },
      { id: 'sec-distribusi-supplier-dsr', label: 'Distribusi Produk / Supplier DSR' },
    ],
  },
  {
    to: '/omset-harian', label: 'Omset Harian', shortLabel: 'Harian', icon: CalendarClock,
    sections: [
      { id: 'sec-omset-harian', label: 'Grafik Omset Harian' },
      { id: 'sec-barang-terlaris', label: 'Barang Paling Banyak Diambil' },
      { id: 'sec-rincian-perbandingan-harian', label: 'Rincian Perbandingan Harian' },
      { id: 'sec-riwayat-pengambilan', label: 'Riwayat Pengambilan Barang' },
    ],
  },
  {
    to: '/proyeksi-s2', label: 'Proyeksi Semester', shortLabel: 'Proyeksi', icon: TrendingUp,
    sections: [
      { id: 'sec-tren-proyeksi', label: 'Grafik Tren Penjualan' },
      { id: 'sec-rincian-proyeksi', label: 'Rincian Bulanan Proyeksi' },
    ],
  },
  { to: '/review-dsr', label: 'Review & Solusi DSR', shortLabel: 'Review', icon: ClipboardList },
  {
    to: '/realisasi-uang-masuk', label: 'Realisasi Uang Masuk', shortLabel: 'Uang Masuk', icon: Wallet,
    sections: [
      { id: 'sec-tren-uang-masuk', label: 'Tren Target vs Realisasi' },
      { id: 'sec-uang-masuk-per-depo', label: 'Realisasi Piutang per Depo' },
      { id: 'sec-tabel-uang-masuk-per-depo', label: 'Tabel Rincian per Depo' },
    ],
  },
];

