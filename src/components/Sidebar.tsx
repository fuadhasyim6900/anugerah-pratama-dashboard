import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useUIStore } from '../store/ui';
import { NAV_ITEMS } from '../lib/navItems';
import clsx from 'clsx';
import { X, ChevronDown, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

export default function Sidebar() {
  const { sidebarCollapsed, mobileNavOpen, setMobileNavOpen, toggleSidebarCollapsed } = useUIStore();
  const setScrollTargetId = useUIStore((s) => s.setScrollTargetId);
  const location = useLocation();
  const navigate = useNavigate();

  // Which nav items' section lists are expanded. Starts with the current
  // page's own sections open, so people land on a page and immediately see
  // its table of contents without an extra click.
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(NAV_ITEMS.filter((n) => n.to === location.pathname).map((n) => n.to))
  );

  function toggleExpanded(to: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(to)) next.delete(to); else next.add(to);
      return next;
    });
  }

  function goToSection(pageTo: string, sectionId: string) {
    setScrollTargetId(sectionId);
    if (location.pathname !== pageTo) navigate(pageTo);
    setMobileNavOpen(false);
  }

  return (
    <>
      {/* Mobile backdrop */}
      {mobileNavOpen && (
        <div
          className="no-print fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Desktop-only "tampilkan sidebar" button, shown once the sidebar is
          collapsed. Fixed to the viewport (not tied to page scroll) so it's
          always in the same, reachable spot regardless of how tall a given
          page's header/subtitle happens to be — unlike a toggle placed
          inside the page's own sticky TopBar. */}
      {sidebarCollapsed && (
        <button
          onClick={toggleSidebarCollapsed}
          title="Tampilkan sidebar"
          aria-label="Tampilkan sidebar"
          className="no-print hidden md:flex fixed top-4 left-4 z-40 items-center justify-center h-9 w-9 rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-600 dark:text-ink-300 shadow-card hover:bg-ink-50 dark:hover:bg-ink-800"
        >
          <PanelLeftOpen size={16} />
        </button>
      )}

      {/* Desktop-only "sembunyikan sidebar" toggle, shown while the sidebar
          is visible. Also fixed to the viewport (same as the counterpart
          above) rather than living inside the sidebar's own sticky header —
          a merely-sticky button can end up hidden depending on how the
          sidebar's internal nav-list scroll and the page's own scroll
          interact on long pages. Being fixed guarantees it's always
          reachable regardless of scroll position on either. */}
      {!sidebarCollapsed && (
        <button
          onClick={toggleSidebarCollapsed}
          title="Sembunyikan sidebar"
          aria-label="Sembunyikan sidebar"
          className="no-print hidden md:flex fixed top-4 left-[236px] z-40 items-center justify-center h-9 w-9 rounded-lg text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800"
        >
          <PanelLeftClose size={16} />
        </button>
      )}

      <aside
        className={clsx(
          'no-print w-72 shrink-0 flex flex-col bg-white dark:bg-ink-900 border-r border-ink-100 dark:border-ink-800',
          'fixed inset-y-0 left-0 z-50 h-full transition-transform duration-200 ease-out',
          'overflow-y-auto overscroll-contain',
          'md:sticky md:top-0 md:h-screen md:z-30 md:transition-[margin,transform] md:duration-200',
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full',
          'md:translate-x-0',
          sidebarCollapsed && 'md:-ml-72 md:pointer-events-none md:opacity-0',
        )}
      >
        <div className="flex items-center gap-3 px-5 py-5 border-b border-ink-100 dark:border-ink-800 sticky top-0 z-10 bg-white dark:bg-ink-900">
          <img src="/Logo-AP_PNG.webp" alt="Logo CV Anugerah Pratama" className="h-10 w-10 object-contain shrink-0" />
          <div className="min-w-0">
            <div className="font-extrabold leading-tight text-sm tracking-tight">CV ANUGERAH PRATAMA</div>
            <div className="text-[11px] text-ink-400 font-medium">Sales &amp; AO Dashboard</div>
          </div>
          <button
            onClick={() => setMobileNavOpen(false)}
            className="ml-auto md:hidden flex items-center justify-center h-8 w-8 rounded-lg text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800 shrink-0"
            aria-label="Tutup menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="shrink-0 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon, sections }) => {
            const isOpen = expanded.has(to);
            return (
              <div key={to}>
                <div
                  className={clsx(
                    'flex items-center rounded-lg text-sm font-semibold transition-colors',
                    location.pathname === to
                      ? 'bg-brand-600 text-white shadow-card'
                      : 'text-ink-600 dark:text-ink-300 hover:bg-brand-50 dark:hover:bg-ink-800 hover:text-brand-700 dark:hover:text-brand-400'
                  )}
                >
                  <NavLink
                    to={to}
                    end={to === '/'}
                    onClick={() => setMobileNavOpen(false)}
                    className="flex-1 flex items-center gap-3 px-3 py-2.5 min-w-0"
                  >
                    <Icon size={18} strokeWidth={2.2} className="shrink-0" />
                    <span className="truncate">{label}</span>
                  </NavLink>
                  {sections && sections.length > 0 && (
                    <button
                      type="button"
                      onClick={() => toggleExpanded(to)}
                      aria-label={isOpen ? `Tutup daftar isi ${label}` : `Buka daftar isi ${label}`}
                      aria-expanded={isOpen}
                      className={clsx(
                        'shrink-0 flex items-center justify-center h-8 w-8 mr-1 rounded-md',
                        location.pathname === to ? 'hover:bg-white/15' : 'hover:bg-ink-200/60 dark:hover:bg-ink-700'
                      )}
                    >
                      <ChevronDown
                        size={15}
                        strokeWidth={2.4}
                        className={clsx('transition-transform duration-150', isOpen && 'rotate-180')}
                      />
                    </button>
                  )}
                </div>

                {sections && sections.length > 0 && isOpen && (
                  <ul className="mt-1 mb-1.5 ml-[26px] pl-3 border-l border-ink-100 dark:border-ink-800 space-y-0.5">
                    {sections.map((sec) => (
                      <li key={sec.id}>
                        <button
                          type="button"
                          onClick={() => goToSection(to, sec.id)}
                          className="w-full text-left px-2.5 py-1.5 rounded-md text-[12.5px] font-medium text-ink-500 dark:text-ink-400 hover:bg-brand-50 dark:hover:bg-ink-800 hover:text-brand-700 dark:hover:text-brand-400 truncate transition-colors"
                        >
                          {sec.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>

        <div className="px-5 py-3 text-[11px] text-ink-400 border-t border-ink-100 dark:border-ink-800 mt-auto">
          © {new Date().getFullYear()} CV Anugerah Pratama
        </div>
      </aside>
    </>
  );
}
