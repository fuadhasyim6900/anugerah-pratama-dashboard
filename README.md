# Dashboard Kinerja Penjualan & Active Outlet (AO) — CV Anugerah Pratama

Dashboard penjualan & Active Outlet (AO) untuk seluruh depo CV Anugerah Pratama, dibangun dengan React + Vite + TypeScript + Tailwind, siap di-deploy ke Vercel.

## Halaman

1. **Executive Dashboard** — total omset, target, total AO, rata-rata omset/AO, persentase pencapaian, target vs realisasi, tren bulanan, omset per kota & per depo.
2. **Kinerja DSR** — peringkat penjualan DSR, rata-rata AO per DSR, breakdown per supplier untuk DSR terpilih (termasuk kontribusi omset telemarketing).
3. **Proyeksi S2 2026** — skenario proyeksi Juli–Desember (tren historis, flat, target +5%/+10%, atau kustom -20% s/d +20%).
4. **Review Kinerja DSR & Solusi Strategis** — analisis kelemahan & rekomendasi per DSR, dihitung otomatis dari data (bukan teks statis), sehingga selalu mengikuti data terbaru.

Sidebar berisi filter **Depo**, **Bulan**, dan **Tahun** yang berlaku ke semua halaman. Ada juga tombol ganti tema gelap/terang, ekspor halaman aktif ke PDF, dan ekspor laporan lengkap (4 halaman sekaligus) ke PDF.

## Sumber data

Data **tidak** di-hardcode — dashboard membaca langsung 2 file Excel ini saat halaman dibuka:

```
public/data/DATA.xlsx               → transaksi penjualan (NOMINAL, SUPP, DEPO, BULAN, TAHUN, KD GRUP, SALES, KOTA, TELE)
public/data/DATA_TARGET_FUAD.xlsx   → target bulanan per salesman/supplier
```

> Catatan teknis: kedua file sumber ternyata menyimpan nama kolom dengan tanda kutip & spasi tambahan (mis. `" DEPO "` bukan `DEPO`) — kemungkinan sisa dari proses export CSV→Excel. Parser sudah menormalkan ini secara otomatis, jadi tidak masalah walau formatnya seperti itu tetap terbaca dengan benar (ini juga penyebab kartu Target sebelumnya tidak terbaca — sudah diperbaiki).

### Cara update data setiap hari

1. Buka repository GitHub Anda.
2. Timpa (replace) kedua file di atas dengan versi terbaru — **nama file harus tetap sama persis**.
3. Commit & push ke branch yang terhubung ke Vercel.
4. Vercel otomatis build & deploy ulang (biasanya 1–2 menit). Setelah deploy selesai, buka dashboard dan klik tombol **Refresh** di kanan atas untuk memastikan data terbaru terambil (dashboard juga selalu fetch file dengan cache-busting, jadi tidak akan menampilkan data lama yang ter-cache browser).

> Catatan: kolom `TAHUN` pada file omset saat ini belum ada (data yang diupload baru berisi 2026). Begitu Anda menambahkan kolom `TAHUN` beserta data 2025, filter Tahun dan perbandingan YoY di halaman Proyeksi S2 akan otomatis terisi tanpa perlu ubah kode apa pun — kalau kolom `TAHUN` kosong, baris otomatis dianggap tahun 2026.

## Menjalankan secara lokal

```bash
npm install
npm run dev
```

Buka http://localhost:5173

## Build production

```bash
npm run build
npm run preview   # untuk mengetes hasil build secara lokal
```

## Deploy ke Vercel

1. Push project ini ke repository GitHub Anda.
2. Di Vercel: **New Project** → import repo tersebut.
3. Framework preset: **Vite** (Vercel akan mendeteksinya otomatis).
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Deploy. Setelah itu, setiap `git push` ke branch utama akan otomatis membuat deployment baru.

Tidak perlu environment variable apa pun — data diambil langsung dari file di `public/data` pada repo yang sama.

## Struktur proyek

```
src/
  lib/            → parsing Excel (SheetJS), agregasi data, mesin analisis DSR, ekspor PDF
  store/          → filter global (Depo/Bulan/Tahun) & tema (Zustand)
  hooks/          → provider data (fetch & parse sekali, dipakai semua halaman)
  components/     → Sidebar, TopBar, KPI card, chart wrapper (Recharts)
  pages/          → 4 halaman dashboard
public/
  data/           → 2 file Excel sumber data (timpa file ini untuk update harian)
  Logo-AP_PNG.webp
```

## Font

Menggunakan **Plus Jakarta Sans** (sama seperti referensi), dimuat lewat Google Fonts di `src/index.css`.

## Ekspor / Cetak

- **Ekspor Halaman Aktif** — merender halaman yang sedang dibuka menjadi PDF (via `html2canvas` + `jsPDF`) lalu otomatis mengunduhnya. File PDF yang terunduh bisa langsung dicetak dari PDF viewer manapun.
- **Ekspor Laporan Lengkap** — otomatis berpindah ke keempat halaman satu per satu, menangkap tiap halaman, lalu menggabungkannya menjadi satu file PDF multi-halaman.
