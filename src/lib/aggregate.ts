import type { SalesRow, TargetRow } from './types';
import { MONTH_NAMES_ID } from './types';

export interface Filters {
  depo: string; // 'ALL' or depo name
  bulan: number; // 0 = all months, 1-12 specific
  tahun: number; // year
}

export const DEPO_LIST_EXCLUDING_ADMIN = (rows: SalesRow[]): string[] => {
  const set = new Set(rows.map((r) => r.depo).filter((d) => d && d !== 'ADMIN'));
  return Array.from(set).sort();
};

export function applyFilters(rows: SalesRow[], f: Filters): SalesRow[] {
  return rows.filter((r) => {
    if (f.tahun && r.tahun !== f.tahun) return false;
    if (f.depo !== 'ALL' && r.depo !== f.depo) return false;
    if (f.bulan !== 0 && r.monthNum !== f.bulan) return false;
    return true;
  });
}

export function sumNominal(rows: SalesRow[]): number {
  return rows.reduce((acc, r) => acc + r.nominal, 0);
}

export function distinctCount(rows: SalesRow[], key: keyof SalesRow): number {
  return new Set(rows.map((r) => r[key])).size;
}

// Sum target nominal for the given depo, restricted to a specific set of months
// (1-12). Pass the months that are actually present in the comparable actual
// data so target and realisasi always cover the same period.
export function sumTarget(targets: TargetRow[], depo: string, monthNums: number[]): number {
  const idxs = monthNums.map((m) => m - 1).filter((i) => i >= 0 && i <= 11);
  return targets
    .filter((t) => depo === 'ALL' || t.depo === depo)
    .reduce((acc, t) => acc + idxs.reduce((s, mi) => s + (t.monthly[mi] || 0), 0), 0);
}

export function distinctMonthsPresent(rows: SalesRow[]): number[] {
  return Array.from(new Set(rows.map((r) => r.monthNum))).filter((m) => m >= 1 && m <= 12).sort((a, b) => a - b);
}

export function groupSumBy(rows: SalesRow[], key: keyof SalesRow): { label: string; value: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = String(r[key] || '(Kosong)');
    map.set(k, (map.get(k) || 0) + r.nominal);
  }
  return Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

export function trendByMonth(rows: SalesRow[]): { bulan: string; nominal: number }[] {
  const map = new Map<number, number>();
  for (const r of rows) {
    map.set(r.monthNum, (map.get(r.monthNum) || 0) + r.nominal);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([m, v]) => ({ bulan: MONTH_NAMES_ID[m - 1] || String(m), nominal: v }));
}

export function aoByMonth(rows: SalesRow[]): { bulan: string; ao: number }[] {
  const monthGroups = new Map<number, Set<string>>();
  for (const r of rows) {
    if (!monthGroups.has(r.monthNum)) monthGroups.set(r.monthNum, new Set());
    monthGroups.get(r.monthNum)!.add(r.kdGrup);
  }
  return Array.from(monthGroups.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([m, set]) => ({ bulan: MONTH_NAMES_ID[m - 1] || String(m), ao: set.size }));
}

export function formatRupiah(value: number, forceInteger = false): string {
  const rounded = forceInteger || !Number.isInteger(value) ? Math.round(value) : value;
  return 'Rp ' + rounded.toLocaleString('id-ID', { maximumFractionDigits: 0 });
}

export function formatNumber(value: number): string {
  return value.toLocaleString('id-ID', { maximumFractionDigits: 0 });
}

// Compact label for chart bars: hundreds of millions -> "688.9 Juta", billions -> "1.2 M".
// Tooltips should keep using formatRupiah (full nominal) instead of this.
export function formatCompactRupiah(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} M`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} Juta`;
  if (abs >= 1_000) return `${(value / 1_000).toLocaleString('id-ID', { maximumFractionDigits: 0 })} Rb`;
  return formatNumber(value);
}

// Average that only shows decimals when the division isn't a whole number,
// per the brief: "apabila pembagiannya tidak bulat maka dibulatkan saja".
export function safeAverage(total: number, count: number): number {
  if (!count) return 0;
  return Math.round(total / count);
}

