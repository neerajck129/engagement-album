import { memo, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { PdfAlbum } from '../utils/pdfRenderer';

type Props = {
  album: PdfAlbum;
  open: boolean;
  currentPages: number[];
  compact: boolean;
  onSelect: (page: number) => void;
  onClose: () => void;
};

const Thumb = memo(function Thumb({
  album,
  page,
  current,
  onSelect,
  root,
}: {
  album: PdfAlbum;
  page: number;
  current: boolean;
  onSelect: (p: number) => void;
  root: React.RefObject<HTMLDivElement | null>;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const sz = album.sizes[page - 1];

  useEffect(() => {
    const el = ref.current;
    if (!el || url) return;
    let alive = true;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          album
            .getThumbnail(page)
            .then((u) => alive && setUrl(u))
            .catch(() => undefined);
        }
      },
      { root: root.current, rootMargin: '200px' },
    );
    io.observe(el);
    return () => {
      alive = false;
      io.disconnect();
    };
  }, [album, page, url, root]);

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onSelect(page)}
      aria-label={`Go to page ${page}`}
      aria-current={current ? 'page' : undefined}
      className={`group flex flex-col items-center gap-1.5 rounded-md p-1.5 transition ${
        current ? 'bg-gold/15' : 'hover:bg-cream'
      }`}
    >
      <span
        className={`block w-full overflow-hidden rounded-[2px] bg-cream shadow-sm ring-1 transition ${
          current ? 'ring-2 ring-gold' : 'ring-line group-hover:ring-gold/60'
        }`}
        style={{ aspectRatio: `${sz.width} / ${sz.height}` }}
      >
        {url && <img src={url} alt="" draggable={false} className="h-full w-full object-contain" />}
      </span>
      <span className={`text-[11px] tabular-nums tracking-wider ${current ? 'text-charcoal' : 'text-muted'}`}>
        {String(page).padStart(2, '0')}
      </span>
    </button>
  );
});

export default function ThumbnailPanel({ album, open, currentPages, compact, onSelect, onClose }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) closeBtn.current?.focus({ preventScroll: true });
  }, [open]);

  if (!open) return null;
  const pages = Array.from({ length: album.numPages }, (_, i) => i + 1);
  return (
    <div className="fixed inset-0 z-30" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Page thumbnails"
        onClick={(e) => e.stopPropagation()}
        className={`absolute inset-x-0 bottom-0 mx-auto flex w-full max-w-4xl flex-col rounded-t-2xl border border-b-0 border-line bg-ivory shadow-[0_-18px_50px_-20px_rgba(48,45,41,0.45)] ${
          compact ? 'max-h-[88dvh]' : 'max-h-[62dvh]'
        } pb-[env(safe-area-inset-bottom)]`}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="font-serif text-xl text-charcoal">Pages</h2>
          <button
            ref={closeBtn}
            type="button"
            onClick={onClose}
            aria-label="Close thumbnails"
            className="grid h-11 w-11 place-items-center rounded-full text-muted transition hover:bg-cream hover:text-charcoal"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>
        <div ref={scroller} className="overflow-y-auto overscroll-contain px-3 pb-4">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-1 sm:grid-cols-[repeat(auto-fill,minmax(92px,1fr))]">
            {pages.map((p) => (
              <Thumb key={p} album={album} page={p} current={currentPages.includes(p)} onSelect={onSelect} root={scroller} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
