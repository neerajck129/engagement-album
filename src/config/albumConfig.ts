/**
 * Central configuration for the digital album.
 * Everything you are likely to change lives here — the rendering engine never needs editing.
 */

/**
 * How a PDF page is treated in the flipbook:
 *  - 'auto'        : flows into the next free slot (pairs with its neighbour in two-page mode).
 *                    A page whose PDF aspect ratio is ~2x the cover's is auto-detected as 'panorama'.
 *  - 'single'      : an independent page. In two-page mode it sits alone on the right with the
 *                    blank back of the previous leaf on its left (like a single-sided album page).
 *  - 'spread-left' : this page and the NEXT one are a connected two-page spread (seam-aligned,
 *                    no gap). Page n lands on the left, page n+1 on the right.
 *  - 'panorama'    : ONE wide PDF page that crosses the seam; it is split into left/right halves.
 */
export type PageRule = 'auto' | 'single' | 'spread-left' | 'panorama';

export const albumConfig = {
  /** Single place to swap the PDF. Put the file in /public/album/. */
  pdfPath: '/album/engagement-album.pdf',

  title: 'Engagement',
  brideName: 'Ardra CK & Shibu Manayath', // placeholder — replace
  engagementDate: '25th October 2026', // placeholder — replace
  /** Letters shown in the loader / closing page. Leave '' to derive from brideName. */
  monogram: '',

  /** 1-based PDF page used as the front cover. */
  coverPage: 1,

  layout: {
    /** Rule applied to any page not listed in `rules`. */
    defaultRule: 'auto' as PageRule,
    /**
     * Per-page rules, keyed by 1-based PDF page number.
     * Pages 2 and 3 are independent pages that each take part in the normal turning sequence.
     * Example connected spread:  { 6: 'spread-left' }  → pages 6|7 form one seamless spread.
     * Example panorama:          { 9: 'panorama' }      → page 9 is one wide image split at the seam.
     */
    rules: {
      2: 'single', // page 2 is a lone 4:5 page; pages 3+ are double-width spreads (auto-detected as panoramas)
    } as Record<number, PageRule>,
    /** Treat very wide PDF pages (≈2x the cover width) as panoramas automatically. */
    autoDetectPanorama: true,
    /** Add a quiet ivory back cover after the last PDF page. */
    closingPage: true,
  },

  features: {
    music: true, // music toggle (needs audio.musicSrc to exist)
    pageTurnSound: true, // soft page-turn sound (needs audio.pageTurnSrc to exist)
    orientationPrompt: true,
    thumbnails: true,
    fullscreen: true,
    help: true,
    download: true, // download button (links to pdfPath)
  },

  /** File name offered when the visitor downloads the PDF. */
  downloadFileName: 'Engagement-Album.pdf',

  /** Optional. If a file does not exist the sound control is simply hidden. */
  audio: {
    musicSrc: '/album/audio/music.mp3',
    pageTurnSrc: '/album/audio/page-turn.mp3',
    musicVolume: 0.25,
    pageTurnVolume: 0.35,
  },

  theme: {
    ivory: '#F7F3EB',
    cream: '#EEE7DB',
    charcoal: '#302D29',
    muted: '#81786D',
    gold: '#B69A67',
    border: '#DED5C7',
  },

  /** Responsive rules (all values in CSS pixels unless noted). */
  breakpoints: {
    /** Below this stage width the book is always single-page. */
    doubleMinWidth: 560,
    /** Two-page mode needs each page at least this wide … */
    minDoublePageWidth: 190,
    /** … and the two-page book must be at least this fraction as tall as the single-page book. */
    minScaleRatio: 0.5,
    /** Treat stage heights below this as "short" (phone landscape): minimal chrome. */
    compactHeight: 460,
  },

  animation: {
    flippingTimeMs: 900,
    maxShadowOpacity: 0.55,
  },

  rendering: {
    /** 'image/jpeg' keeps photo albums light; use 'image/png' for text/vector-heavy PDFs. */
    format: 'image/jpeg' as 'image/jpeg' | 'image/png',
    quality: 0.92,
    desktop: { maxCachedPages: 10, maxPixels: 12_000_000, maxDpr: 2 },
    mobile: { maxCachedPages: 6, maxPixels: 4_500_000, maxDpr: 2 },
    thumbnailWidth: 180,
  },
};

export type AlbumConfig = typeof albumConfig;
