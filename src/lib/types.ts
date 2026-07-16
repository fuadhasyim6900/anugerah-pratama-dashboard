export interface SalesRow {
  nominal: number;
  supp: string;
  depo: string;
  bulan: string;      // raw month text e.g. "Jan"
  monthNum: number;   // 1-12, derived from bulan
  tahun: number;
  kdGrup: string;     // used for distinct AO count
  sales: string;      // DSR name
  kota: string;
  tele: string;       // '' or 'Telemarketing'
}

export interface TargetRow {
  namaSalesman: string;
  depo: string;
  supplier: string;
  tahun: number;
  monthly: number[]; // index 0 = Jan ... 11 = Dec
}

export const MONTH_NAMES_ID = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

export const MONTH_NAMES_FULL_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

// Source month labels vary (English "May"/"Aug"/"Oct"/"Dec" or Indonesian "Mei"/"Agu"/"Okt"/"Des") — normalize both.
export function normalizeBulanToMonthNum(raw: string | number | undefined | null): number {
  if (raw === undefined || raw === null) return 0;
  if (typeof raw === 'number') return raw;
  const s = raw.toString().trim().toLowerCase();
  const map: Record<string, number> = {
    jan: 1, januari: 1,
    feb: 2, februari: 2,
    mar: 3, maret: 3,
    apr: 4, april: 4,
    mei: 5, may: 5,
    jun: 6, juni: 6, june: 6,
    jul: 7, juli: 7, july: 7,
    agu: 8, agt: 8, aug: 8, agustus: 8,
    sep: 9, september: 9,
    okt: 10, oct: 10, oktober: 10,
    nov: 11, november: 11,
    des: 12, dec: 12, desember: 12,
  };
  return map[s] ?? 0;
}
