import { useEffect, useState, createContext, useContext, type ReactNode } from 'react';
import clsx from 'clsx';
import { useUIStore } from '../store/ui';

export interface TabDef {
  id: string;
  label: string;
  icon?: ReactNode;
  /** ids (see navItems.ts / `id="sec-..."` on cards) that live inside this tab,
   *  used so a sidebar "jump to section" click auto-switches to the right tab
   *  before the page scrolls to it. */
  sectionIds: string[];
}

const ActiveTabContext = createContext<string | null>(null);

/**
 * Groups a page's cards into themed tabs so only one theme is visible on
 * screen at a time (less scrolling), while keeping every section mounted in
 * the DOM (hidden via CSS, not unmounted) so:
 *  - state inside each section (local filters, selections) isn't lost when
 *    switching tabs, and
 *  - printing / "Laporan Lengkap" export still includes every section (see
 *    the `[data-tab-panel]` print override in index.css).
 *
 * Usage:
 *   <Tabs tabs={TAB_DEFS} storageKey="executive-dashboard">
 *     <TabPanel id="ringkasan">...cards...</TabPanel>
 *     <TabPanel id="wilayah">...cards...</TabPanel>
 *   </Tabs>
 */
export default function Tabs({
  tabs, storageKey, children,
}: { tabs: TabDef[]; storageKey: string; children: ReactNode }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const scrollTargetId = useUIStore((s) => s.scrollTargetId);

  // Jumping here from the sidebar's section list should land on the right
  // tab first, otherwise scrollIntoView on a display:none section is a no-op.
  useEffect(() => {
    if (!scrollTargetId) return;
    const owner = tabs.find((t) => t.sectionIds.includes(scrollTargetId));
    if (owner) setActive(owner.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollTargetId]);

  return (
    <ActiveTabContext.Provider value={active}>
      <div
        role="tablist"
        aria-label="Kelompok tema halaman"
        className="no-print flex flex-wrap gap-1.5 p-1 rounded-xl bg-ink-100/70 dark:bg-ink-800/60 w-fit max-w-full overflow-x-auto"
        data-storage-key={storageKey}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={active === t.id}
            onClick={() => setActive(t.id)}
            className={clsx(
              'flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors',
              active === t.id
                ? 'bg-white dark:bg-ink-900 text-brand-600 shadow-card'
                : 'text-ink-500 dark:text-ink-400 hover:text-ink-700 dark:hover:text-ink-200'
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
      <div className="space-y-4 sm:space-y-6">{children}</div>
    </ActiveTabContext.Provider>
  );
}

/** Wraps the content that belongs to one TabDef.id — must be a descendant of <Tabs>. */
export function TabPanel({ id, children }: { id: string; children: ReactNode }) {
  const active = useContext(ActiveTabContext);
  return (
    <div data-tab-panel data-tab-id={id} className={active === id ? 'space-y-4 sm:space-y-6' : 'hidden'}>
      {children}
    </div>
  );
}
