import { ArrowUp } from 'lucide-react';

/**
 * Rendered once at the very end of the main content column (see App.tsx),
 * so it shows up after every page's content — not just as a floating
 * button (see BottomNav.tsx), but as an explicit, always-in-the-flow link
 * for people who scroll all the way down and want a clear, labeled way
 * back up rather than hunting for the small floating icon.
 */
export default function PageFooter() {
  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <footer className="no-print px-4 sm:px-6 py-6 mt-4 border-t border-ink-100 dark:border-ink-800">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-[11px] text-ink-400 order-2 sm:order-1">
          © {new Date().getFullYear()} CV Anugerah Pratama · Sales &amp; AO Dashboard
        </p>
        <button
          type="button"
          onClick={scrollToTop}
          className="order-1 sm:order-2 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-ink-200 dark:border-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800 text-ink-600 dark:text-ink-300"
        >
          <ArrowUp size={14} /> Kembali ke Atas
        </button>
      </div>
    </footer>
  );
}
