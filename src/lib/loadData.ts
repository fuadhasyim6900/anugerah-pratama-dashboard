import { supabase } from './supabaseClient';
import type { SalesRow, TargetRow } from './types';
import { normalizeBulanToMonthNum } from './types';

const PAGE_SIZE = 1000;

async function fetchAllRows<T>(table: string, columns: string): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  for (;;) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase.from(table).select(columns).range(from, to);

    if (error) throw new Error(`Gagal memuat data dari tabel "${table}": ${error.message}`);
    if (!data || data.length === 0) break;

    rows.push(...(data as unknown as T[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

interface SalesDbRow {
  nominal: number;
  supp: string;
  depo: string;
  bulan: string;
  tahun: number;
  kd_grup: string;
  sales: string;
  kota: string;
  tele: string;
}

interface TargetDbRow {
  nama_salesman: string;
  depo: string;
  supplier: string;
  tahun: number;
  monthly: number[];
}

export async function loadSalesData(): Promise<SalesRow[]> {
  const rows = await fetchAllRows<SalesDbRow>(
    'sales',
    'nominal, supp, depo, bulan, tahun, kd_grup, sales, kota, tele'
  );

  return rows
    .map((r): SalesRow => {
      const bulanRaw = String(r.bulan ?? '').trim();
      return {
        nominal: Number(r.nominal) || 0,
        supp: String(r.supp ?? '').trim(),
        depo: String(r.depo ?? '').trim().toUpperCase(),
        bulan: bulanRaw,
        monthNum: normalizeBulanToMonthNum(bulanRaw),
        tahun: r.tahun ?? 2026,
        kdGrup: String(r.kd_grup ?? '').trim(),
        sales: String(r.sales ?? '').trim(),
        kota: String(r.kota ?? '').trim().toUpperCase(),
        tele: String(r.tele ?? '').trim(),
      };
    })
    .filter((r) => r.depo && r.sales);
}

export async function loadTargetData(): Promise<TargetRow[]> {
  const rows = await fetchAllRows<TargetDbRow>(
    'targets',
    'nama_salesman, depo, supplier, tahun, monthly'
  );

  return rows
    .map((r): TargetRow => ({
      namaSalesman: String(r.nama_salesman ?? '').trim(),
      depo: String(r.depo ?? '').trim().toUpperCase(),
      supplier: String(r.supplier ?? '').trim().toUpperCase(),
      tahun: r.tahun ?? new Date().getFullYear(),
      monthly: Array.isArray(r.monthly) && r.monthly.length === 12
        ? r.monthly.map((v) => Number(v) || 0)
        : new Array(12).fill(0),
    }))
    .filter((r) => r.namaSalesman);
}