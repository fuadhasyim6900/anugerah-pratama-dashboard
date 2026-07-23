import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ArrowUp, ArrowDown } from 'lucide-react';
import clsx from 'clsx';
import { NAV_ITEMS } from '../lib/navItems';

/**
 * Small navigation aids shown on every page, so long dashboards don't force
 * the user to scroll all the way up/down manually:
 *  - Floating "back to top" / "go to bottom" buttons (all breakpoints) that
 *    fade in/out depending on scroll position.
 *  - A mobile-only bottom tab bar for switching pages directly, since the
 *    full Sidebar is tucked behind a hamburger menu on small screens.
 */
export default function BottomNav() {
  const [showTop, setShowTop] = useState(false);
  const [showBottom, setShowBottom] = useState(true);

  useEffect(() => {
    function onScroll() {
      setShowTop(window.scrollY > 400);
      const distanceFromBottom = document.documentElement.scrollHeight - (window.scrollY + window.innerHeight);
      setShowBottom(distanceFromBottom > 400);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function scrollToBottom() {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
  }

  return (
    <>
      {/* Mobile bottom tab bar — jump straight to another page without opening the drawer */}
      <nav
        className={clsx(
          'no-print md:hidden fixed bottom-0 inset-x-0 z-30 flex items-stretch',
          'bg-white dark:bg-ink-900 border-t border-ink-100 dark:border-ink-800',
          'shadow-[0_-2px_10px_rgba(0,0,0,0.06)]'
        )}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {NAV_ITEMS.map(({ to, shortLabel, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => clsx(
              'flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold transition-colors',
              isActive ? 'text-brand-600' : 'text-ink-400 hover:text-brand-600'
            )}
          >
            <Icon size={18} strokeWidth={2.2} />
            <span className="truncate max-w-full px-1">{shortLabel}</span>
          </NavLink>
        ))}
      </nav>

      {/* Floating "kembali ke atas" / "ke paling bawah" buttons */}
      <div className="no-print fixed z-30 right-4 md:right-6 bottom-20 md:bottom-6 flex flex-col gap-2">
        <button
          type="button"
          onClick={scrollToTop}
          aria-label="Kembali ke atas"
          title="Kembali ke atas"
          className={clsx(
            'h-11 w-11 rounded-full bg-brand-600 text-white shadow-card',
            'flex items-center justify-center transition-all duration-200',
            showTop ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none'
          )}
        >
          <ArrowUp size={20} strokeWidth={2.4} />
        </button>
        <button
          type="button"
          onClick={scrollToBottom}
          aria-label="Ke paling bawah"
          title="Ke paling bawah"
          className={clsx(
            'h-11 w-11 rounded-full bg-white dark:bg-ink-800 text-brand-600 dark:text-brand-400',
            'border border-ink-200 dark:border-ink-700 shadow-card',
            'flex items-center justify-center transition-all duration-200',
            showBottom ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none'
          )}
        >
          <ArrowDown size={20} strokeWidth={2.4} />
        </button>
      </div>
    </>
  );
}
