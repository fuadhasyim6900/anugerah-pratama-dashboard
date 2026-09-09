// -----------------------------------------------------------------------
// Unduh data tabel (array of rows) sebagai file Excel (.xlsx) yang rapi —
// header di baris pertama, lebar kolom disesuaikan, format tulisan biasa
// (bukan hasil screenshot/PNG atau PDF hasil capture layar seperti
// ExportMenu di chart/kartu lain). Dipakai untuk popup "Daftar
// Barang"/"Daftar Toko" di Performa Outlet, yang isinya bisa panjang
// (banyak baris) sehingga tidak cocok diunduh sebagai gambar/PDF satu
// halaman.
//
// `xlsx` (SheetJS) di-import secara dinamis supaya tidak menambah ukuran
// bundle utama untuk halaman yang tidak memakainya (sama seperti pola
// dynamic import jsPDF/html2canvas di ExportMenu.tsx).
// -----------------------------------------------------------------------

export interface XlsxColumn<T> {
  header: string;
  /** Ambil nilai kolom dari satu baris data. */
  value: (row: T) => string | number;
  /** Lebar kolom (dalam satuan karakter Excel). Default menyesuaikan panjang header. */
  width?: number;
  /** Format angka Excel, mis. '#,##0' untuk qty atau '#,##0' untuk rupiah tanpa simbol. */
  numFmt?: string;
}

export async function exportRowsToXlsx<T>(
  rows: T[],
  columns: XlsxColumn<T>[],
  filename: string,
  sheetName = 'Data'
): Promise<void> {
  const XLSX = await import('xlsx');

  const aoa = [
    columns.map((c) => c.header),
    ...rows.map((r) => columns.map((c) => c.value(r))),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  ws['!cols'] = columns.map((c) => ({
    wch: c.width ?? Math.max(12, c.header.length + 4),
  }));

  // Terapkan format angka (mis. pemisah ribuan) ke seluruh baris data pada
  // kolom yang punya numFmt, supaya angka rapi & tetap berupa angka asli
  // (bukan teks) saat dibuka di Excel/Google Sheets.
  columns.forEach((c, colIdx) => {
    if (!c.numFmt) return;
    for (let rowIdx = 1; rowIdx < aoa.length; rowIdx++) {
      const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
      const cell = ws[cellRef];
      if (cell && typeof cell.v === 'number') cell.z = c.numFmt;
    }
  });

  // Header bold sederhana lewat freeze pane baris pertama, supaya tetap
  // kelihatan judul kolomnya walau di-scroll ke bawah pada data yang panjang.
  // (Catatan: freeze pane tidak didukung penuh oleh library xlsx versi
  // community yang dipakai di sini, jadi cukup andalkan baris header biasa.)

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
