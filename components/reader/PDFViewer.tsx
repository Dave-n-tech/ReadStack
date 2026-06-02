'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getCachedPDF, cachePDF } from '@/lib/cache/pdf-cache';
import { enqueueProgressUpdate } from '@/lib/cache/sync-queue';
import ReaderControls, { type ViewMode } from './ReaderControls';
import type { Book } from '@/types';

type PDFDocumentProxy = {
  numPages: number;
  getPage: (n: number) => Promise<PDFPageProxy>;
};
type PDFPageProxy = {
  getViewport: (o: { scale: number }) => { height: number; width: number };
  render: (o: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { height: number; width: number };
  }) => { promise: Promise<void>; cancel: () => void };
};

export default function PDFViewer({ book, onBack }: { book: Book; onBack: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const pdfRef       = useRef<PDFDocumentProxy | null>(null);
  const renderTask   = useRef<{ cancel(): void } | null>(null);

  // Scroll mode
  const pageCanvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const observerRef    = useRef<IntersectionObserver | null>(null);
  const visiblePages   = useRef<Set<number>>(new Set());
  const renderedAt     = useRef<Map<number, number>>(new Map());

  // Refs so native event handlers always read current values without stale closures
  const scaleRef       = useRef(1.2);
  const viewModeRef    = useRef<ViewMode>('page');

  // Smooth zoom: visual scale applied via CSS transform while real re-render is debounced
  const lastRenderScale = useRef(1.2);  // scale at which canvas was last drawn
  const zoomTimer       = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [currentPage,  setCurrentPage]  = useState(book.current_page ?? 1);
  const [totalPages,   setTotalPages]   = useState(book.total_pages ?? 0);
  const [scale,        setScale]        = useState(1.2);
  const [cssScale,     setCssScale]     = useState(1);   // canvas CSS transform ratio
  const [viewMode,     setViewMode]     = useState<ViewMode>('page');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [pageLoading,  setPageLoading]  = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [loadSource,   setLoadSource]   = useState<'cache' | 'network' | null>(null);

  // Keep refs in sync with state
  useEffect(() => { scaleRef.current    = scale;    }, [scale]);
  useEffect(() => { viewModeRef.current = viewMode; }, [viewMode]);

  // ── Smooth gesture zoom ──────────────────────────────────────────────────────
  // Called on every wheel/pinch event — gives instant CSS feedback, debounces re-render.
  const gestureZoom = useCallback((targetScale: number) => {
    const next = Math.max(0.5, Math.min(4, targetScale));
    scaleRef.current = next;

    // Immediate visual feedback via CSS transform (no re-render)
    setCssScale(next / lastRenderScale.current);

    // Debounce the actual PDF re-render until the gesture pauses
    if (zoomTimer.current) clearTimeout(zoomTimer.current);
    zoomTimer.current = setTimeout(() => {
      setScale(scaleRef.current);
      // cssScale resets after re-render completes:
      //   page mode  → inside renderSinglePage
      //   scroll mode → inside useEffect([scale]) after Promise.all
    }, 180);
  }, []);

  // ── Native touch + wheel listeners (passive:false required for preventDefault) ─
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let startDist  = 0;
    let startScale = 1.2;

    const dist = (t: TouchList) =>
      Math.hypot(t[1].clientX - t[0].clientX, t[1].clientY - t[0].clientY);

    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        startDist  = dist(e.touches);
        startScale = scaleRef.current;
      }
    };

    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      gestureZoom(startScale * (dist(e.touches) / startDist));
    };

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      gestureZoom(scaleRef.current * (e.deltaY < 0 ? 1.08 : 0.92));
    };

    el.addEventListener('touchstart', onStart, { passive: false });
    el.addEventListener('touchmove',  onMove,  { passive: false });
    el.addEventListener('wheel',      onWheel, { passive: false });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove',  onMove);
      el.removeEventListener('wheel',      onWheel);
    };
  }, [gestureZoom]);

  // ── Load PDF ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadPDF();
    return () => { renderTask.current?.cancel(); };
  }, []);

  async function loadPDF() {
    try {
      setLoading(true);
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

      let data: ArrayBuffer;
      const cached = await getCachedPDF(book.id);
      if (cached) {
        data = cached.arrayBuffer;
        setLoadSource('cache');
      } else {
        if (!book.pdf_url) throw new Error('No PDF available');
        setLoadSource('network');
        const res = await fetch(book.pdf_url);
        if (!res.ok) throw new Error('Failed to load PDF');
        data = await res.arrayBuffer();
      }

      const pdf = await pdfjs.getDocument({ data }).promise;
      pdfRef.current = pdf as unknown as PDFDocumentProxy;
      const pages = pdf.numPages;
      setTotalPages(pages);

      if (loadSource === 'network') {
        cachePDF(book.id, data, pages).catch(() => {});
        if (!book.total_pages || book.total_pages !== pages) {
          fetch(`/api/books/${book.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ total_pages: pages }),
          }).catch(() => {});
        }
      }

      setLoading(false);
      await renderSinglePage(book.current_page ?? 1, scaleRef.current);
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  // ── Page-mode rendering ───────────────────────────────────────────────────────
  async function renderSinglePage(pageNum: number, s: number) {
    if (!pdfRef.current || !canvasRef.current) return;
    try {
      setPageLoading(true);
      renderTask.current?.cancel();
      renderTask.current = null;

      const page = await pdfRef.current.getPage(pageNum);
      const vp   = page.getViewport({ scale: s });
      const canvas = canvasRef.current;
      canvas.height = vp.height;
      canvas.width  = vp.width;

      const task = page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp });
      renderTask.current = task;
      await task.promise;

      // Re-render finished — remove the CSS scale, the canvas is now at correct resolution
      lastRenderScale.current = s;
      setCssScale(1);
      setPageLoading(false);
    } catch (e) {
      if ((e as Error)?.name !== 'RenderingCancelledException') setPageLoading(false);
    }
  }

  useEffect(() => {
    if (viewMode === 'page' && pdfRef.current && !loading) {
      renderSinglePage(currentPage, scale);
    }
  }, [currentPage, scale, viewMode]);

  // ── Scroll-mode: re-render visible pages when scale changes ──────────────────
  useEffect(() => {
    if (viewMode !== 'scroll' || loading) return;
    const jobs = Array.from(visiblePages.current).map((pageNum) => {
      const canvas = pageCanvasRefs.current[pageNum - 1];
      if (!canvas) return Promise.resolve();
      renderedAt.current.set(pageNum, scale);
      return renderScrollPage(pageNum, canvas, scale);
    });
    // Once all visible pages are re-drawn at the new scale, drop the CSS scale
    Promise.all(jobs).then(() => {
      lastRenderScale.current = scale;
      setCssScale(1);
    });
  }, [scale]);

  // ── Scroll-mode: IntersectionObserver ────────────────────────────────────────
  useEffect(() => {
    if (viewMode !== 'scroll' || !pdfRef.current || totalPages === 0 || loading) return;

    observerRef.current?.disconnect();
    visiblePages.current.clear();
    pageCanvasRefs.current = new Array(totalPages).fill(null);

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const canvas  = entry.target as HTMLCanvasElement;
          const pageNum = parseInt(canvas.dataset.page!, 10);
          if (entry.isIntersecting) {
            visiblePages.current.add(pageNum);
            setCurrentPage(pageNum);
            if (renderedAt.current.get(pageNum) !== scaleRef.current) {
              renderedAt.current.set(pageNum, scaleRef.current);
              renderScrollPage(pageNum, canvas, scaleRef.current);
            }
          } else {
            visiblePages.current.delete(pageNum);
          }
        });
      },
      { rootMargin: '400px 0px', threshold: 0 }
    );

    const id = setTimeout(() => {
      pageCanvasRefs.current.forEach((c) => {
        if (c) observerRef.current!.observe(c);
      });
    }, 50);

    return () => {
      clearTimeout(id);
      observerRef.current?.disconnect();
    };
  }, [viewMode, totalPages, loading]);

  async function renderScrollPage(pageNum: number, canvas: HTMLCanvasElement, s: number) {
    if (!pdfRef.current) return;
    try {
      const page = await pdfRef.current.getPage(pageNum);
      const vp   = page.getViewport({ scale: s });
      canvas.height = vp.height;
      canvas.width  = vp.width;
      await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise;
    } catch { /* ignore cancelled */ }
  }

  // ── Navigation ────────────────────────────────────────────────────────────────
  const goToPage = useCallback(async (page: number) => {
    const p = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(p);
    await saveProgress(p);
    if (viewModeRef.current === 'scroll') {
      pageCanvasRefs.current[p - 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [totalPages]);

  async function saveProgress(page: number) {
    await enqueueProgressUpdate(book.id, page);
    if (navigator.onLine) {
      fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId: book.id, currentPage: page }),
      }).catch(() => {});
    }
  }

  useEffect(() => {
    if (viewMode !== 'page') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goToPage(currentPage + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goToPage(currentPage - 1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentPage, goToPage, viewMode]);

  // ── Fullscreen ────────────────────────────────────────────────────────────────
  function toggleFullscreen() {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen();
    else document.exitFullscreen();
  }
  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  // ── View-mode switch ──────────────────────────────────────────────────────────
  function handleViewModeChange(mode: ViewMode) {
    renderedAt.current.clear();
    setViewMode(mode);
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-dvh bg-bg-primary flex flex-col items-center justify-center gap-4">
        <p className="text-text-secondary text-sm">{error}</p>
        <button onClick={onBack} className="btn-ghost">← Back to library</button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="min-h-dvh bg-[#1a1a1a] flex flex-col"
      style={{ touchAction: 'pan-y' }}
    >
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-bg-primary/95 backdrop-blur border-b border-border px-4 h-12 flex items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="text-text-muted hover:text-text-primary transition-colors text-sm font-mono flex items-center gap-1.5 flex-shrink-0"
        >
          ← Library
        </button>
        <h1 className="font-display text-sm text-text-primary truncate">{book.title}</h1>
        <div className="flex-shrink-0">
          {loadSource === 'cache' && (
            <span className="text-2xs font-mono text-accent-green bg-accent-green-muted px-2 py-0.5 rounded border border-accent-green/20">
              offline
            </span>
          )}
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 overflow-auto flex justify-center py-6 px-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 text-text-muted">
            <div className="w-6 h-6 border-2 border-border border-t-accent-gold rounded-full animate-spin-slow" />
            <p className="text-xs font-mono">
              {loadSource === 'network' ? 'Downloading PDF…' : 'Loading…'}
            </p>
          </div>
        ) : viewMode === 'page' ? (
          <div className="relative">
            <canvas
              ref={canvasRef}
              className="shadow-modal rounded"
              style={{
                // CSS scale gives instant visual feedback while the re-render is in flight.
                // cssScale resets to 1 inside renderSinglePage once drawing completes.
                transform: cssScale !== 1 ? `scale(${cssScale})` : undefined,
                transformOrigin: 'top center',
                opacity: pageLoading && cssScale === 1 ? 0.5 : 1,
                transition: pageLoading && cssScale === 1 ? 'opacity 0.15s' : 'none',
              }}
            />
          </div>
        ) : (
          <div
            className="flex flex-col items-center gap-8 w-full"
            style={{
              transform: cssScale !== 1 ? `scale(${cssScale})` : undefined,
              transformOrigin: 'top center',
            }}
          >
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <canvas
                key={n}
                data-page={n}
                ref={(el) => { pageCanvasRefs.current[n - 1] = el; }}
                className="shadow-modal rounded max-w-full"
                style={{ minHeight: '2px' }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Controls */}
      {!loading && (
        <ReaderControls
          currentPage={currentPage}
          totalPages={totalPages}
          scale={scale}
          viewMode={viewMode}
          isFullscreen={isFullscreen}
          onPageChange={goToPage}
          onScaleChange={(s) => {
            // Zoom buttons: immediate re-render (discrete step, not a gesture stream)
            lastRenderScale.current = s;
            setCssScale(1);
            setScale(s);
          }}
          onViewModeChange={handleViewModeChange}
          onFullscreenToggle={toggleFullscreen}
        />
      )}
    </div>
  );
}
