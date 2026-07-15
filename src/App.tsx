import { useEffect } from 'react';
import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import ExecutiveDashboard from './pages/ExecutiveDashboard';
import KinerjaDSR from './pages/KinerjaDSR';
import ProyeksiS2 from './pages/ProyeksiS2';
import ReviewDSR from './pages/ReviewDSR';
import { DataProvider } from './hooks/useSalesData';
import { useThemeStore } from './store/theme';
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

function Layout() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <Routes>
          <Route path="/" element={<ExecutiveDashboard />} />
          <Route path="/kinerja-dsr" element={<KinerjaDSR />} />
          <Route path="/proyeksi-s2" element={<ProyeksiS2 />} />
          <Route path="/review-dsr" element={<ReviewDSR />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <DataProvider>
      <HashRouter>
        <ThemeSync />
        <ExportNavRegistrar />
        <Layout />
      </HashRouter>
    </DataProvider>
  );
}
