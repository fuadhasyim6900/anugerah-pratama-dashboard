import { create } from 'zustand';

interface UIStore {
  /** Desktop (md+): true = sidebar is hidden completely, main content takes full width */
  sidebarCollapsed: boolean;
  toggleSidebarCollapsed: () => void;
  /** Mobile (<md): true = off-canvas drawer is open */
  mobileNavOpen: boolean;
  setMobileNavOpen: (v: boolean) => void;
}

const STORAGE_KEY = 'ap-dashboard-sidebar-collapsed';

function getInitialCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export const useUIStore = create<UIStore>((set, get) => ({
  sidebarCollapsed: getInitialCollapsed(),
  toggleSidebarCollapsed: () => {
    const next = !get().sidebarCollapsed;
    set({ sidebarCollapsed: next });
    try { localStorage.setItem(STORAGE_KEY, next ? '1' : '0'); } catch { /* noop */ }
  },
  mobileNavOpen: false,
  setMobileNavOpen: (v) => set({ mobileNavOpen: v }),
}));
