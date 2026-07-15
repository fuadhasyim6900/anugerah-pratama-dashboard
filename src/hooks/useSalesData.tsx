import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { SalesRow, TargetRow } from '../lib/types';
import { loadSalesData, loadTargetData } from '../lib/loadData';

interface DataContextValue {
  sales: SalesRow[];
  targets: TargetRow[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  lastUpdated: Date | null;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [sales, setSales] = useState<SalesRow[]>([]);
  const [targets, setTargets] = useState<TargetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, t] = await Promise.all([loadSalesData(), loadTargetData()]);
      setSales(s);
      setTargets(t);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <DataContext.Provider value={{ sales, targets, loading, error, reload: load, lastUpdated }}>
      {children}
    </DataContext.Provider>
  );
}

export function useSalesData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useSalesData must be used within DataProvider');
  return ctx;
}
