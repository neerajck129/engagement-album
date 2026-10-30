import type { AlbumConfig } from '../config/albumConfig';
import { monogramFor } from '../utils/monogram';

type LoaderProps = { config: AlbumConfig; visible: boolean };

/** Warm ivory loading screen: small monogram, quiet gold sweep — no spinner, no progress bar. */
export function AlbumLoader({ config, visible }: LoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ivory transition-opacity duration-700"
      style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none' }}
    >
      <div className="loader-pulse grid h-16 w-16 place-items-center rounded-full border border-gold font-serif text-2xl tracking-[0.12em] text-gold [animation:soft-pulse_2.4s_ease-in-out_infinite]">
        {monogramFor(config)}
      </div>
      <p className="mt-7 font-serif text-xl italic text-charcoal">Preparing your album…</p>
      <div className="mt-5 h-px w-28 overflow-hidden bg-line">
        <div className="loader-sweep h-full w-1/3 bg-gold [animation:gold-sweep_1.8s_ease-in-out_infinite]" />
      </div>
    </div>
  );
}

type ErrorProps = { config: AlbumConfig; message: string; kind: string; onRetry: () => void };

export function AlbumError({ config, message, kind, onRetry }: ErrorProps) {
  return (
    <div role="alert" className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ivory px-6 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full border border-gold font-serif text-xl text-gold">
        {monogramFor(config)}
      </div>
      <h1 className="mt-6 font-serif text-3xl text-charcoal">We couldn’t open the album</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">{message}</p>
      <p className="mt-4 max-w-md rounded-lg border border-line bg-cream px-4 py-3 text-left text-xs leading-relaxed text-muted">
        {kind === 'missing' || kind === 'invalid' ? (
          <>
            Place your PDF at <code className="text-charcoal">public{config.pdfPath}</code> (or change{' '}
            <code className="text-charcoal">pdfPath</code> in <code className="text-charcoal">src/config/albumConfig.ts</code>), then
            reload.
          </>
        ) : (
          <>Try again, or check the browser console for details.</>
        )}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-6 min-h-11 rounded-full border border-gold px-6 text-sm tracking-wide text-charcoal transition hover:bg-gold/10"
      >
        Try again
      </button>
    </div>
  );
}
