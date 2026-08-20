export interface SalesRow {
  nominal: number;
  supp: string;
  depo: string;
  // BULAN/TAHUN dulu kolom terpisah di source Excel — sekarang keduanya
  // DITURUNKAN dari TGL FAKTUR (lihat deriveDateParts di bawah), jadi kalau
  // baris punya TGL FAKTUR yang valid, bulan/monthNum/tahun/tanggal selalu
  // konsisten dengan tanggal itu.
  tglFaktur: Date | null; // tanggal faktur asli (jam diabaikan)
  tanggalStr: string;     // "yyyy-mm-dd", dipakai sebagai key pengelompokan harian
  tanggal: number;        // tanggal dalam bulan (1-31), 0 kalau tglFaktur kosong
  bulan: string;      // raw month text e.g. "Jan"
  monthNum: number;   // 1-12, derived from bulan
  tahun: number;
  kdGrup: string;     // used for distinct AO count
  sales: string;      // DSR name
  kota: string;
  kecamatan: string;
  tele: string;       // '' or 'Telemarketing'
  // Kolom baru dari format data terbaru (per transaksi/baris faktur)
  kodePelanggan: string;
  namaPelanggan: string;
  alamatPelanggan: string;
  namaBarang: string;
  qty: number;
  rankBayar: string;
  rankOmset: string;
}

/** Menurunkan bulan/monthNum/tahun/tanggal/tanggalStr dari sebuah Date TGL FAKTUR. */
export function deriveDateParts(date: Date | null): {
  bulan: string; monthNum: number; tahun: number; tanggal: number; tanggalStr: string;
} {
  if (!date || isNaN(date.getTime())) {
    return { bulan: '', monthNum: 0, tahun: 2026, tanggal: 0, tanggalStr: '' };
  }
  const monthNum = date.getMonth() + 1;
  const tahun = date.getFullYear();
  const tanggal = date.getDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    bulan: MONTH_NAMES_ID[monthNum - 1],
    monthNum,
    tahun,
    tanggal,
    tanggalStr: `${tahun}-${pad(monthNum)}-${pad(tanggal)}`,
  };
}

export interface TargetRow {
  namaSalesman: string;
  depo: string;
  supplier: string;
  tahun: number;
  monthly: number[]; // index 0 = Jan ... 11 = Dec
}

// Realisasi Uang Masuk (penagihan piutang): satu baris per Depo per Bulan
// per Tahun, dari file "REALISASI UANG MASUK.xlsx" (kolom TAHUN, BULAN,
// DEPO, TARGET PIUTANG, REALISASI PIUTANG).
export interface UangMasukRow {
  tahun: number;
  bulan: string;     // raw month text e.g. "Jul"
  monthNum: number;  // 1-12, derived from bulan
  depo: string;
  targetPiutang: number;
  realisasiPiutang: number;
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
