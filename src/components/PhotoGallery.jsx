import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X, Images } from 'lucide-react';

// Photos shown before "Show all" is tapped (one row of the grid)
const COLLAPSED_COUNT = 3;
// Minimum horizontal drag, in px, that counts as a swipe
const SWIPE_THRESHOLD = 50;

// Accepts an array of URLs, a single URL, or a JSON-encoded array (some
// request rows store photo_urls as text)
const normalizePhotos = (photos) => {
  let list = photos;
  if (typeof list === 'string' && list.trim().startsWith('[')) {
    try { list = JSON.parse(list); } catch { list = []; }
  }
  return (Array.isArray(list) ? list : [list]).filter((url) => typeof url === 'string' && url.trim() !== '');
};

/**
 * Full-screen photo viewer: swipe, arrow buttons or keyboard arrows to move
 * between photos; tap X, the backdrop or Escape to close.
 */
const PhotoLightbox = ({ photos, index, onIndexChange, onClose }) => {
  const touchStartX = useRef(null);
  const count = photos.length;

  const showPrevious = useCallback(() => onIndexChange((index - 1 + count) % count), [index, count, onIndexChange]);
  const showNext = useCallback(() => onIndexChange((index + 1) % count), [index, count, onIndexChange]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') showPrevious();
      else if (e.key === 'ArrowRight') showNext();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, showPrevious, showNext]);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (deltaX > SWIPE_THRESHOLD) showPrevious();
    else if (deltaX < -SWIPE_THRESHOLD) showNext();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={`Photo ${index + 1} of ${count}`}
      onClick={onClose}
    >
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm font-medium">{index + 1} / {count}</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-2 hover:bg-white/10"
          aria-label="Close photo viewer"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden px-2 pb-6"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <img
          key={photos[index]}
          src={photos[index]}
          alt={`Photo ${index + 1} of ${count}`}
          className="max-h-full max-w-full select-none rounded-md object-contain"
          onClick={(e) => e.stopPropagation()}
          draggable={false}
        />

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); showPrevious(); }}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
              aria-label="Previous photo"
            >
              <ChevronLeft className="h-7 w-7" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); showNext(); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
              aria-label="Next photo"
            >
              <ChevronRight className="h-7 w-7" />
            </button>
          </>
        )}
      </div>

      <div className="px-4 pb-6" onClick={(e) => e.stopPropagation()}>
        {count > 1 && (
          <div className="flex justify-center gap-1.5 pb-4">
            {photos.map((url, i) => (
              <button
                key={url + i}
                type="button"
                onClick={() => onIndexChange(i)}
                className={`h-2 rounded-full transition-all ${i === index ? 'w-5 bg-white' : 'w-2 bg-white/40'}`}
                aria-label={`Go to photo ${i + 1}`}
              />
            ))}
          </div>
        )}
        {/* Large close button, easy to find for low-literacy users */}
        <button
          type="button"
          onClick={onClose}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500 py-4 text-lg font-bold text-white active:bg-red-600"
        >
          <X className="h-6 w-6" strokeWidth={2.5} />
          CLOSE
        </button>
      </div>
    </div>,
    document.body
  );
};

/**
 * Thumbnail grid. Shows one row at first with a "Show all" button; tapping a
 * thumbnail opens the full-screen viewer at that photo. Photos that fail to
 * load are dropped. Pass emptyText={null} to render nothing when there are no
 * photos.
 */
const PhotoGallery = ({ photos, emptyText = 'No photos attached.' }) => {
  const [failed, setFailed] = useState(() => new Set());
  const urls = normalizePhotos(photos).filter((url) => !failed.has(url));
  const [expanded, setExpanded] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(null);

  const markFailed = (url) => setFailed((prev) => new Set(prev).add(url));

  if (urls.length === 0) {
    return emptyText ? <p className="text-gray-500 text-sm">{emptyText}</p> : null;
  }

  const hiddenCount = urls.length - COLLAPSED_COUNT;
  const visible = expanded || hiddenCount <= 0 ? urls : urls.slice(0, COLLAPSED_COUNT);

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {visible.map((url, index) => {
          const isLastCollapsed = !expanded && hiddenCount > 0 && index === COLLAPSED_COUNT - 1;
          return (
            <button
              key={url + index}
              type="button"
              onClick={() => (isLastCollapsed ? setExpanded(true) : setViewerIndex(index))}
              className="relative aspect-square overflow-hidden rounded-md bg-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500"
              aria-label={isLastCollapsed ? `Show ${hiddenCount} more photos` : `Open photo ${index + 1} of ${urls.length}`}
            >
              <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" onError={() => markFailed(url)} />
              {isLastCollapsed && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-lg font-semibold text-white">
                  +{hiddenCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex gap-2">
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex-1 rounded-md border border-gray-300 bg-white py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            {expanded ? 'Show less' : `Show all ${urls.length} photos`}
          </button>
        )}
        <button
          type="button"
          onClick={() => setViewerIndex(0)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-green-50 py-2 text-sm font-medium text-green-700 hover:bg-green-100"
        >
          <Images className="h-4 w-4" />
          View full screen
        </button>
      </div>

      {viewerIndex !== null && (
        <PhotoLightbox
          photos={urls}
          index={Math.min(viewerIndex, urls.length - 1)}
          onIndexChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </>
  );
};

export default PhotoGallery;
