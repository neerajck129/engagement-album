import { forwardRef, useSyncExternalStore } from 'react';
import type { PdfAlbum } from '../utils/pdfRenderer';
import type { Side } from '../utils/albumLayout';
import type { AlbumConfig } from '../config/albumConfig';
import { monogramFor } from '../utils/monogram';

function PdfImage({ album, page, half }: { album: PdfAlbum; page: number; half?: 'left' | 'right' }) {
  const url = useSyncExternalStore(
    (cb) => album.subscribe(page, cb),
    () => album.peek(page),
  );
  const box = half ? { width: '200%', left: half === 'left' ? 0 : '-100%' } : { width: '100%', left: 0 };
  return (
    <div className="pdf-frame">
      {url ? (
        <img
          src={url}
          alt=""
          draggable={false}
          decoding="async"
          className="pdf-img"
          style={{ position: 'absolute', top: 0, height: '100%', ...box }}
        />
      ) : (
        <div className="pdf-placeholder" aria-hidden="true" />
      )}
    </div>
  );
}

type Props = { side: Side; album: PdfAlbum; config: AlbumConfig; total: number };

/**
 * One physical side. The root element is owned by the flip engine (it rewrites its inline style every
 * frame), so all visuals live in the inner element.
 */
const PageSide = forwardRef<HTMLDivElement, Props>(function PageSide({ side, album, config }, ref) {
  const hard = side.kind === 'cover' || side.kind === 'back';
  return (
    <div ref={ref} className="album-page" data-density={hard ? 'hard' : 'soft'}>
      <div className={`album-page-inner kind-${side.kind}`}>
        {(side.kind === 'cover' || side.kind === 'page') && <PdfImage album={album} page={side.page} />}
        {side.kind === 'half' && <PdfImage album={album} page={side.page} half={side.half} />}
        {side.kind === 'back' && (
          <div className="back-cover">
            <div className="back-mark">{monogramFor(config)}</div>
            <div className="back-rule" />
            <p className="back-title">With love</p>
            <p className="back-sub">
              {config.brideName}
              <br />
              {config.engagementDate}
            </p>
          </div>
        )}
      </div>
    </div>
  );
});

export default PageSide;
