import type { SalesRow, TargetRow } from './types';
import { MONTH_NAMES_ID } from './types';

export interface Filters {
  depo: string[];  // empty = semua depo
  bulan: number[]; // empty = semua bulan (1-12 each)
  tahun: number[]; // empty = semua tahun
}

export const DEPO_LIST_EXCLUDING_ADMIN = (rows: SalesRow[]): string[] => {
  const set = new Set(rows.map((r) => r.depo).filter((d) => d && d !== 'ADMIN'));
  return Array.from(set).sort();
};

export function applyFilters(rows: SalesRow[], f: Filters): SalesRow[] {
  return rows.filter((r) => {
    if (f.tahun.length && !f.tahun.includes(r.tahun)) return false;
    if (f.depo.length && !f.depo.includes(r.depo)) return false;
    if (f.bulan.length && !f.bulan.includes(r.monthNum)) return false;
    return true;
  });
}

// Human-readable summaries of the current multi-select filters, used in page
// subtitles so it reads well whether 0, 1, or several values are picked.
export function depoLabel(depo: string[]): string {
  if (depo.length === 0) return 'Semua Depo';
  if (depo.length === 1) return depo[0];
  return `${depo.length} Depo Dipilih`;
}

export function bulanLabel(bulan: number[]): string {
  if (bulan.length === 0) return 'Semua Bulan (YTD)';
  const sorted = [...bulan].sort((a, b) => a - b);
  return sorted.map((m) => MONTH_NAMES_ID[m - 1]).join(', ');
}

export function tahunLabel(tahun: number[]): string {
  if (tahun.length === 0) return 'Semua Tahun';
  return [...tahun].sort((a, b) => a - b).join(', ');
}

// A single reference year for pages that need "the current year" (e.g.
// projections comparing against year-1 / year-2) even though the year
// filter itself now supports picking several years at once. Uses the most
// recent selected year, or the most recent year in the data if none picked.
export function primaryYear(tahun: number[], availableYears: number[]): number {
  if (tahun.length) return Math.max(...tahun);
  if (availableYears.length) return Math.max(...availableYears);
  return new Date().getFullYear();
}

export function sumNominal(rows: SalesRow[]): number {
  return rows.reduce((acc, r) => acc + r.nominal, 0);
}

export function distinctCount(rows: SalesRow[], key: keyof SalesRow): number {
  return new Set(rows.map((r) => r[key])).size;
}

