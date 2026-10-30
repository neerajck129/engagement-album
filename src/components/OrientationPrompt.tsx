import { useEffect, useRef } from 'react';
import { RotateCw } from 'lucide-react';

type Props = { onDismiss: () => void };

/**
 * Tasteful, dismissible first-visit hint for phones in portrait. Sits in the header zone so it never
 * covers the album artwork, and never forces rotation.
 */
export default function OrientationPrompt({ onDismiss }: Props) {
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    btn.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-3 pt-[calc(env(safe-area-inset-top)+8px)]">
      <div
        role="dialog"
        aria-labelledby="orient-title"
        aria-describedby="orient-desc"
        className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-line bg-ivory/95 py-3 pr-2 pl-4 shadow-[0_14px_34px_-16px_rgba(48,45,41,0.5)] backdrop-blur"
      >
        <RotateCw className="h-5 w-5 shrink-0 text-gold" strokeWidth={1.4} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 id="orient-title" className="font-serif text-lg leading-tight text-charcoal">
            A wider view awaits
          </h2>
          <p id="orient-desc" className="mt-0.5 text-[12px] leading-snug text-muted">
            Rotate your phone to landscape for the full two-page album experience.
          </p>
          <button
            ref={btn}
            type="button"
            onClick={onDismiss}
            className="mt-1 -ml-1 min-h-11 px-1 text-[11px] tracking-[0.14em] text-muted uppercase underline decoration-gold/60 underline-offset-4 hover:text-charcoal"
          >
            Continue in portrait
          </button>
        </div>
      </div>
    </div>
  );
}
