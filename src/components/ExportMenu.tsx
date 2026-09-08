import { useState, useRef, useEffect, type RefObject } from 'react';
import { Download, Image as ImageIcon, FileText, Loader2 } from 'lucide-react';
import clsx from 'clsx';

/**
 * Small "Unduh" dropdown button placed on charts and tables. Renders the
 * referenced DOM node to a canvas via html2canvas, then either saves it
 * directly as a PNG or embeds it into a single-page PDF via jsPDF.
 */
export default function ExportMenu({
  targetRef, filename,
}: {
  targetRef: RefObject<HTMLElement | null>;
  filename: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  async function captureCanvas() {
    const node = targetRef.current;
    if (!node) return null;
    const { default: html2canvas } = await import('html2canvas');
    const isDark = document.documentElement.classList.contains('dark');

    // Some charts (e.g. "Peringkat Penjualan DSR" with many DSR selected)
    // are wider than the card and scroll horizontally on screen — marked
    // with data-export-scroll. html2canvas only captures what's currently
    // visible inside a scrolled container, so exporting the live node would
    // cut off everything past the visible slice. Work around it by
    // rendering a temporary, full-width, off-screen clone (overflow made
    // visible) and capturing that instead — the live page is untouched.
    const scrollers = Array.from(
      node.querySelectorAll<HTMLElement>('[data-export-scroll]')
    );
    const needsFullWidthClone = scrollers.some((el) => el.scrollWidth > el.clientWidth + 1);

    let captureNode: HTMLElement = node;
    let cleanup: (() => void) | null = null;

    if (needsFullWidthClone) {
      const clone = node.cloneNode(true) as HTMLElement;
      clone.querySelectorAll<HTMLElement>('[data-export-scroll]').forEach((el) => {
        el.style.overflow = 'visible';
        el.style.width = 'max-content';
      });
      clone.style.position = 'fixed';
      clone.style.top = '0';
      clone.style.left = '-99999px';
      clone.style.width = 'max-content';
      clone.style.maxWidth = 'none';
      clone.style.margin = '0';
      document.body.appendChild(clone);
      captureNode = clone;
      cleanup = () => {
        if (clone.parentNode) clone.parentNode.removeChild(clone);
      };
    }

    try {
      return await html2canvas(captureNode, {
        backgroundColor: isDark ? '#0b0b0f' : '#ffffff',
        scale: Math.min(2, window.devicePixelRatio || 1.5),
        useCORS: true,
        // Never include the "Unduh" button/dropdown itself, nor any chart
        // tooltip that happened to be open (hover state) when the export
        // was triggered — neither is part of the chart/table content.
        ignoreElements: (el) =>
          el.hasAttribute('data-export-ignore') ||
          el.classList.contains('recharts-tooltip-wrapper'),
        // html2canvas measures the custom webfont ("Plus Jakarta Sans")
        // incorrectly, which clips text vertically inside fixed-height
        // containers (e.g. the filter dropdown buttons). html2canvas builds
        // an invisible off-screen copy of the page to capture from — this
        // callback runs on that copy only, so it has no visible effect on the
        // live page — so swap that copy to safe, already-loaded system fonts
        // whose metrics it measures correctly, avoiding the clipping.
        onclone: (clonedDoc) => {
          const style = clonedDoc.createElement('style');
          style.textContent = `
            * {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
            }
          `;
          clonedDoc.head.appendChild(style);
        },
      });
    } finally {
      cleanup?.();
    }
  }

  // Close the dropdown and wait for React to re-render + the browser to
  // paint before capturing, otherwise html2canvas can still see the open
  // menu (and it ends up covering the data underneath in the exported image).
  function closeAndSettle() {
    setOpen(false);
    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  }

  async function downloadAsImage() {
    if (busy) return;
    setBusy(true);
    await closeAndSettle();
    try {
      const canvas = await captureCanvas();
      if (!canvas) return;
      const link = document.createElement('a');
      link.download = `${filename}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
    } finally {
      setBusy(false);
    }
  }

  async function downloadAsPdf() {
    if (busy) return;
    setBusy(true);
    await closeAndSettle();
    try {
      const canvas = await captureCanvas();
      if (!canvas) return;
      const { default: jsPDF } = await import('jspdf');
      const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait';
      const pdf = new jsPDF({ orientation, unit: 'pt', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const maxW = pageW - margin * 2;
      const maxH = pageH - margin * 2;
      const ratio = Math.min(maxW / canvas.width, maxH / canvas.height);
      const w = canvas.width * ratio;
      const h = canvas.height * ratio;
      const x = (pageW - w) / 2;
      const y = (pageH - h) / 2;
      pdf.addImage(canvas.toDataURL('image/png', 1.0), 'PNG', x, y, w, h);
      pdf.save(`${filename}.pdf`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative shrink-0 no-print" ref={ref} data-export-ignore="true">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        title="Unduh sebagai gambar atau PDF"
        className="flex items-center gap-1.5 text-xs font-semibold rounded-lg border border-ink-200 dark:border-ink-700 bg-ink-50 dark:bg-ink-800 px-2.5 py-1.5 hover:bg-ink-100 dark:hover:bg-ink-700 transition-colors disabled:opacity-60"
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
        <span className="hidden sm:inline">Unduh</span>
      </button>

      {open && (
        <div className="absolute z-50 right-0 mt-1 w-44 rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 shadow-card p-1">
          <button
            type="button"
            onClick={downloadAsImage}
            className={clsx(
              'w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-xs font-semibold text-left hover:bg-ink-50 dark:hover:bg-ink-800'
            )}
          >
            <ImageIcon size={14} className="text-ink-400" /> Sebagai Gambar (PNG)
          </button>
          <button
            type="button"
            onClick={downloadAsPdf}
            className={clsx(
              'w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-xs font-semibold text-left hover:bg-ink-50 dark:hover:bg-ink-800'
            )}
          >
            <FileText size={14} className="text-ink-400" /> Sebagai PDF
          </button>
        </div>
      )}
    </div>
  );
}