// Sum target nominal for the given depo/tahun, restricted to a specific set of
// months (1-12). Pass the months that are actually present in the comparable
// actual data so target and realisasi always cover the same period. Targets
// are year-specific (each row belongs to a single TAHUN), so a tahun filter is
// applied the same way depo is.
export function sumTarget(targets: TargetRow[], depo: string[], monthNums: number[], tahun: number[] = []): number {
  const idxs = monthNums.map((m) => m - 1).filter((i) => i >= 0 && i <= 11);
  return targets
    .filter((t) => (depo.length === 0 || depo.includes(t.depo)) && (tahun.length === 0 || tahun.includes(t.tahun)))
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

export interface SupplierAORow {
  supplier: string;
  omset: number;
  ao: number;
}

// Groups rows by SUPP. AO per supplier is a distinct count of KD GRUP within
// that supplier's rows only (i.e. the unique key is effectively
// "SUPP_&_KD GRUP"), so a customer buying from several suppliers counts as
// one AO under each supplier separately.
export function aoPerSupplier(rows: SalesRow[]): { rows: SupplierAORow[]; grandTotal: SupplierAORow } {
  const map = new Map<string, { omset: number; ao: Set<string> }>();
  for (const r of rows) {
    const key = r.supp || '(Kosong)';
    if (!map.has(key)) map.set(key, { omset: 0, ao: new Set() });
    const entry = map.get(key)!;
    entry.omset += r.nominal;
    entry.ao.add(r.kdGrup);
  }
  const rowsOut = Array.from(map.entries())
    .map(([supplier, v]) => ({ supplier, omset: v.omset, ao: v.ao.size }))
    .sort((a, b) => b.omset - a.omset);
  const grandOmset = rowsOut.reduce((a, r) => a + r.omset, 0);
  const grandAO = rowsOut.reduce((a, r) => a + r.ao, 0);
  return {
    rows: rowsOut,
    grandTotal: { supplier: 'Grand Total', omset: grandOmset, ao: grandAO },
  };
}

// Sum target nominal for one specific DSR (matched by TargetRow.namaSalesman),
// across all suppliers, restricted to the given depo/bulan/tahun scope. Used
// to show "Target" alongside a DSR's actual omset in their breakdown card.
export function targetForDSR(
  targets: TargetRow[],
  opts: { dsr: string; depo: string[]; bulan: number[]; tahun: number[] }
): number {
  const monthIdxs = (opts.bulan.length ? opts.bulan : Array.from({ length: 12 }, (_, i) => i + 1))
    .map((m) => m - 1)
    .filter((i) => i >= 0 && i <= 11);
  const dsrKey = opts.dsr.trim().toUpperCase();
  return targets
    .filter((t) => t.namaSalesman.trim().toUpperCase() === dsrKey
      && (opts.depo.length === 0 || opts.depo.includes(t.depo))
      && (opts.tahun.length === 0 || opts.tahun.includes(t.tahun)))
    .reduce((acc, t) => acc + monthIdxs.reduce((s, mi) => s + (t.monthly[mi] || 0), 0), 0);
}

export function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

export interface SupplierTargetRow {
  supplier: string;
  target: number;
  omset: number;
  kekurangan: number;          // target - omset (positive = shortfall, negative = exceeded target)
  kekuranganPct: number | null; // kekurangan as % of target, null when target is 0
  ao: number;                   // distinct AO (KD GRUP) count for this supplier
}

// Per-supplier comparison of target (from DATA_TARGET_FUAD, matched by DSR
// name/depo/tahun) vs actual omset (from the sales rows), for one or more
// selected DSR. Empty `dsr` means "semua DSR". Depo/Bulan/Tahun mirror the
// global sidebar filters so both sides of the comparison stay in sync.
export function targetVsOmsetBySupplier(
  sales: SalesRow[],
  targets: TargetRow[],
  opts: { depo: string[]; bulan: number[]; tahun: number[]; dsr: string[]; supp?: string[] }
): { rows: SupplierTargetRow[]; grandTotal: SupplierTargetRow } {
  const monthIdxs = (opts.bulan.length ? opts.bulan : Array.from({ length: 12 }, (_, i) => i + 1))
    .map((m) => m - 1)
    .filter((i) => i >= 0 && i <= 11);
  const dsrSet = new Set(opts.dsr.map((d) => d.trim().toUpperCase()));
  const suppSet = new Set((opts.supp || []).map((s) => s.trim().toUpperCase()));

  const filteredTargets = targets.filter((t) => {
    if (opts.depo.length && !opts.depo.includes(t.depo)) return false;
    if (opts.tahun.length && !opts.tahun.includes(t.tahun)) return false;
    if (dsrSet.size && !dsrSet.has(t.namaSalesman.trim().toUpperCase())) return false;
    if (suppSet.size && !suppSet.has(t.supplier.trim().toUpperCase())) return false;
    return true;
  });

  const filteredSales = sales.filter((r) => {
    if (opts.depo.length && !opts.depo.includes(r.depo)) return false;
    if (opts.bulan.length && !opts.bulan.includes(r.monthNum)) return false;
    if (opts.tahun.length && !opts.tahun.includes(r.tahun)) return false;
    if (dsrSet.size && !dsrSet.has(r.sales.trim().toUpperCase())) return false;
    if (suppSet.size && !suppSet.has(r.supp.trim().toUpperCase())) return false;
    return true;
  });

  const map = new Map<string, { target: number; omset: number; ao: Set<string> }>();

  for (const t of filteredTargets) {
    const key = t.supplier.trim().toUpperCase() || '(Kosong)';
    const sum = monthIdxs.reduce((s, mi) => s + (t.monthly[mi] || 0), 0);
    const entry = map.get(key) || { target: 0, omset: 0, ao: new Set<string>() };
    entry.target += sum;
    map.set(key, entry);
  }

  for (const r of filteredSales) {
    const key = r.supp.trim().toUpperCase() || '(Kosong)';
    const entry = map.get(key) || { target: 0, omset: 0, ao: new Set<string>() };
    entry.omset += r.nominal;
    entry.ao.add(r.kdGrup);
    map.set(key, entry);
  }

  const rows: SupplierTargetRow[] = Array.from(map.entries())
    .map(([supplier, v]) => {
      const kekurangan = v.target - v.omset;
      return {
        supplier,
        target: v.target,
        omset: v.omset,
        kekurangan,
        kekuranganPct: v.target ? (kekurangan / v.target) * 100 : null,
        ao: v.ao.size,
      };
    })
    .sort((a, b) => b.target - a.target);

  const grandTarget = rows.reduce((a, r) => a + r.target, 0);
  const grandOmset = rows.reduce((a, r) => a + r.omset, 0);
  const grandKekurangan = grandTarget - grandOmset;
  const grandAO = rows.reduce((a, r) => a + r.ao, 0);

  return {
    rows,
    grandTotal: {
      supplier: 'Grand Total',
      target: grandTarget,
      omset: grandOmset,
      kekurangan: grandKekurangan,
      kekuranganPct: grandTarget ? (grandKekurangan / grandTarget) * 100 : null,
      ao: grandAO,
    },
  };
}
