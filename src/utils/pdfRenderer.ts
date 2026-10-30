// Legacy build: bundles polyfills (e.g. Map.getOrInsertComputed) so older iOS/Android/desktop browsers work too.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import type { PDFDocumentProxy, PDFDocumentLoadingTask } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PageSize } from './albumLayout';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type RenderOptions = {
  format: 'image/jpeg' | 'image/png';
  quality: number;
  maxCachedPages: number;
  maxPixels: number;
  maxDpr: number;
  thumbnailWidth: number;
};

export type PdfErrorKind = 'missing' | 'invalid' | 'render' | 'unknown';
export class PdfLoadError extends Error {
  kind: PdfErrorKind;
  constructor(kind: PdfErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

type Entry = { url: string; width: number; lastUsed: number };
type Job = { id: string; priority: number; run: () => Promise<void> };

/**
 * Loads a PDF locally (never uploaded anywhere) and renders pages on demand to blob-URL images.
 * - Only pages near the viewer are rendered ("active set"); everything else is released.
 * - Renders are serialised through a priority queue so the main thread / worker never floods.
 * - Thumbnails are small, separate and cached.
 */
export class PdfAlbum {
  readonly doc: PDFDocumentProxy;
  readonly sizes: PageSize[];
  private opts: RenderOptions;
  private cache = new Map<number, Entry>();
  private thumbs = new Map<number, string>();
  private thumbPromises = new Map<number, Promise<string>>();
  private listeners = new Map<number, Set<() => void>>();
  private queue: Job[] = [];
  private running = false;
  private active: number[] = [];
  private targetWidth = 600;
  private splitWide = true; // two-page view shows wide pages as two halves → render them 2x wide
  private pending = new Set<string>();
  private disposed = false;
  private tick = 0;

  private task: PDFDocumentLoadingTask;

  private constructor(task: PDFDocumentLoadingTask, doc: PDFDocumentProxy, sizes: PageSize[], opts: RenderOptions) {
    this.task = task;
    this.doc = doc;
    this.sizes = sizes;
    this.opts = opts;
  }

  static async load(url: string, opts: RenderOptions): Promise<PdfAlbum> {
    const task = pdfjs.getDocument({ url });
    let doc: PDFDocumentProxy;
    try {
      doc = await task.promise;
    } catch (e: unknown) {
      const name = (e as { name?: string })?.name ?? '';
      const status = (e as { status?: number })?.status;
      if (name === 'MissingPDFException' || (name === 'ResponseException' && (status === 404 || status === 403))) throw new PdfLoadError('missing', 'The album PDF could not be found.');
      if (name === 'InvalidPDFException' || name === 'FormatError')
        throw new PdfLoadError('invalid', 'The album file is not a valid PDF (or the path is wrong).');
      throw new PdfLoadError('unknown', (e as Error)?.message || 'The album could not be opened.');
    }
    if (doc.numPages < 1) throw new PdfLoadError('invalid', 'The PDF has no pages.');
    // Read real page count and dimensions (in batches — cheap, no rendering).
    const sizes: PageSize[] = new Array(doc.numPages);
    const BATCH = 16;
    for (let start = 1; start <= doc.numPages; start += BATCH) {
      const end = Math.min(doc.numPages, start + BATCH - 1);
      await Promise.all(
        Array.from({ length: end - start + 1 }, async (_, k) => {
          const n = start + k;
          const page = await doc.getPage(n);
          const vp = page.getViewport({ scale: 1 }); // honours /Rotate
          sizes[n - 1] = { width: vp.width, height: vp.height };
          page.cleanup();
        }),
      );
    }
    return new PdfAlbum(task, doc, sizes, opts);
  }

  get numPages() {
    return this.sizes.length;
  }

  // ---------- subscription (used by <PdfImage/>) ----------
  subscribe(page: number, cb: () => void) {
    let set = this.listeners.get(page);
    if (!set) this.listeners.set(page, (set = new Set()));
    set.add(cb);
    return () => set!.delete(cb);
  }
  private notify(page: number) {
    this.listeners.get(page)?.forEach((cb) => cb());
  }
  peek(page: number): string | null {
    const e = this.cache.get(page);
    if (e) e.lastUsed = ++this.tick;
    return e?.url ?? null;
  }

  // ---------- active window ----------
  /** Declare which pages should be rendered now (nearest first) and at what CSS width. */
  setActive(pages: number[], cssWidth: number, splitWide = true) {
    this.splitWide = splitWide;
    if (this.disposed) return;
    this.active = pages;
    const dpr = Math.min(window.devicePixelRatio || 1, this.opts.maxDpr);
    this.targetWidth = Math.max(240, Math.round(cssWidth * dpr));
    // Drop queued page jobs that are no longer wanted.
    this.queue = this.queue.filter((j) => !j.id.startsWith('p:') || pages.includes(Number(j.id.slice(2))));
    pages.forEach((p, i) => this.requestPage(p, i));
    this.evict();
  }

  private requestPage(page: number, rank: number) {
    const sz = this.sizes[page - 1];
    if (!sz) return;
    const want = this.pixelWidthFor(sz);
    const have = this.cache.get(page);
    if (have && have.width >= want * 0.85) return; // good enough; never re-render for tiny differences
    const id = `p:${page}`;
    if (this.pending.has(id)) return;
    this.pending.add(id);
    this.enqueue({ id, priority: rank, run: () => this.renderPage(page, want) });
  }

  private pixelWidthFor(sz: PageSize) {
    let w = this.targetWidth;
    // Wide pages (panoramas) render proportionally wider so each half keeps full detail.
    if (this.splitWide) {
      const base = this.sizes[0];
      w = Math.round(w * Math.max(1, sz.width / sz.height / (base.width / base.height)));
    }
    const h = (w * sz.height) / sz.width;
    if (w * h > this.opts.maxPixels) w = Math.floor(Math.sqrt((this.opts.maxPixels * sz.width) / sz.height));
    return w;
  }

  private async renderPage(page: number, pxWidth: number) {
    if (this.disposed || !this.active.includes(page)) return;
    const url = await this.renderToUrl(page, pxWidth, this.opts.format, this.opts.quality);
    if (this.disposed) return URL.revokeObjectURL(url);
    const old = this.cache.get(page);
    this.cache.set(page, { url, width: pxWidth, lastUsed: ++this.tick });
    this.notify(page);
    // Let the <img> switch to the new URL before releasing the old one.
    if (old) setTimeout(() => URL.revokeObjectURL(old.url), 1500);
    this.evict();
  }

  private evict() {
    const keep = new Set(this.active);
    if (this.cache.size <= this.opts.maxCachedPages) return;
    const victims = [...this.cache.entries()]
      .filter(([p]) => !keep.has(p))
      .sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    while (this.cache.size > this.opts.maxCachedPages && victims.length) {
      const [p, e] = victims.shift()!;
      this.cache.delete(p);
      this.notify(p);
      setTimeout(() => URL.revokeObjectURL(e.url), 1500);
    }
  }

  /** Resolve once a page image exists (used to gate the loader on the cover). */
  ensure(page: number, cssWidth: number, splitWide = true): Promise<void> {
    return new Promise((resolve) => {
      if (this.cache.has(page)) return resolve();
      const off = this.subscribe(page, () => {
        if (this.cache.has(page)) {
          off();
          resolve();
        }
      });
      this.setActive([...new Set([page, ...this.active])], cssWidth, splitWide);
    });
  }

  // ---------- thumbnails ----------
  getThumbnail(page: number): Promise<string> {
    const have = this.thumbs.get(page);
    if (have) return Promise.resolve(have);
    let p = this.thumbPromises.get(page);
    if (!p) {
      p = new Promise<string>((resolve, reject) => {
        this.enqueue({
          id: `t:${page}`,
          priority: 1000 + page,
          run: async () => {
            try {
              const url = await this.renderToUrl(page, this.opts.thumbnailWidth, 'image/jpeg', 0.72);
              if (this.disposed) return URL.revokeObjectURL(url);
              this.thumbs.set(page, url);
              resolve(url);
            } catch (e) {
              reject(e);
            }
          },
        });
      });
      this.thumbPromises.set(page, p);
    }
    return p;
  }

  // ---------- core render ----------
  private async renderToUrl(page: number, pxWidth: number, type: string, quality: number): Promise<string> {
    const p = await this.doc.getPage(page);
    try {
      const base = p.getViewport({ scale: 1 });
      const vp = p.getViewport({ scale: pxWidth / base.width });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(vp.width));
      canvas.height = Math.max(1, Math.floor(vp.height));
      const task = p.render({ canvas, viewport: vp });
      await task.promise;
      const blob: Blob = await new Promise((res, rej) =>
        canvas.toBlob((b) => (b ? res(b) : rej(new PdfLoadError('render', 'Page could not be encoded.'))), type, quality),
      );
      canvas.width = canvas.height = 0; // release the bitmap immediately
      return URL.createObjectURL(blob);
    } finally {
      p.cleanup();
    }
  }

  // ---------- queue ----------
  private enqueue(job: Job) {
    this.queue.push(job);
    this.queue.sort((a, b) => a.priority - b.priority);
    void this.pump();
  }
  private async pump() {
    if (this.running) return;
    this.running = true;
    while (this.queue.length && !this.disposed) {
      const job = this.queue.shift()!;
      try {
        await job.run();
      } catch (e) {
        console.warn('[album] render failed for', job.id, e);
      } finally {
        this.pending.delete(job.id);
      }
      await new Promise((r) => setTimeout(r, 0)); // yield to the UI between renders
    }
    this.running = false;
  }

  dispose() {
    this.disposed = true;
    this.queue = [];
    this.cache.forEach((e) => URL.revokeObjectURL(e.url));
    this.thumbs.forEach((u) => URL.revokeObjectURL(u));
    this.cache.clear();
    this.thumbs.clear();
    this.listeners.clear();
    void this.task.destroy();
  }
}
