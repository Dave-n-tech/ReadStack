'use client';

import { useState } from 'react';

export type ViewMode = 'page' | 'scroll';

const ZOOM_LEVELS = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

interface ReaderControlsProps {
  currentPage: number;
  totalPages: number;
  scale: number;
  viewMode: ViewMode;
  isFullscreen: boolean;
  onPageChange: (page: number) => void;
  onScaleChange: (scale: number) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onFullscreenToggle: () => void;
}

export default function ReaderControls({
  currentPage,
  totalPages,
  scale,
  viewMode,
  isFullscreen,
  onPageChange,
  onScaleChange,
  onViewModeChange,
  onFullscreenToggle,
}: ReaderControlsProps) {
  const [pageInput, setPageInput] = useState('');
  const [editing, setEditing] = useState(false);

  const progress = totalPages ? Math.round((currentPage / totalPages) * 100) : 0;

  function handlePageSubmit() {
    const num = parseInt(pageInput, 10);
    if (!isNaN(num)) onPageChange(num);
    setEditing(false);
    setPageInput('');
  }

  function zoomIn() {
    const next = ZOOM_LEVELS.find((z) => z > scale);
    if (next) onScaleChange(next);
  }

  function zoomOut() {
    const prev = [...ZOOM_LEVELS].reverse().find((z) => z < scale);
    if (prev) onScaleChange(prev);
  }

  return (
    <div className="sticky bottom-0 z-30 bg-bg-primary/95 backdrop-blur border-t border-border">
      {/* Progress bar */}
      <div className="h-0.5 bg-border">
        <div
          className="h-full bg-accent-gold transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="h-12 px-4 flex items-center justify-between gap-2 max-w-3xl mx-auto">
        {/* Prev (page mode only) */}
        {viewMode === 'page' && (
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="w-8 h-8 flex items-center justify-center rounded text-text-secondary hover:text-text-primary hover:bg-bg-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous page"
          >
            ‹
          </button>
        )}

        {/* Page indicator */}
        <div className="flex items-center gap-2">
          {editing ? (
            <input
              autoFocus
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={handlePageSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handlePageSubmit();
                if (e.key === 'Escape') { setEditing(false); setPageInput(''); }
              }}
              className="w-14 text-center input py-0.5 text-sm font-mono"
            />
          ) : (
            <button
              onClick={() => { setEditing(true); setPageInput(String(currentPage)); }}
              className="font-mono text-sm text-text-secondary hover:text-text-primary transition-colors px-1"
            >
              {currentPage}
            </button>
          )}
          <span className="text-text-muted font-mono text-sm">/ {totalPages}</span>
        </div>

        {/* Next (page mode only) */}
        {viewMode === 'page' && (
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="w-8 h-8 flex items-center justify-center rounded text-text-secondary hover:text-text-primary hover:bg-bg-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Next page"
          >
            ›
          </button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Zoom */}
        <div className="flex items-center gap-1">
          <button
            onClick={zoomOut}
            disabled={scale <= ZOOM_LEVELS[0]}
            className="w-7 h-7 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-elevated rounded disabled:opacity-30 transition-colors text-base"
          >
            −
          </button>
          <span className="font-mono text-xs text-text-muted w-10 text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={zoomIn}
            disabled={scale >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
            className="w-7 h-7 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-elevated rounded disabled:opacity-30 transition-colors"
          >
            +
          </button>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => onViewModeChange('page')}
            className={`px-2.5 py-1 text-xs font-mono transition-colors ${
              viewMode === 'page'
                ? 'bg-accent-gold text-bg-primary'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
            }`}
            title="Page view"
          >
            ⊡
          </button>
          <button
            onClick={() => onViewModeChange('scroll')}
            className={`px-2.5 py-1 text-xs font-mono transition-colors ${
              viewMode === 'scroll'
                ? 'bg-accent-gold text-bg-primary'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
            }`}
            title="Scroll view"
          >
            ☰
          </button>
        </div>

        {/* Fullscreen */}
        <button
          onClick={onFullscreenToggle}
          className="w-7 h-7 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-elevated rounded transition-colors"
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? '⊠' : '⊞'}
        </button>
      </div>
    </div>
  );
}
