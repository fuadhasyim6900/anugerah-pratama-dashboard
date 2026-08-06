import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { SalesRow, TargetRow, UangMasukRow } from '../lib/types';
import { loadSalesData, loadTargetData, loadUangMasukData, loadDataSyncedAt } from '../lib/loadData';

interface DataContextValue {
  sales: SalesRow[];
  targets: TargetRow[];
  uangMasuk: UangMasukRow[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  lastUpdated: Date | null;
  /** Waktu Anda terakhir menjalankan `node scripts/sync-data.mjs` (data benar-benar diupdate). */
  dataUpdatedAt: Date | null;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [sales, setSales] = useState<SalesRow[]>([]);
  const [targets, setTargets] = useState<TargetRow[]>([]);
  const [uangMasuk, setUangMasuk] = useState<UangMasukRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [dataUpdatedAt, setDataUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // `uang_masuk` gagal dimuat secara terpisah (dan tidak menggagalkan
      // seluruh dashboard) selama tabelnya belum dibuat di Supabase — lihat
      // README bagian "Realisasi Uang Masuk" untuk cara membuatnya.
      const [s, t, syncedAt, u] = await Promise.all([
        loadSalesData(),
        loadTargetData(),
        loadDataSyncedAt(),
        loadUangMasukData().catch(() => [] as UangMasukRow[]),
      ]);
      setSales(s);
      setTargets(t);
      setUangMasuk(u);
      setDataUpdatedAt(syncedAt);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <DataContext.Provider value={{ sales, targets, uangMasuk, loading, error, reload: load, lastUpdated, dataUpdatedAt }}>
      {children}
    </DataContext.Provider>
  );
}

export function useSalesData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useSalesData must be used within DataProvider');
  return ctx;
}
