import { create } from 'zustand';
import type { Filters } from '../lib/aggregate';

interface FilterStore extends Filters {
  setDepo: (d: string) => void;
  setBulan: (b: number) => void;
  setTahun: (t: number) => void;
  reset: () => void;
}

export const useFilterStore = create<FilterStore>((set) => ({
  depo: 'ALL',
  bulan: 0,
  tahun: 2026,
  setDepo: (d) => set({ depo: d }),
  setBulan: (b) => set({ bulan: b }),
  setTahun: (t) => set({ tahun: t }),
  reset: () => set({ depo: 'ALL', bulan: 0, tahun: 2026 }),
}));
