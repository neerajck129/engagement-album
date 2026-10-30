import type { AlbumConfig } from '../config/albumConfig';

export function monogramFor(config: AlbumConfig): string {
  if (config.monogram) return config.monogram;
  const letters = config.brideName
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}]/gu, '')[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('');
  return (letters || 'A').toUpperCase();
}
