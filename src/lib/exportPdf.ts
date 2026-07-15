import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MARGIN_MM = 8;

async function captureElementToPdfPages(pdf: jsPDF, el: HTMLElement, addNewPageBefore: boolean) {
  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: document.documentElement.classList.contains('dark') ? '#0c0c0e' : '#ffffff',
  });

  const usableWidth = A4_WIDTH_MM - MARGIN_MM * 2;
  const usableHeight = A4_HEIGHT_MM - MARGIN_MM * 2;
  const imgWidthMm = usableWidth;
  const imgHeightMm = (canvas.height * imgWidthMm) / canvas.width;

  const imgData = canvas.toDataURL('image/jpeg', 0.92);

  if (imgHeightMm <= usableHeight) {
    if (addNewPageBefore) pdf.addPage();
    pdf.addImage(imgData, 'JPEG', MARGIN_MM, MARGIN_MM, imgWidthMm, imgHeightMm);
  } else {
    // Slice the tall canvas across multiple PDF pages
    const pageCanvasHeightPx = Math.floor((usableHeight * canvas.width) / imgWidthMm);
    let renderedPx = 0;
    let first = true;
    while (renderedPx < canvas.height) {
      const sliceHeightPx = Math.min(pageCanvasHeightPx, canvas.height - renderedPx);
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceHeightPx;
      const ctx = sliceCanvas.getContext('2d')!;
      ctx.drawImage(canvas, 0, renderedPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);
      const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.92);
      const sliceHeightMm = (sliceHeightPx * imgWidthMm) / canvas.width;

      if (addNewPageBefore || !first) pdf.addPage();
      pdf.addImage(sliceData, 'JPEG', MARGIN_MM, MARGIN_MM, imgWidthMm, sliceHeightMm);

      renderedPx += sliceHeightPx;
      first = false;
    }
  }
}

function waitForRender(ms = 700) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function exportActivePageToPdf(title: string) {
  const el = document.getElementById(PAGE_CONTENT_ID);
  if (!el) return;
  const pdf = new jsPDF('p', 'mm', 'a4');
  await captureElementToPdfPages(pdf, el, false);
  pdf.save(`${slugify(title)}.pdf`);
}

export async function exportFullReportToPdf() {
  if (!navigateFn || !currentPathGetter) {
    // Fallback: just export whatever is currently visible
    await exportActivePageToPdf('Laporan-Lengkap');
    return;
  }
  const originalPath = currentPathGetter();
  const pdf = new jsPDF('p', 'mm', 'a4');

  for (let i = 0; i < REPORT_ROUTES.length; i++) {
    const route = REPORT_ROUTES[i];
    navigateFn(route.path);
    await waitForRender(900);
    const el = document.getElementById(PAGE_CONTENT_ID);
    if (el) {
      await captureElementToPdfPages(pdf, el, i > 0);
    }
  }

  navigateFn(originalPath);
  pdf.save('Laporan-Lengkap-CV-Anugerah-Pratama.pdf');
}

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'halaman';
}
