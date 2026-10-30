import { useEffect, useRef, useState } from 'react';
import type { AlbumConfig } from '../config/albumConfig';
import type { BookMode } from '../utils/albumLayout';

export type ResponsiveState = {
  mode: BookMode;
  bookWidth: number; // whole book box (1 or 2 pages)
  bookHeight: number;
  pageWidth: number;
  pageAspect: number; // width/height of ONE page slot in the current mode
  stageWidth: number;
  stageHeight: number;
  isPortrait: boolean; // viewport orientation
  isMobile: boolean; // coarse pointer + small device
  compact: boolean; // short viewport (phone landscape) → minimal chrome
};

const INITIAL: ResponsiveState = {
  mode: 'double',
  bookWidth: 0,
  bookHeight: 0,
  pageWidth: 0,
  pageAspect: 0,
  stageWidth: 0,
  stageHeight: 0,
  isPortrait: false,
  isMobile: false,
  compact: false,
};

export function detectMobile() {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  return coarse && Math.min(window.screen.width, window.screen.height) < 820;
}

/**
 * Measures the stage element (not window.innerWidth) so browser toolbars, safe areas, fullscreen and
 * our own chrome are all accounted for. Chooses single vs two-page mode and the largest book that fits.
 */
export function useResponsiveAlbum(
  stageRef: React.RefObject<HTMLElement | null>,
  aspects: { single: number; double: number }, // page slot aspect (w/h) for one-page and two-page view
  config: AlbumConfig,
  enabled: boolean,
): ResponsiveState {
  const [state, setState] = useState<ResponsiveState>(INITIAL);
  const modeRef = useRef<BookMode>('double');

  useEffect(() => {
    const el = stageRef.current;
    if (!el || !enabled || !aspects.single || !aspects.double) return;
    const aS = aspects.single;
    const aD = aspects.double;
    let raf = 0;
    let timer = 0;
    const bp = config.breakpoints;

    const compute = () => {
      const rect = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const w = Math.max(0, rect.width - padX);
      const h = Math.max(0, rect.height - padY);
      if (w < 40 || h < 40) return;

      const fitSingle = Math.min(w, h * aS);
      const fitDouble = Math.min(w, h * aD * 2); // total width of two pages
      const dPageW = fitDouble / 2;
      const sPageW = fitSingle;
      const sPageH = sPageW / aS;
      const dPageH = dPageW / aD;

      let mode: BookMode =
        w >= bp.doubleMinWidth && dPageW >= bp.minDoublePageWidth && dPageH / sPageH >= bp.minScaleRatio
          ? 'double'
          : 'single';
      // light hysteresis so a few pixels of resize never flips layouts back and forth
      if (mode !== modeRef.current) {
        const margin = 24;
        const wasDouble = modeRef.current === 'double';
        if (wasDouble && w >= bp.doubleMinWidth - margin && dPageW >= bp.minDoublePageWidth - margin && dPageH / sPageH >= bp.minScaleRatio - 0.05)
          mode = 'double';
      }
      modeRef.current = mode;

      const pageWidth = mode === 'double' ? dPageW : sPageW;
      const next: ResponsiveState = {
        mode,
        pageWidth: Math.floor(pageWidth),
        pageAspect: mode === 'double' ? aD : aS,
        bookWidth: Math.floor(pageWidth * (mode === 'double' ? 2 : 1)),
        bookHeight: Math.floor(pageWidth / (mode === 'double' ? aD : aS)),
        stageWidth: Math.round(rect.width),
        stageHeight: Math.round(rect.height),
        isPortrait: window.innerHeight >= window.innerWidth,
        isMobile: detectMobile(),
        compact: window.innerHeight < bp.compactHeight,
      };
      setState((prev) =>
        prev.mode === next.mode &&
        prev.bookWidth === next.bookWidth &&
        prev.bookHeight === next.bookHeight &&
        prev.isPortrait === next.isPortrait &&
        prev.compact === next.compact &&
        prev.isMobile === next.isMobile
          ? prev
          : next,
      );
    };

    const schedule = (immediate = false) => {
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
      if (immediate) raf = requestAnimationFrame(compute);
      else timer = window.setTimeout(() => (raf = requestAnimationFrame(compute)), 90); // debounced
    };

    const ro = new ResizeObserver(() => schedule());
    ro.observe(el);
    const onWin = () => schedule();
    const onOrient = () => {
      // browsers report the new size a beat after the event
      schedule();
      window.setTimeout(() => schedule(true), 250);
    };
    window.addEventListener('resize', onWin);
    window.addEventListener('orientationchange', onOrient);
    window.visualViewport?.addEventListener('resize', onWin);
    schedule(true);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', onWin);
      window.removeEventListener('orientationchange', onOrient);
      window.visualViewport?.removeEventListener('resize', onWin);
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [stageRef, aspects.single, aspects.double, config, enabled]);

  return state;
}
