import * as XLSX from 'xlsx';
import type { SalesRow, TargetRow } from './types';
import { normalizeBulanToMonthNum } from './types';

// The two source files live in /public/data. To publish new data, just replace
// these two files (keeping the exact same file names) in the GitHub repo and
// push — Vercel will redeploy automatically and the dashboard will pick up the
// new numbers on next load. No code changes required.
const OMSET_URL = '/data/DATA.xlsx';
const TARGET_URL = '/data/DATA_TARGET_FUAD.xlsx';

function toNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

async function fetchWorkbook(url: string): Promise<XLSX.WorkBook> {
  const res = await fetch(`${url}?v=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Gagal memuat data: ${url} (${res.status})`);
  const buf = await res.arrayBuffer();
  return XLSX.read(buf, { type: 'array', cellDates: true });
}

// Some exported spreadsheets keep the literal quote characters and stray
// whitespace from a CSV export in the header cells (e.g. `" DEPO "` instead of
// `DEPO`). This normalizes every row's keys so field lookups are resilient to
// that, whatever the exact header formatting turns out to be.
function normalizeKey(k: string): string {
  return k.replace(/^["'\s]+|["'\s]+$/g, '').trim().toUpperCase();
}

function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[normalizeKey(k)] = v;
  }
  return out;
}

export async function loadSalesData(): Promise<SalesRow[]> {
  const wb = await fetchWorkbook(OMSET_URL);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  return rawRows.map((raw): SalesRow => {
    const r = normalizeRow(raw);
    const bulanRaw = String(r['BULAN'] ?? '').trim();
    const monthNum = normalizeBulanToMonthNum(bulanRaw);
    const teleRaw = String(r['TELE'] ?? '').trim();
    return {
      nominal: toNumber(r['NOMINAL']),
      supp: String(r['SUPP'] ?? '').trim(),
      depo: String(r['DEPO'] ?? '').trim().toUpperCase(),
      bulan: bulanRaw,
      monthNum,
      tahun: r['TAHUN'] ? Number(r['TAHUN']) : 2026,
      kdGrup: String(r['KD GRUP'] ?? '').trim(),
      sales: String(r['SALES'] ?? '').trim(),
      kota: String(r['KOTA'] ?? '').trim().toUpperCase(),
      tele: teleRaw,
    };
  }).filter((r) => r.depo && r.sales);
}

export async function loadTargetData(): Promise<TargetRow[]> {
  const wb = await fetchWorkbook(TARGET_URL);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: 0 });
  const monthCols = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  return rawRows.map((raw): TargetRow => {
    const r = normalizeRow(raw);
    return {
      namaSalesman: String(r['NAMA SALESMAN'] ?? '').trim(),
      divisi: String(r['DIVISI'] ?? '').trim(),
      salesYgCover: String(r['SALES YG COVER'] ?? '').trim(),
      depo: String(r['DEPO'] ?? '').trim().toUpperCase(),
      supplier: String(r['SUPPLIER'] ?? '').trim(),
      monthly: monthCols.map((c) => toNumber(r[c])),
    };
  }).filter((r) => r.namaSalesman);
}
