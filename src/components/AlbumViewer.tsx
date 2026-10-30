import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { albumConfig as config } from '../config/albumConfig';
import { PdfAlbum, PdfLoadError } from '../utils/pdfRenderer';
import { buildSides, dominantAspect, indexForPage, pagesAround, visiblePages } from '../utils/albumLayout';
import { detectMobile, useResponsiveAlbum } from '../hooks/useResponsiveAlbum';
import { useAudio } from '../hooks/useAudio';
import Flipbook, { type FlipbookHandle } from './Flipbook';
import AlbumToolbar from './AlbumToolbar';
import ThumbnailPanel from './ThumbnailPanel';
import OrientationPrompt from './OrientationPrompt';
import { AlbumError, AlbumLoader } from './AlbumLoader';

const PROMPT_KEY = 'album:orientation-prompt-dismissed';

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

type FsRoot = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
type FsDoc = Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => Promise<void> };

export default function AlbumViewer() {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<FlipbookHandle>(null);

  const [album, setAlbum] = useState<PdfAlbum | null>(null);
  const [error, setError] = useState<{ kind: string; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loaderGone, setLoaderGone] = useState(false);
  const [index, setIndex] = useState(0);
  const [thumbsOpen, setThumbsOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [immersive, setImmersive] = useState(false); // fullscreen fallback (e.g. iPhone Safari)
  const [promptDismissed, setPromptDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(PROMPT_KEY) === '1';
    } catch {
      return false;
    }
  });
  const reducedMotion = usePrefersReducedMotion();
  const audio = useAudio(config);

  // ---------- theme ----------
  const themeVars = useMemo(
    () =>
      ({
        '--ivory': config.theme.ivory,
        '--cream': config.theme.cream,
        '--charcoal': config.theme.charcoal,
        '--muted': config.theme.muted,
        '--gold': config.theme.gold,
        '--line': config.theme.border,
      }) as React.CSSProperties,
    [],
  );

  // ---------- load the PDF (locally, via PDF.js) ----------
  useEffect(() => {
    let cancelled = false;
    let instance: PdfAlbum | null = null;
    setError(null);
    setAlbum(null);
    setRevealed(false);
    setLoaderGone(false);
    const mobile = detectMobile();
    const r = config.rendering;
    PdfAlbum.load(config.pdfPath, {
      format: r.format,
      quality: r.quality,
      thumbnailWidth: r.thumbnailWidth,
      ...(mobile ? r.mobile : r.desktop),
    })
      .then((a) => {
        if (cancelled) return a.dispose();
        instance = a;
        setAlbum(a);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        console.error('[album] load failed', e);
        const err = e instanceof PdfLoadError ? e : new PdfLoadError('unknown', (e as Error)?.message ?? 'Unknown error');
        setError({ kind: err.kind, message: err.message });
      });
    return () => {
      cancelled = true;
      instance?.dispose();
    };
  }, [attempt]);

  // ---------- geometry ----------
  const coverPage = album ? Math.min(Math.max(1, config.coverPage), album.numPages) : 1;
  // Two-page view uses the cover's proportions; one-page view uses the album's dominant page shape so that
  // real pages (e.g. 16:10 spreads) are shown whole instead of being split.
  const aspects = useMemo(
    () =>
      album
        ? { double: album.sizes[coverPage - 1].width / album.sizes[coverPage - 1].height, single: dominantAspect(album.sizes, coverPage) }
        : { double: 0, single: 0 },
    [album, coverPage],
  );
  const resp = useResponsiveAlbum(stageRef, aspects, config, !!album);
  const pageAspect = resp.pageAspect;
  const ready = !!album && resp.bookWidth > 0;

  const sides = useMemo(() => (album && ready ? buildSides({ ...config }, album.sizes, resp.mode) : []), [album, ready, resp.mode]);

  // The reader's place survives layout changes: remember the real page, not the side index.
  const anchor = useRef<{ page: number; back: boolean }>({ page: 1, back: false });
  const startIndex = useMemo(
    () => (sides.length ? (anchor.current.back ? sides.length - 1 : indexForPage(sides, anchor.current.page, resp.mode)) : 0),
    [sides, resp.mode],
  );
  useEffect(() => {
    setIndex(startIndex);
  }, [startIndex, sides]);

  const pagesNow = useMemo(() => (sides.length ? visiblePages(sides, index, resp.mode) : []), [sides, index, resp.mode]);
  const atBack = sides.length > 0 && index >= sides.length - 1;
  const atCover = index === 0;

  const onFlip = useCallback(
    (i: number) => {
      setIndex(i);
      const vp = visiblePages(sides, i, resp.mode);
      anchor.current = vp.length ? { page: vp[0], back: false } : { page: anchor.current.page, back: i >= sides.length - 1 };
    },
    [sides, resp.mode],
  );

  // ---------- render window: only pages near the reader are kept as images ----------
  useEffect(() => {
    if (!album || !sides.length) return;
    const vis = visiblePages(sides, index, resp.mode);
    const around = pagesAround(sides, index, resp.mode === 'single' ? 2 : 3);
    const origin = vis[0] ?? around[0] ?? 1;
    const ordered = [...vis, ...around.filter((p) => !vis.includes(p)).sort((a, b) => Math.abs(a - origin) - Math.abs(b - origin))];
    album.setActive(ordered, resp.pageWidth, resp.mode === 'double');
  }, [album, sides, index, resp.mode, resp.pageWidth]);

  // ---------- reveal once the cover is actually painted-ready ----------
  useEffect(() => {
    if (!album || !ready || revealed) return;
    let alive = true;
    const first = anchor.current.back ? album.numPages : anchor.current.page;
    album.ensure(first, resp.pageWidth, resp.mode === 'double').then(() => alive && setRevealed(true));
    return () => {
      alive = false;
    };
  }, [album, ready, revealed, resp.pageWidth]);
  useEffect(() => {
    if (!revealed) return;
    const t = window.setTimeout(() => setLoaderGone(true), 800);
    return () => window.clearTimeout(t);
  }, [revealed]);

  // ---------- fullscreen ----------
  useEffect(() => {
    const on = () => setFullscreen(!!(document.fullscreenElement || (document as FsDoc).webkitFullscreenElement));
    document.addEventListener('fullscreenchange', on);
    document.addEventListener('webkitfullscreenchange', on);
    return () => {
      document.removeEventListener('fullscreenchange', on);
      document.removeEventListener('webkitfullscreenchange', on);
    };
  }, []);
  const toggleFullscreen = useCallback(async () => {
    const root = rootRef.current as FsRoot | null;
    const doc = document as FsDoc;
    try {
      if (document.fullscreenElement || doc.webkitFullscreenElement) {
        await (document.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
      } else if (root?.requestFullscreen) {
        await root.requestFullscreen();
      } else if (root?.webkitRequestFullscreen) {
        await root.webkitRequestFullscreen();
      } else {
        setImmersive((v) => !v); // fallback: hide chrome to maximise the book
      }
    } catch {
      setImmersive((v) => !v);
    }
  }, []);
  const isFull = fullscreen || immersive;

  // ---------- actions ----------
  const next = useCallback(() => bookRef.current?.next(), []);
  const prev = useCallback(() => bookRef.current?.prev(), []);
  const goToPage = useCallback(
    (page: number) => {
      setThumbsOpen(false);
      if (sides.length) bookRef.current?.goTo(indexForPage(sides, page, resp.mode));
    },
    [sides, resp.mode],
  );

  // ---------- keyboard ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.closest('input,textarea,select,[contenteditable="true"],[data-no-shortcuts]') || t.isContentEditable)) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prev();
      } else if (e.key === 'Escape') {
        if (thumbsOpen) setThumbsOpen(false);
        else if (immersive) setImmersive(false);
        // native fullscreen exits itself on Escape
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, thumbsOpen, immersive]);

  // ---------- orientation prompt ----------
  const showPrompt =
    config.features.orientationPrompt && revealed && resp.isMobile && resp.isPortrait && !promptDismissed && resp.mode === 'single';
  const dismissPrompt = useCallback(() => {
    setPromptDismissed(true);
    try {
      sessionStorage.setItem(PROMPT_KEY, '1');
    } catch {
      /* private mode */
    }
  }, []);
  useEffect(() => {
    // once they rotate to landscape the hint has done its job
    if (config.features.orientationPrompt && resp.isMobile && !resp.isPortrait && !promptDismissed && revealed) dismissPrompt();
  }, [resp.isMobile, resp.isPortrait, promptDismissed, revealed, dismissPrompt]);

  const compact = resp.compact || isFull;
  const hideHeader = compact || immersive;

  if (error) {
    return (
      <div ref={rootRef} style={themeVars}>
        <AlbumError config={config} kind={error.kind} message={error.message} onRetry={() => setAttempt((a) => a + 1)} />
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      style={{ ...themeVars, height: '100dvh' }}
      className="flex w-full flex-col bg-ivory pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] select-none"
    >
      {!hideHeader && (
        <header className="shrink-0 px-6 pt-5 pb-1 text-center">
          <p className="text-[10px] tracking-[0.34em] text-gold uppercase">Engagement Album</p>
          <h1 className="mt-1 font-serif text-2xl leading-tight text-charcoal sm:text-3xl">{config.title}</h1>
          <p className="mt-0.5 text-[11px] tracking-[0.18em] text-muted uppercase">
            {config.brideName} · {config.engagementDate}
          </p>
        </header>
      )}

      <main
        ref={stageRef}
        aria-label={`${config.title} — flipbook`}
        className={`relative flex min-h-0 flex-1 items-center justify-center overflow-hidden ${
          compact ? 'p-2' : 'p-4 sm:p-6'
        }`}
        style={{ background: 'radial-gradient(120% 90% at 50% 40%, var(--ivory) 55%, var(--cream) 100%)' }}
      >
        {album && ready && sides.length > 0 && (
          <Flipbook
            key={`${resp.mode}-${attempt}`}
            ref={bookRef}
            album={album}
            sides={sides}
            mode={resp.mode}
            bookWidth={resp.bookWidth}
            bookHeight={resp.bookHeight}
            pageAspect={pageAspect}
            startIndex={startIndex}
            config={config}
            reducedMotion={reducedMotion}
            onFlip={onFlip}
            onTurnStart={audio.playTurn}
          />
        )}
      </main>

      {album && ready && (
        <div className={compact ? 'pt-1' : 'pt-3'}>
          <AlbumToolbar
            config={config}
            compact={compact}
            atCover={atCover}
            canPrev={!atCover}
            canNext={!atBack}
            pages={pagesNow}
            total={album.numPages}
            fullscreen={isFull}
            soundAvailable={audio.available}
            soundOn={audio.enabled}
            thumbsOpen={thumbsOpen}
            onPrev={prev}
            onNext={next}
            onOpen={next}
            onToggleThumbs={() => setThumbsOpen((v) => !v)}
            onToggleFullscreen={toggleFullscreen}
            onToggleSound={audio.toggle}
            downloadHref={config.pdfPath}
            downloadName={config.downloadFileName}
          />
        </div>
      )}

      {album && config.features.thumbnails && (
        <ThumbnailPanel
          album={album}
          open={thumbsOpen}
          currentPages={pagesNow}
          compact={compact}
          onSelect={goToPage}
          onClose={() => setThumbsOpen(false)}
        />
      )}

      {showPrompt && <OrientationPrompt onDismiss={dismissPrompt} />}

      {!loaderGone && <AlbumLoader config={config} visible={!revealed} />}
    </div>
  );
}
