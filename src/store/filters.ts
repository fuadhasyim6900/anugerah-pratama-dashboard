import { create } from 'zustand';
import type { Filters } from '../lib/aggregate';

interface FilterStore extends Filters {
  depo: string[];
  dsr: string[];
  supp: string[];
  bulan: number[];
  tahun: number[];
  setDepo: (d: string[]) => void;
  setDsr: (d: string[]) => void;
  setSupp: (s: string[]) => void;
  setBulan: (b: number[]) => void;
  setTahun: (t: number[]) => void;
  reset: () => void;
}

export const useFilterStore = create<FilterStore>((set) => ({
  depo: [],
  dsr: [],
  supp: [],
  bulan: [],
  tahun: [],
  setDepo: (d) => set({ depo: d }),
  setDsr: (d) => set({ dsr: d }),
  setSupp: (s) => set({ supp: s }),
  setBulan: (b) => set({ bulan: b }),
  setTahun: (t) => set({ tahun: t }),
  reset: () => set({ depo: [], dsr: [], supp: [], bulan: [], tahun: [] }),
}));
