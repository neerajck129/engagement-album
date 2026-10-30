import { useCallback, useEffect, useRef, useState } from 'react';
import type { AlbumConfig } from '../config/albumConfig';

async function audioExists(src: string): Promise<boolean> {
  try {
    const res = await fetch(src, { method: 'HEAD' });
    const type = res.headers.get('content-type') ?? '';
    return res.ok && (type.startsWith('audio') || type.includes('octet-stream') || type.includes('ogg'));
  } catch {
    return false;
  }
}

/** Optional audio. Nothing plays until the visitor taps the sound toggle (autoplay-safe). */
export function useAudio(config: AlbumConfig) {
  const [hasMusic, setHasMusic] = useState(false);
  const [hasTurn, setHasTurn] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const music = useRef<HTMLAudioElement | null>(null);
  const turn = useRef<HTMLAudioElement[]>([]);
  const turnIdx = useRef(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [m, t] = await Promise.all([
        config.features.music ? audioExists(config.audio.musicSrc) : false,
        config.features.pageTurnSound ? audioExists(config.audio.pageTurnSrc) : false,
      ]);
      if (!alive) return;
      if (m) {
        const a = new Audio(config.audio.musicSrc);
        a.loop = true;
        a.volume = config.audio.musicVolume;
        a.preload = 'none';
        music.current = a;
      }
      if (t) {
        turn.current = [0, 1].map(() => {
          const a = new Audio(config.audio.pageTurnSrc);
          a.volume = config.audio.pageTurnVolume;
          a.preload = 'auto';
          return a;
        });
      }
      setHasMusic(m);
      setHasTurn(t);
    })();
    return () => {
      alive = false;
      music.current?.pause();
    };
  }, [config]);

  const toggle = useCallback(() => {
    setEnabled((on) => {
      const next = !on;
      if (next) void music.current?.play().catch(() => undefined);
      else music.current?.pause();
      return next;
    });
  }, []);

  const playTurn = useCallback(() => {
    if (!enabled || !turn.current.length) return;
    const a = turn.current[turnIdx.current++ % turn.current.length];
    a.currentTime = 0;
    void a.play().catch(() => undefined);
  }, [enabled]);

  return { available: hasMusic || hasTurn, enabled, toggle, playTurn };
}
