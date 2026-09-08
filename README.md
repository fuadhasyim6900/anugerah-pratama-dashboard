# Dashboard Kinerja Penjualan & Active Outlet (AO) — CV Anugerah Pratama

Dashboard penjualan & Active Outlet (AO) untuk seluruh depo CV Anugerah Pratama, dibangun dengan React + Vite + TypeScript + Tailwind.

> **Status saat ini: mode LOKAL.** Dashboard membaca file Excel langsung di browser (tidak perlu Supabase/Vercel dulu). Lihat bagian "Menjalankan secara lokal" di bawah. Bagian Supabase/Vercel di README ini disimpan untuk referensi migrasi nanti (`scripts/sync-data.mjs` dan `api/data.js` sudah disiapkan mengikuti struktur data terbaru, tinggal diaktifkan kembali saat siap pindah).

## Halaman

1. **Executive Dashboard** — total omset, target, total AO, rata-rata omset/AO, persentase pencapaian, target vs realisasi, tren bulanan, omset per kota & per depo.
2. **Kinerja DSR** — peringkat penjualan DSR, rata-rata AO per DSR, breakdown per supplier untuk DSR terpilih (termasuk kontribusi omset telemarketing).
3. **Proyeksi S2 2026** — skenario proyeksi Juli–Desember (tren historis, flat, target +5%/+10%, atau kustom -20% s/d +20%).
4. **Review Kinerja DSR & Solusi Strategis** — analisis kelemahan & rekomendasi per DSR, dihitung otomatis dari data (bukan teks statis), sehingga selalu mengikuti data terbaru.
5. **Realisasi Uang Masuk** — target & realisasi penagihan piutang per depo per bulan.
6. **Omset Harian** *(baru)* — grafik omset per tanggal faktur, barchart & tabel barang paling banyak diambil (per Supplier & Qty), tabel riwayat pengambilan barang per pelanggan, dan tabel rincian perbandingan harian antar dua tahun. Lihat penjelasan di bawah.

Sidebar berisi filter **Depo**, **Sales DSR**, **SUPP**, **Bulan**, dan **Tahun** yang berlaku ke semua halaman. Ada juga tombol ganti tema gelap/terang, ekspor halaman aktif ke PDF, dan ekspor laporan lengkap (6 halaman sekaligus) ke PDF.

## Halaman baru: Omset Harian

Sumber datanya sama dengan halaman lain (`public/data/DATA.xlsx`), tapi memakai kolom-kolom baru yang sekarang ada di file itu (`TGL FAKTUR`, `Qty`, `NAMA BARANG`, data pelanggan, dst). Isinya:

- **Grafik Omset Harian** — total omset per tanggal faktur. Memakai filter sidebar (Depo/Sales DSR/SUPP/Bulan/Tahun) ditambah filter **Tanggal** (tanggal-dalam-bulan) yang hanya ada di halaman ini.
- **Barang Paling Banyak Diambil** — barchart top 15 barang berdasarkan akumulasi Qty per Supplier, plus tabel lengkapnya (kolom: Supplier, Nama Barang, Akumulasi Qty). Memakai filter yang sama seperti grafik di atasnya.
- **Riwayat Pengambilan Barang** — satu baris per kombinasi Pelanggan + Barang (Kode Pelanggan, Nama Pelanggan, Alamat, Kota, Nama Barang, Supplier, Transaksi Terakhir, Total Qty, Total Nominal, Frekuensi). Filter Depo/SUPP/Bulan/Tahun dari sidebar + kotak pencarian Nama Barang khusus di halaman ini (dipakai sebagai pengganti dropdown karena jumlah nama barang bisa sangat banyak). Diurutkan dari nominal tertinggi, dibatasi 200 baris teratas di layar supaya tetap ringan — gunakan filter untuk mempersempit kalau perlu semua baris.
- **Tabel Rincian Perbandingan Harian** — sama seperti "Tabel Rincian Perbandingan Bulanan" di Executive Dashboard, tapi per tanggal di dalam satu bulan yang dipilih (dropdown **Bulan** tambahan di tabel ini), membandingkan dua tahun (Tahun A / Tahun B) sekaligus pertumbuhannya.

## Sumber data

Data **tidak** di-hardcode — dashboard membaca langsung 3 file Excel ini saat halaman dibuka (di-parse di browser dengan SheetJS):

```
public/data/DATA.xlsx               → transaksi penjualan, satu baris per baris faktur
public/data/DATA_TARGET_FUAD.xlsx   → target bulanan per salesman/supplier
public/data/REALISASI UANG MASUK.xlsx → target & realisasi penagihan piutang per depo/bulan
```

### Struktur kolom `DATA.xlsx` (terbaru)

```
TGL FAKTUR, KODE PELANGGAN, NAMA PELANGGAN, ALAMAT PELANGGAN, NAMA BARANG,
KOTA, NOMINAL, Qty, SUPP, DEPO, KD GRUP, SALES, RANK BAYAR, RANK OMSET,
KECAMATAN, TELE
```

> Kolom **BULAN** dan **TAHUN** yang dulu terpisah SEKARANG DITURUNKAN OTOMATIS dari **TGL FAKTUR** (lihat `deriveDateParts()` di `src/lib/types.ts`) — Anda tidak perlu lagi mengisi kolom Bulan/Tahun sendiri, cukup pastikan TGL FAKTUR terisi dan berformat tanggal (atau `dd/mm/yyyy` sebagai teks) di setiap baris.

> Catatan teknis: nama kolom dengan tanda kutip & spasi tambahan (mis. `" DEPO "` bukan `DEPO`) tetap ditangani otomatis oleh parser, sama seperti sebelumnya.

