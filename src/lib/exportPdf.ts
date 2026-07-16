// Export via the browser's native print dialog — this gives the user a real
// print preview where they can print directly on paper, or choose
// "Save as PDF" as the destination printer. No third-party PDF rasterizer
// is used, so text stays crisp/selectable and charts (SVG) print natively.

type NavigateFn = (path: string) => void;
let navigateFn: NavigateFn | null = null;
let currentPathGetter: (() => string) | null = null;

export function registerNavigation(navigate: NavigateFn, getPath: () => string) {
  navigateFn = navigate;
  currentPathGetter = getPath;
}

export const REPORT_ROUTES: { path: string; title: string }[] = [
  { path: '/', title: 'Executive Dashboard' },
  { path: '/kinerja-dsr', title: 'Kinerja DSR' },
  { path: '/proyeksi-s2', title: 'Proyeksi Semester' },
  { path: '/review-dsr', title: 'Review Kinerja DSR & Solusi Strategis' },
];

const PAGE_CONTENT_ID = 'page-content';
const FULL_REPORT_CONTAINER_ID = 'full-report-print-container';

function waitForRender(ms = 700) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Print / "save as PDF" the page that's currently on screen (only that page —
 * sidebar, top bar, and filter panel are hidden automatically via the
 * .no-print CSS rule, so only the dashboard content itself is printed).
 */
export async function exportActivePageToPdf(title: string) {
  const originalTitle = document.title;
  // Browsers use document.title as the default file name in the print /
  // "Save as PDF" dialog, so set something meaningful before opening it.
  document.title = `${title} - CV Anugerah Pratama`;

  window.print();

  // Most browsers block on window.print() until the dialog closes, but some
  // (mobile Safari, some Android WebViews) return immediately — restore the
  // title shortly after either way.
  setTimeout(() => { document.title = originalTitle; }, 1000);
}

/**
 * Print / "save as PDF" a merged report containing every dashboard page,
 * each starting on its own page. Since this is a single-page app, only one
 * route's content exists in the DOM at a time — so each page is visited in
 * turn, its rendered content is captured, then all of them are assembled
 * into one hidden "print-only" container that becomes visible just for the
 * duration of the print dialog.
 */
export async function exportFullReportToPdf() {
  if (!navigateFn || !currentPathGetter) {
    window.print();
    return;
  }

  const originalPath = currentPathGetter();
  const sections: { title: string; html: string }[] = [];

  for (const route of REPORT_ROUTES) {
    navigateFn(route.path);
    await waitForRender(900);
    const el = document.getElementById(PAGE_CONTENT_ID);
    if (el) {
      // Strip the id so it doesn't collide with the live route's own
      // #page-content once both exist in the DOM at the same time.
      sections.push({ title: route.title, html: el.outerHTML.replace(`id="${PAGE_CONTENT_ID}"`, '') });
    }
  }

  navigateFn(originalPath);

  // Build the merged, print-only container.
  const container = document.createElement('div');
  container.id = FULL_REPORT_CONTAINER_ID;
  container.className = 'print-only';
  container.innerHTML = sections.map((s) => `
    <section class="full-report-print-page">
      <h2 class="full-report-print-page-title">${escapeHtml(s.title)}</h2>
      ${s.html}
    </section>
  `).join('');
  document.body.appendChild(container);
  document.body.classList.add('printing-full-report');

  const originalTitle = document.title;
  document.title = 'Laporan Lengkap - CV Anugerah Pratama';

  await waitForRender(150);
  window.print();

  const cleanup = () => {
    document.body.classList.remove('printing-full-report');
    container.remove();
    document.title = originalTitle;
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  // Fallback in case `afterprint` doesn't fire (e.g. user cancels on some browsers).
  setTimeout(cleanup, 60000);
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
