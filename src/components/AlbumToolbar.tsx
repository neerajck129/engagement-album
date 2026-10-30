import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Download,
  LayoutGrid,
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { AlbumConfig } from '../config/albumConfig';

type Props = {
  config: AlbumConfig;
  compact: boolean;
  atCover: boolean;
  canPrev: boolean;
  canNext: boolean;
  pages: number[];
  total: number;
  fullscreen: boolean;
  soundAvailable: boolean;
  soundOn: boolean;
  thumbsOpen: boolean;
  onPrev: () => void;
  onNext: () => void;
  onOpen: () => void;
  onToggleThumbs: () => void;
  onToggleFullscreen: () => void;
  onToggleSound: () => void;
  downloadHref: string;
  downloadName: string;
};

const pad = (n: number, w: number) => String(n).padStart(w, '0');

function IconButton({
  label,
  onClick,
  disabled,
  pressed,
  children,
  compact,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  children: React.ReactNode;
  compact: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={`grid place-items-center rounded-full text-charcoal transition hover:bg-cream disabled:cursor-default disabled:text-muted/40 disabled:hover:bg-transparent ${
        compact ? 'h-10 w-10' : 'h-10 w-10 sm:h-11 sm:w-11'
      } ${pressed ? 'bg-cream' : ''}`}
    >
      {children}
    </button>
  );
}

export default function AlbumToolbar(p: Props) {
  const [helpOpen, setHelpOpen] = useState(false);
  const f = p.config.features;
  const w = Math.max(2, String(p.total).length);
  const label =
    p.pages.length === 0
      ? `${pad(p.total, w)}`
      : p.pages.length === 1
        ? pad(p.pages[0], w)
        : `${pad(p.pages[0], w)}–${pad(p.pages[p.pages.length - 1], w)}`;
  const icon = 'h-[18px] w-[18px]';

  return (
    <div
      className="relative flex shrink-0 items-center justify-center px-3 pb-[max(env(safe-area-inset-bottom),8px)]"
      data-toolbar
    >
      <div
        role="toolbar"
        aria-label="Album controls"
        className={`flex items-center gap-1 rounded-full border border-line bg-ivory/90 px-2 shadow-[0_10px_30px_-18px_rgba(48,45,41,0.5)] backdrop-blur ${
          p.compact ? 'py-0.5' : 'py-1'
        }`}
      >
        {f.thumbnails && (
          <IconButton label="Show page thumbnails" pressed={p.thumbsOpen} onClick={p.onToggleThumbs} compact={p.compact}>
            <LayoutGrid className={icon} strokeWidth={1.5} />
          </IconButton>
        )}

        <IconButton label="Previous page" onClick={p.onPrev} disabled={!p.canPrev} compact={p.compact}>
          <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
        </IconButton>

        {p.atCover ? (
          <button
            type="button"
            onClick={p.onOpen}
            className={`mx-1 whitespace-nowrap rounded-full border border-gold px-4 text-[11px] tracking-[0.14em] sm:px-5 sm:text-[12px] sm:tracking-[0.16em] text-charcoal uppercase transition hover:bg-gold/10 ${
              p.compact ? 'h-8' : 'h-9'
            }`}
          >
            Open Album
          </button>
        ) : (
          <span
            aria-live="polite"
            aria-label={`Page ${label} of ${p.total}`}
            className="min-w-[6.5ch] whitespace-nowrap px-1.5 text-center sm:min-w-[7.5ch] sm:px-2 text-[13px] tracking-[0.12em] tabular-nums text-charcoal"
          >
            {label}
            <span className="text-muted"> / {pad(p.total, w)}</span>
          </span>
        )}

        <IconButton label="Next page" onClick={p.onNext} disabled={!p.canNext} compact={p.compact}>
          <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
        </IconButton>

        {p.soundAvailable && (
          <IconButton
            label={p.soundOn ? 'Mute sound' : 'Turn sound on'}
            pressed={p.soundOn}
            onClick={p.onToggleSound}
            compact={p.compact}
          >
            {p.soundOn ? <Volume2 className={icon} strokeWidth={1.5} /> : <VolumeX className={icon} strokeWidth={1.5} />}
          </IconButton>
        )}
        {f.fullscreen && (
          <IconButton
            label={p.fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            onClick={p.onToggleFullscreen}
            compact={p.compact}
          >
            {p.fullscreen ? <Minimize className={icon} strokeWidth={1.5} /> : <Maximize className={icon} strokeWidth={1.5} />}
          </IconButton>
        )}
        {f.download && (
          <a
            href={p.downloadHref}
            download={p.downloadName}
            aria-label="Download album PDF"
            title="Download PDF"
            className={`grid place-items-center rounded-full text-charcoal transition hover:bg-cream ${p.compact ? 'h-10 w-10' : 'h-10 w-10 sm:h-11 sm:w-11'}`}
          >
            <Download className={icon} strokeWidth={1.5} />
          </a>
        )}
        {f.help && (
          <IconButton label="Help and gestures" pressed={helpOpen} onClick={() => setHelpOpen((v) => !v)} compact={p.compact}>
            <CircleHelp className={icon} strokeWidth={1.5} />
          </IconButton>
        )}
      </div>

      {helpOpen && (
        <div
          role="dialog"
          aria-label="Help"
          className="absolute bottom-full mb-2 w-[min(92vw,22rem)] rounded-2xl border border-line bg-ivory p-4 text-sm text-charcoal shadow-[0_18px_40px_-18px_rgba(48,45,41,0.5)]"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl">Turning the pages</h2>
            <button
              type="button"
              aria-label="Close help"
              onClick={() => setHelpOpen(false)}
              className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-cream"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
          <ul className="mt-2 space-y-1.5 leading-relaxed text-muted">
            <li>Drag or swipe a page, or tap the page edges, to turn it.</li>
            <li>Hover a page corner to peek, then click or drag to turn.</li>
            <li>
              <kbd className="rounded border border-line bg-cream px-1.5 text-xs text-charcoal">←</kbd>{' '}
              <kbd className="rounded border border-line bg-cream px-1.5 text-xs text-charcoal">→</kbd> turn pages,{' '}
              <kbd className="rounded border border-line bg-cream px-1.5 text-xs text-charcoal">Esc</kbd> closes panels.
            </li>
            <li>Use the grid button to jump to any page.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
