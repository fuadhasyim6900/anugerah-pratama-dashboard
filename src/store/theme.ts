import { create } from 'zustand';

interface ThemeStore {
  dark: boolean;
  toggle: () => void;
  setDark: (v: boolean) => void;
}

const STORAGE_KEY = 'ap-dashboard-theme';

function getInitial(): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return saved === 'dark';
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  } catch {
    return false;
  }
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  dark: getInitial(),
  toggle: () => {
    const next = !get().dark;
    set({ dark: next });
    try { localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light'); } catch { /* noop */ }
  },
  setDark: (v) => {
    set({ dark: v });
    try { localStorage.setItem(STORAGE_KEY, v ? 'dark' : 'light'); } catch { /* noop */ }
  },
}));
