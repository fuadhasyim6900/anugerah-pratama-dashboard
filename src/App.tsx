import { useEffect } from 'react';
import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import PageFooter from './components/PageFooter';
import ExecutiveDashboard from './pages/ExecutiveDashboard';
import KinerjaDSR from './pages/KinerjaDSR';
import ProyeksiS2 from './pages/ProyeksiS2';
import ReviewDSR from './pages/ReviewDSR';
import { DataProvider } from './hooks/useSalesData';
import { useThemeStore } from './store/theme';
import { useUIStore } from './store/ui';
import { registerNavigation } from './lib/exportPdf';

function ThemeSync() {
  const dark = useThemeStore((s) => s.dark);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);
  return null;
}

function ExportNavRegistrar() {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    registerNavigation((path) => navigate(path), () => location.pathname);
  }, [navigate, location.pathname]);
  return null;
}

/**
 * Consumes `scrollTargetId` (set by the sidebar's chart/table sub-links —
 * see Sidebar.tsx) once the corresponding section is on screen: scrolls to
 * it smoothly, then clears the target. Retries across a few animation
 * frames because switching pages/tabs re-renders the charts, so the
 * element may not exist in the DOM in the very first frame after
 * navigation.
 */
function ScrollToSection() {
  const location = useLocation();
  const scrollTargetId = useUIStore((s) => s.scrollTargetId);
  const setScrollTargetId = useUIStore((s) => s.setScrollTargetId);

  useEffect(() => {
    if (!scrollTargetId) return;
    let cancelled = false;
    const tryScroll = (attemptsLeft: number) => {
      if (cancelled) return;
      const el = document.getElementById(scrollTargetId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setScrollTargetId(null);
      } else if (attemptsLeft > 0) {
        requestAnimationFrame(() => tryScroll(attemptsLeft - 1));
      } else {
        setScrollTargetId(null);
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(() => tryScroll(30)));
    return () => { cancelled = true; };
  }, [location.pathname, scrollTargetId, setScrollTargetId]);

  return null;
}

function Layout() {
  return (
    <div className="flex min-h-screen overflow-x-hidden">
      <Sidebar />
      <main id="app-main" className="flex-1 min-w-0 pb-16 md:pb-0">
        <Routes>
          <Route path="/" element={<ExecutiveDashboard />} />
          <Route path="/kinerja-dsr" element={<KinerjaDSR />} />
          <Route path="/proyeksi-s2" element={<ProyeksiS2 />} />
          <Route path="/review-dsr" element={<ReviewDSR />} />
        </Routes>
        <PageFooter />
      </main>
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <DataProvider>
      <HashRouter>
        <ThemeSync />
        <ExportNavRegistrar />
        <ScrollToSection />
        <Layout />
      </HashRouter>
    </DataProvider>
  );
}
