// Script diagnostik: cek kenapa TGL FAKTUR bisa salah baca.
// Cara pakai:
//   1. Taruh file ini di folder root project (sejajar dengan folder "scripts").
//   2. Jalankan: node debug-tanggal.mjs
//   3. Copy-paste SEMUA output-nya balik ke chat.

import XLSX from 'xlsx';
import fs from 'node:fs';
import path from 'node:path';

const FILE = path.join(process.cwd(), 'public/data/DATA.xlsx');

if (!fs.existsSync(FILE)) {
  console.error('File tidak ditemukan di:', FILE);
  console.error('Jalankan script ini dari folder root project (yang ada folder "scripts" & "public").');
  process.exit(1);
}

console.log('Timezone sistem ini:', Intl.DateTimeFormat().resolvedOptions().timeZone, '(offset menit:', new Date().getTimezoneOffset(), ')');
console.log('Membaca file:', FILE, '\n');

const wb = XLSX.readFile(FILE, { cellDates: true });
const sheetName = wb.SheetNames[0];
const sheet = wb.Sheets[sheetName];

// Ambil nilai MENTAH (raw:true) supaya kita lihat apa adanya sebelum SheetJS
// "membaikkan" jadi Date/number.
const rowsRaw = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true });
const rowsFormatted = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

function normalizeKey(k) { return k.replace(/^["'\s]+|["'\s]+$/g, '').trim().toUpperCase(); }
function findCol(row, want) {
  for (const k of Object.keys(row)) if (normalizeKey(k) === want) return k;
  return null;
}

const target = (process.argv[2] || '2608000809').trim();
console.log(`Mencari baris dengan NO FAKTUR mengandung "${target}"...\n`);

let found = 0;
for (let i = 0; i < rowsRaw.length; i++) {
  const row = rowsRaw[i];
  const noFakturCol = findCol(row, 'NO FAKTUR');
  const noFaktur = noFakturCol ? String(row[noFakturCol]) : '';
  if (!noFaktur.includes(target)) continue;

  found++;
  const tglCol = findCol(row, 'TGL FAKTUR');
  const rawVal = row[tglCol];
  const formattedVal = rowsFormatted[i][tglCol];

  console.log(`--- Baris ${i + 2} (NO FAKTUR: ${noFaktur}) ---`);
  console.log('  Nilai RAW (raw:true)      :', JSON.stringify(rawVal), '| typeof:', typeof rawVal, rawVal instanceof Date ? '(Date object)' : '');
  console.log('  Nilai FORMATTED (raw:false):', JSON.stringify(formattedVal));
  if (rawVal instanceof Date) {
    console.log('  -> Local Y-M-D  :', rawVal.getFullYear(), rawVal.getMonth() + 1, rawVal.getDate());
    console.log('  -> UTC   Y-M-D  :', rawVal.getUTCFullYear(), rawVal.getUTCMonth() + 1, rawVal.getUTCDate());
    console.log('  -> ISO string   :', rawVal.toISOString());
  }
  console.log('');
  if (found >= 10) break;
}

if (!found) {
  console.log('Tidak ada baris ditemukan dengan NO FAKTUR itu. Cek lagi nomornya, atau kolom NO FAKTUR di file ini mungkin namanya beda.');
  console.log('Nama-nama kolom yang terdeteksi:', Object.keys(rowsRaw[0] || {}));
}
