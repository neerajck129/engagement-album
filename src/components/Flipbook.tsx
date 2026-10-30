import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react';
import HTMLFlipBook from 'react-pageflip';
import gsap from 'gsap';
import type { PdfAlbum } from '../utils/pdfRenderer';
import type { BookMode, Side } from '../utils/albumLayout';
import type { AlbumConfig } from '../config/albumConfig';
import PageSide from './PageSide';

// react-pageflip ships loose typings (every setting required) — wrap once, here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Book = HTMLFlipBook as unknown as React.ForwardRefExoticComponent<any>;

export type FlipbookHandle = {
  next: () => void;
  prev: () => void;
  /** Animated jump to the spread containing side `index`. */
  goTo: (index: number) => void;
};

type Props = {
  album: PdfAlbum;
  sides: Side[];
  mode: BookMode;
  bookWidth: number;
  bookHeight: number;
  pageAspect: number;
  startIndex: number;
  config: AlbumConfig;
  reducedMotion: boolean;
  onFlip: (index: number) => void;
  onTurnStart: () => void;
};

const Flipbook = forwardRef<FlipbookHandle, Props>(function Flipbook(props, ref) {
  const { album, sides, mode, bookWidth, bookHeight, pageAspect, startIndex, config, reducedMotion } = props;
  const bookRef = useRef<{ pageFlip: () => any } | null>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const shellRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef(startIndex);
  const cb = useRef({ onFlip: props.onFlip, onTurnStart: props.onTurnStart });
  cb.current = { onFlip: props.onFlip, onTurnStart: props.onTurnStart };
  const last = sides.length - 1;
  const double = mode === 'double';

  const shiftFor = useCallback(
    (index: number, flipping: boolean) => {
      if (!double || flipping) return 0;
      if (index === 0) return -bookWidth / 4; // closed front cover sits centred
      if (index >= last) return bookWidth / 4; // closed back cover sits centred
      return 0;
    },
    [double, bookWidth, last],
  );

  const applyShift = useCallback(
    (index: number, flipping: boolean, instant = false) => {
      const el = shellRef.current;
      if (!el) return;
      const x = shiftFor(index, flipping);
      gsap.to(el, {
        x,
        duration: instant || reducedMotion ? 0 : flipping ? config.animation.flippingTimeMs / 1000 : 0.6,
        ease: 'power2.inOut',
        overwrite: 'auto',
      });
    },
    [shiftFor, reducedMotion, config.animation.flippingTimeMs],
  );

  // Decorations (shadow / spine / page-edge stack) follow the visible state via data attributes.
  const setDeco = useCallback(
    (index: number, flipping: boolean) => {
      const el = shellRef.current;
      if (!el) return;
      const state = flipping ? 'open' : index === 0 ? 'front' : index >= last ? 'back' : 'open';
      el.dataset.state = double ? state : 'open';
      const p = last > 0 ? index / last : 0;
      el.style.setProperty('--edge-left', `${(2 + 6 * p).toFixed(1)}px`);
      el.style.setProperty('--edge-right', `${(2 + 6 * (1 - p)).toFixed(1)}px`);
    },
    [last, double],
  );

  useImperativeHandle(ref, () => ({
    next: () => bookRef.current?.pageFlip()?.flipNext(),
    prev: () => bookRef.current?.pageFlip()?.flipPrev(),
    goTo: (i: number) => {
      const pf = bookRef.current?.pageFlip();
      if (!pf) return;
      if (reducedMotion) pf.turnToPage(i);
      else pf.flip(i);
    },
  }));

  // StPageFlip only treats a touch as a tap after a 250 ms hold, so quick taps would do nothing on phones.
  // Handle short taps here (never overlapping its own tap/swipe/drag paths): left/right zones turn pages,
  // and tapping the closed cover opens the album.
  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    let start: { x: number; y: number; t: number } | null = null;
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      start = e.touches.length === 1 ? { x: t.clientX, y: t.clientY, t: Date.now() } : null;
    };
    const onEnd = (e: TouchEvent) => {
      if (!start) return;
      const t = e.changedTouches[0];
      const moved = Math.max(Math.abs(t.clientX - start.x), Math.abs(t.clientY - start.y));
      const held = Date.now() - start.t;
      start = null;
      if (moved > 10 || held >= 240) return;
      const r = el.getBoundingClientRect();
      const rel = (t.clientX - r.left) / r.width;
      const pf = bookRef.current?.pageFlip();
      if (!pf) return;
      if (double) {
        if (rel < 0.5) pf.flipPrev();
        else pf.flipNext();
      } else if (indexRef.current === 0 || rel > 0.7) pf.flipNext();
      else if (rel < 0.3) pf.flipPrev();
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchend', onEnd);
    };
  }, [double]);

  // Intro: gentle fade/scale of the book when it first appears.
  useLayoutEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    setDeco(startIndex, false);
    gsap.set(el, { x: shiftFor(startIndex, false) });
    if (!reducedMotion) gsap.fromTo(el, { opacity: 0, scale: 0.97, y: 8 }, { opacity: 1, scale: 1, y: 0, duration: 0.9, ease: 'power2.out' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the engine in sync with our container size (no remount, no re-render of the PDF).
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try {
        bookRef.current?.pageFlip()?.update();
      } catch {
        /* engine not ready yet */
      }
      applyShift(indexRef.current, false, true);
    });
    return () => cancelAnimationFrame(id);
  }, [bookWidth, bookHeight, applyShift]);

  // The engine registers its callbacks once, so route them through a ref that always holds the latest logic.
  const impl = useRef({
    flip: (_e: { data: number }) => {},
    state: (_e: { data: string }) => {},
  });
  impl.current = {
    flip: (e) => {
      indexRef.current = e.data;
      setDeco(e.data, false);
      applyShift(e.data, false);
      cb.current.onFlip(e.data);
    },
    state: (e) => {
      if (e.data === 'flipping' || e.data === 'user_fold') {
        setDeco(indexRef.current, true);
        applyShift(indexRef.current, true);
        if (e.data === 'flipping') cb.current.onTurnStart();
      } else if (e.data === 'read') {
        setDeco(indexRef.current, false);
        applyShift(indexRef.current, false);
      }
    },
  };
  const handleFlip = useCallback((e: { data: number }) => impl.current.flip(e), []);
  const handleState = useCallback((e: { data: string }) => impl.current.state(e), []);

  const pages = useMemo(
    () => sides.map((s, i) => <PageSide key={`${mode}-${i}`} side={s} album={album} config={config} total={album.numPages} />),
    [sides, mode, album, config],
  );

  const aspectBase = 1000;
  return (
    <div
      ref={shellRef}
      className="book-shell"
      data-mode={mode}
      data-state="open"
      style={{ width: bookWidth, height: bookHeight }}
    >
      <div className="book-shadow" aria-hidden="true" />
      {double && <div className="book-edge book-edge-left" aria-hidden="true" />}
      {double && <div className="book-edge book-edge-right" aria-hidden="true" />}
      <Book
        ref={bookRef}
        className="album-book"
        style={{ width: bookWidth, height: bookHeight }}
        width={Math.round(pageAspect * aspectBase)}
        height={aspectBase}
        size="stretch"
        minWidth={mode === 'single' ? 3000 : 100}
        maxWidth={8000}
        minHeight={100}
        maxHeight={8000}
        startPage={startIndex}
        showCover={true}
        usePortrait={mode === 'single'}
        autoSize={false}
        drawShadow={!reducedMotion}
        maxShadowOpacity={config.animation.maxShadowOpacity}
        flippingTime={reducedMotion ? 220 : config.animation.flippingTimeMs}
        mobileScrollSupport={false}
        clickEventForward={true}
        useMouseEvents={true}
        swipeDistance={30}
        showPageCorners={!reducedMotion}
        disableFlipByClick={false}
        startZIndex={0}
        renderOnlyPageLengthChange={true}
        onFlip={handleFlip}
        onChangeState={handleState}
      >
        {pages}
      </Book>
      <div className="book-spine" aria-hidden="true" />
    </div>
  );
});

export default Flipbook;
