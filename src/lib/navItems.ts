import type { LucideIcon } from 'lucide-react';
import { LayoutDashboard, Users, TrendingUp, ClipboardList } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  shortLabel: string; // compact label for the mobile bottom tab bar
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Executive Dashboard', shortLabel: 'Dashboard', icon: LayoutDashboard },
  { to: '/kinerja-dsr', label: 'Kinerja DSR', shortLabel: 'DSR', icon: Users },
  { to: '/proyeksi-s2', label: 'Proyeksi Semester', shortLabel: 'Proyeksi', icon: TrendingUp },
  { to: '/review-dsr', label: 'Review & Solusi DSR', shortLabel: 'Review', icon: ClipboardList },
];
