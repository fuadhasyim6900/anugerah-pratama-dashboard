import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Popup used to "mengerucutkan" (narrow down) a chart or table row into a
 * focused breakdown — e.g. clicking one city, depo, DSR, or item opens this
 * with just that item's detail, instead of permanently expanding the card
 * inline (which is what made pages long to scroll in the first place).
 */
export default function DetailModal({
  open, onClose, title, subtitle, children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="no-print fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-3 sm:p-6 bg-black/50"
      onClick={onClose}
    >
      {/* Header is kept outside the scroll area (shrink-0) so it — and the
          close button — always stay visible, while everything below (which
          can grow long, e.g. full item/ranking lists) scrolls independently
          inside its own max-height area. This applies to every popup that
          uses DetailModal. */}
      <div
        className="card w-full max-w-2xl my-6 sm:my-0 max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-start justify-between gap-4 p-5 pb-4 border-b border-ink-100 dark:border-ink-800 shrink-0">
          <div className="min-w-0">
            <h3 className="font-bold text-sm">{title}</h3>
            {subtitle && <p className="text-xs text-ink-400 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="shrink-0 flex items-center justify-center h-8 w-8 rounded-lg text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-5 pt-4 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
