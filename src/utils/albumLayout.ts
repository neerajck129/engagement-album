import type { AlbumConfig, PageRule } from '../config/albumConfig';

export type PageSize = { width: number; height: number };

/** One physical side of a leaf as handed to the flipbook. */
export type Side =
  | { kind: 'cover'; page: number }
  | { kind: 'page'; page: number }
  | { kind: 'half'; page: number; half: 'left' | 'right' }
  | { kind: 'filler' } // blank back of a leaf — never counted as a PDF page
  | { kind: 'back' }; // closing back cover — never counted as a PDF page

export type BookMode = 'single' | 'double';

export function sidePage(s: Side): number | null {
  return 'page' in s ? s.page : null;
}

/** Resolve the effective rule for each page (1-based). */
export function resolveRules(config: AlbumConfig, sizes: PageSize[]): PageRule[] {
  const base = sizes[config.coverPage - 1] ?? sizes[0];
  const baseAspect = base.width / base.height;
  return sizes.map((s, i) => {
    const explicit = config.layout.rules[i + 1];
    if (explicit) return explicit;
    const aspect = s.width / s.height;
    if (config.layout.autoDetectPanorama && aspect / baseAspect >= 1.7) return 'panorama';
    return config.layout.defaultRule;
  });
}

/**
 * Turn the PDF page list + rules into the ordered list of sides for the flip engine.
 *
 * Two-page mode follows StPageFlip's "showCover" model:
 *   index 0 = cover (alone) · (1,2) (3,4) (5,6) … = spreads · last index = back cover (alone)
 * so LEFT slots are odd indices and RIGHT slots are even indices. Fillers are inserted only to keep
 * singles / connected spreads on the right slots; pages are never duplicated, dropped or reordered.
 */
export function buildSides(config: AlbumConfig, sizes: PageSize[], mode: BookMode): Side[] {
  const total = sizes.length;
  const rules = resolveRules(config, sizes);
  const cover = config.coverPage;
  const sides: Side[] = [{ kind: 'cover', page: cover }];
  const dbl = mode === 'double';
  const isLeftSlot = () => sides.length % 2 === 1;

  for (let p = 1; p <= total; p++) {
    if (p === cover) continue;
    const rule = rules[p - 1];

    if (rule === 'panorama' && !dbl) {
      // One-page view (portrait phones): show the real page whole — never split it.
      sides.push({ kind: 'page', page: p });
    } else if (rule === 'panorama') {
      if (dbl && !isLeftSlot()) sides.push({ kind: 'filler' });
      sides.push({ kind: 'half', page: p, half: 'left' }, { kind: 'half', page: p, half: 'right' });
    } else if (rule === 'spread-left' && p < total && p + 1 !== cover) {
      if (dbl && !isLeftSlot()) sides.push({ kind: 'filler' });
      sides.push({ kind: 'page', page: p }, { kind: 'page', page: p + 1 });
      p++; // partner consumed
    } else if (rule === 'single' && dbl) {
      if (isLeftSlot()) sides.push({ kind: 'filler' }); // single sits on the right
      sides.push({ kind: 'page', page: p });
    } else {
      sides.push({ kind: 'page', page: p });
    }
  }

  if (config.layout.closingPage) {
    // Back cover must be alone at the final (odd) index in two-page mode.
    if (dbl && sides.length % 2 === 0) sides.push({ kind: 'filler' });
    sides.push({ kind: 'back' });
  } else if (dbl && sides.length % 2 === 1) {
    sides.push({ kind: 'filler' });
  }
  return sides;
}

/** Sides visible for a given flipbook index (index = first side of the visible spread). */
export function visibleSides(sides: Side[], index: number, mode: BookMode): Side[] {
  if (mode === 'single' || index === 0 || index >= sides.length - 1) return [sides[index]].filter(Boolean);
  return [sides[index], sides[index + 1]].filter(Boolean);
}

/** Visible real PDF page numbers (sorted, unique). */
export function visiblePages(sides: Side[], index: number, mode: BookMode): number[] {
  const set = new Set<number>();
  for (const s of visibleSides(sides, index, mode)) {
    const p = sidePage(s);
    if (p !== null) set.add(p);
  }
  return [...set].sort((a, b) => a - b);
}

/** First side index showing a PDF page, mapped to a valid flipbook index for the mode. */
export function indexForPage(sides: Side[], page: number, mode: BookMode): number {
  let i = sides.findIndex((s) => sidePage(s) === page);
  if (i < 0) i = 0;
  if (mode === 'double' && i > 0 && i % 2 === 0 && i < sides.length - 1) i -= 1; // right slot → spread starts on the left slot
  return i;
}

/** Real pages to keep rendered around an index. */
export function pagesAround(sides: Side[], index: number, radius: number): number[] {
  const out: number[] = [];
  const lo = Math.max(0, index - radius);
  const hi = Math.min(sides.length - 1, index + radius + 1);
  for (let i = lo; i <= hi; i++) {
    const p = sidePage(sides[i]);
    if (p !== null && !out.includes(p)) out.push(p);
  }
  return out;
}

/** Most common page aspect ratio in the PDF (ties go to the cover's). Used for one-page view. */
export function dominantAspect(sizes: PageSize[], coverPage: number): number {
  const buckets = new Map<number, { n: number; sum: number }>();
  sizes.forEach((s) => {
    const a = s.width / s.height;
    const k = Math.round(a * 20);
    const b = buckets.get(k) ?? { n: 0, sum: 0 };
    b.n++;
    b.sum += a;
    buckets.set(k, b);
  });
  const c = sizes[coverPage - 1] ?? sizes[0];
  const coverKey = Math.round((c.width / c.height) * 20);
  let best = coverKey;
  buckets.forEach((v, k) => {
    if (v.n > (buckets.get(best)?.n ?? 0)) best = k;
  });
  const b = buckets.get(best)!;
  return b.sum / b.n;
}
