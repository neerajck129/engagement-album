# Premium Engagement Digital Album

React + Vite + TypeScript + Tailwind v4, StPageFlip (`react-pageflip`), PDF.js, GSAP, Lucide.
The PDF is rendered locally in the browser; nothing is uploaded anywhere.

## Run
1. Put your album at `public/album/engagement-album.pdf` (a neutral placeholder is included; overwrite it).
2. `npm install`
3. `npm run dev`, or `npm run build && npm run preview`

## Configure: `src/config/albumConfig.ts`
- `pdfPath`, `title`, `brideName`, `engagementDate`, `coverPage`, feature toggles, theme colours, breakpoints.
- Page rules (`layout.rules`, keyed by 1-based PDF page):
  - `single`: independent page (pages 2 and 3 by default). In two-page view it sits on the right with the blank back of the previous leaf on its left, so page 2 turns to reveal page 3.
  - `spread-left`: this page and the next form a connected, seam-aligned spread. Example: `{ 6: 'spread-left' }`.
  - `panorama`: one wide PDF page split into left/right halves (pages ~2x the cover width are auto-detected).
  - `auto`: flows into the next free slot.
- Optional audio: add `public/album/audio/music.mp3` and `page-turn.mp3`; if absent the sound control is hidden.

## Structure
`src/utils/pdfRenderer.ts` (load, lazy render, cache, thumbnails), `src/utils/albumLayout.ts` (rules to sides),
`src/hooks/useResponsiveAlbum.ts`, `src/components/*` (AlbumViewer, Flipbook, PageSide, AlbumToolbar, ThumbnailPanel, OrientationPrompt, AlbumLoader).
"# engagement-album" 