### Cara update data setiap hari (mode lokal)

1. Timpa (replace) `public/data/DATA.xlsx` dengan file terbaru — **nama file harus tetap sama persis**, kolom mengikuti struktur di atas.
2. Simpan file, lalu klik tombol **Refresh** di kanan atas dashboard (atau reload browser). Karena file diambil dengan `cache: 'no-store'` + cache-busting, dashboard akan selalu membaca versi terbaru dari disk.
3. Kalau sedang menjalankan `npm run dev`, Vite otomatis melayani file terbaru tanpa perlu restart server.

## Menjalankan secara lokal

```bash
npm install
npm run dev
```

Buka http://localhost:5173 — dashboard langsung membaca file di `public/data/` tanpa setup tambahan (tidak perlu `.env`, Supabase, atau `vercel dev`).

## Build production

```bash
npm run build
npm run preview   # untuk mengetes hasil build secara lokal
```

Build ini masih 100% statis (SPA) — bisa di-deploy ke hosting statis apa pun (Vercel, Netlify, GitHub Pages, dst) selama folder `public/data/*.xlsx` ikut ter-deploy.

## Migrasi ke Supabase (langkah berikutnya)

Proyek ini sebelumnya sempat memakai Supabase + endpoint `/api/data` di Vercel supaya ±262.000 baris data tidak ditarik ulang dari browser tiap sales buka dashboard (lihat riwayat di `scripts/sync-data.mjs` dan `api/data.js` — keduanya SUDAH diupdate mengikuti kolom baru `TGL FAKTUR`/`Qty`/`NAMA BARANG`/dst, tinggal diaktifkan lagi kapan pun siap):

1. Buat tabel `sales` di Supabase dengan kolom: `nominal, supp, depo, tgl_faktur (date), bulan, tahun, kd_grup, sales, kota, kecamatan, tele, kode_pelanggan, nama_pelanggan, alamat_pelanggan, nama_barang, qty, rank_bayar, rank_omset` (plus tabel `targets`, `uang_masuk`, `data_meta` — lihat query lama di bawah).
2. Set `SUPABASE_URL` dan `SUPABASE_SECRET_KEY` di `.env`, lalu jalankan `node --env-file=.env scripts/sync-data.mjs` untuk mengisi Supabase dari file Excel di `public/data/`.
3. Ubah `src/lib/loadData.ts` supaya kembali fetch ke `/api/data` (endpoint ini sudah siap di `api/data.js`) alih-alih parse Excel langsung — cukup ganti isi 4 fungsi `load*()` di file itu, bentuk `SalesRow`/`TargetRow`/`UangMasukRow` yang dikembalikan tidak perlu diubah sama sekali karena semua halaman (termasuk Omset Harian) sudah memakai bentuk data yang sama.
4. Deploy ke Vercel dengan `SUPABASE_URL` & `SUPABASE_ANON_KEY` di Environment Variables (lihat bagian deploy di bawah).

```sql
create table if not exists data_meta (
  id int primary key,
  synced_at timestamptz not null default now()
);

alter table data_meta enable row level security;

create policy "Allow public read" on data_meta
  for select using (true);
```

```sql
create table if not exists uang_masuk (
  id bigint generated always as identity primary key,
  tahun int not null,
  bulan text not null,
  depo text not null,
  target_piutang numeric not null default 0,
  realisasi_piutang numeric not null default 0
);

create index if not exists uang_masuk_tahun_idx on uang_masuk (tahun);
create index if not exists uang_masuk_depo_idx on uang_masuk (depo);

alter table uang_masuk enable row level security;

create policy "Allow public read" on uang_masuk
  for select using (true);
```

## Deploy ke Vercel (setelah migrasi Supabase)

1. Push project ini ke repository GitHub Anda.
2. Di Vercel: **New Project** → import repo tersebut.
3. Framework preset: **Vite** (Vercel akan mendeteksinya otomatis).
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Di **Settings → Environment Variables**, tambahkan dua variable ini (nilainya sama dengan yang ada di `.env` lokal Anda):
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
5. Deploy. Setelah itu, setiap `git push` ke branch utama akan otomatis membuat deployment baru.

## Struktur proyek

```
src/
  lib/            → parsing Excel (SheetJS), agregasi data (aggregate.ts, omsetHarian.ts), mesin analisis DSR, ekspor PDF
  store/          → filter global (Depo/DSR/SUPP/Bulan/Tahun) & tema (Zustand)
  hooks/          → provider data (fetch & parse sekali, dipakai semua halaman)
  components/     → Sidebar, TopBar, KPI card, chart wrapper (Recharts)
  pages/          → 6 halaman dashboard (termasuk OmsetHarian.tsx)
public/
  data/           → 3 file Excel sumber data (timpa file ini untuk update harian)
  Logo-AP_PNG.webp
scripts/
  sync-data.mjs   → (opsional, untuk migrasi Supabase nanti) import Excel -> Supabase
api/
  data.js         → (opsional, untuk migrasi Supabase nanti) endpoint Vercel yang men-cache data dari Supabase
```

## Font

Menggunakan **Plus Jakarta Sans** (sama seperti referensi), dimuat lewat Google Fonts di `src/index.css`.

## Ekspor / Cetak

- **Ekspor Halaman Aktif** — merender halaman yang sedang dibuka menjadi PDF (via `html2canvas` + `jsPDF`) lalu otomatis mengunduhnya. File PDF yang terunduh bisa langsung dicetak dari PDF viewer manapun.
- **Ekspor Laporan Lengkap** — otomatis berpindah ke keenam halaman satu per satu, menangkap tiap halaman, lalu menggabungkannya menjadi satu file PDF multi-halaman.