export function distinctDSR(rows: SalesRow[]): string[] {
  return Array.from(new Set(rows.map((r) => r.sales).filter((s) => s && s !== 'ADMIN'))).sort();
}

export function salesByDSR(rows: SalesRow[]): { dsr: string; nominal: number }[] {
  return groupSumBy(rows.filter((r) => r.sales && r.sales !== 'ADMIN'), 'sales')
    .map((g) => ({ dsr: g.label, nominal: g.value }));
}

export function avgMonthlyAOByDSR(rows: SalesRow[]): { dsr: string; avgAo: number }[] {
  const dsrs = distinctDSR(rows);
  return dsrs.map((dsr) => {
    const dsrRows = rows.filter((r) => r.sales === dsr);
    const byMonth = new Map<number, Set<string>>();
    for (const r of dsrRows) {
      if (!byMonth.has(r.monthNum)) byMonth.set(r.monthNum, new Set());
      byMonth.get(r.monthNum)!.add(r.kdGrup);
    }
    const counts = Array.from(byMonth.values()).map((s) => s.size);
    const avg = counts.length ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;
    return { dsr, avgAo: Math.round(avg) };
  }).sort((a, b) => b.avgAo - a.avgAo);
}

// A row counts as a telemarketing-sourced sale when TELE literally says "Telemarketing".
export function telemarketingContribution(rows: SalesRow[]): number {
  return rows.filter((r) => r.tele === 'Telemarketing').reduce((acc, r) => acc + r.nominal, 0);
}

export function supplierBreakdownForDSR(rows: SalesRow[], dsr: string) {
  const dsrRows = rows.filter((r) => r.sales === dsr);
  const total = sumNominal(dsrRows);
  const bySupplier = groupSumBy(dsrRows, 'supp');
  const aoBySupplier = new Map<string, Set<string>>();
  for (const r of dsrRows) {
    if (!aoBySupplier.has(r.supp)) aoBySupplier.set(r.supp, new Set());
    aoBySupplier.get(r.supp)!.add(r.kdGrup);
  }
  const monthsPresent = new Set(dsrRows.map((r) => r.monthNum)).size || 1;
  return bySupplier.map((g) => ({
    supplier: g.label,
    nominal: g.value,
    porsi: total ? (g.value / total) * 100 : 0,
    avgAo: Math.round((aoBySupplier.get(g.label)?.size || 0) / monthsPresent),
  }));
}

// --- Period-over-period comparison for KPI trend badges -------------------

export interface PeriodComparison {
  type: 'year' | 'month';
  label: string; // e.g. "vs Tahun 2025" or "vs Bulan Jun 2026"
  currentValue: number;
  previousValue: number;
  pctChange: number | null; // null when previous period has no data to compare against
}

/**
 * Builds the comparable "previous period" rows for a KPI trend badge.
 * - If no specific month is selected (YTD view), compares against the SAME
 *   set of months in the previous year, so a partial current year is compared fairly.
 * - If a specific month is selected, compares against the previous month
 *   (wrapping to December of the previous year when January is selected).
 */
export function getComparisonRows(allRows: SalesRow[], currentFiltered: SalesRow[], f: Filters) {
  if (f.bulan === 0) {
    const monthsPresent = distinctMonthsPresent(currentFiltered);
    const prevYear = f.tahun - 1;
    const prevRows = applyFilters(allRows, { depo: f.depo, bulan: 0, tahun: prevYear })
      .filter((r) => monthsPresent.includes(r.monthNum));
    return { rows: prevRows, label: `vs Tahun ${prevYear} (periode sama)` };
  }
  const prevMonth = f.bulan === 1 ? 12 : f.bulan - 1;
  const prevYear = f.bulan === 1 ? f.tahun - 1 : f.tahun;
  const prevRows = applyFilters(allRows, { depo: f.depo, bulan: prevMonth, tahun: prevYear });
  return { rows: prevRows, label: `vs ${MONTH_NAMES_ID[prevMonth - 1]} ${prevYear}` };
}

export function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}
