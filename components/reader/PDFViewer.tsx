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

const SCROLL_WINDOW = 3;

export default function PDFViewer({ book, onBack }: { book: Book; onBack: () => void }) {
  const containerRef   = useRef<HTMLDivElement>(null);
  const scrollAreaRef  = useRef<HTMLDivElement>(null);
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const pdfRef         = useRef<PDFDocumentProxy | null>(null);
  const renderTask     = useRef<{ cancel(): void } | null>(null);
  const pageCanvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const renderedAt     = useRef<Map<number, number>>(new Map());
  const saveTimer      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scaleRef        = useRef(1.2);
  const viewModeRef     = useRef<ViewMode>('scroll');
  const totalPagesRef   = useRef(0);
  const currentPageRef  = useRef(book.current_page ?? 1);
  const lastRenderScale = useRef(1.2);
  const zoomTimer       = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [currentPage,  setCurrentPage]  = useState(book.current_page ?? 1);
  const [totalPages,   setTotalPages]   = useState(book.total_pages ?? 0);
  const [scale,        setScale]        = useState(1.2);
  const [cssScale,     setCssScale]     = useState(1);
  const [viewMode,     setViewMode]     = useState<ViewMode>('scroll');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [pageLoading,  setPageLoading]  = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [loadSource,   setLoadSource]   = useState<'cache' | 'network' | null>(null);
  const [pageSize,     setPageSize]     = useState({ w: 816, h: 1056 });

  useEffect(() => { scaleRef.current       = scale;       }, [scale]);
  useEffect(() => { viewModeRef.current    = viewMode;    }, [viewMode]);
  useEffect(() => { totalPagesRef.current  = totalPages;  }, [totalPages]);
  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);

  // ── Gesture zoom ─────────────────────────────────────────────────────────────
  const gestureZoom = useCallback((targetScale: number) => {
    const next = Math.max(0.5, Math.min(4, targetScale));
    scaleRef.current = next;
    setCssScale(next / lastRenderScale.current);
    if (zoomTimer.current) clearTimeout(zoomTimer.current);
    zoomTimer.current = setTimeout(() => setScale(scaleRef.current), 180);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let startDist = 0, startScale = 1.2;
    const dist = (t: TouchList) =>
      Math.hypot(t[1].clientX - t[0].clientX, t[1].clientY - t[0].clientY);
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) { e.preventDefault(); startDist = dist(e.touches); startScale = scaleRef.current; }
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

  // ── Stable scroll-mode render functions ──────────────────────────────────────
  const renderScrollPage = useCallback(async (
    pageNum: number,
    canvas: HTMLCanvasElement,
    s: number,
  ) => {
    if (!pdfRef.current) return;
    try {
      const page = await pdfRef.current.getPage(pageNum);
      const vp = page.getViewport({ scale: s });
      canvas.width  = vp.width;
      canvas.height = vp.height;
      await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise;
    } catch { /* cancelled or unavailable — canvas keeps placeholder dimensions */ }
  }, []);

  const renderScrollWindow = useCallback((centerPage: number, s: number) => {
    const total = totalPagesRef.current;
    if (total === 0 || !pdfRef.current) return;
    const start = Math.max(1, centerPage - SCROLL_WINDOW);
    const end   = Math.min(total, centerPage + SCROLL_WINDOW);
    for (let i = start; i <= end; i++) {
      const canvas = pageCanvasRefs.current[i - 1];
      if (canvas && renderedAt.current.get(i) !== s) {
        renderedAt.current.set(i, s);
        renderScrollPage(i, canvas, s);
      }
    }
  }, [renderScrollPage]);

  // ── Load PDF ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadPDF();
    return () => { renderTask.current?.cancel(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadPDF() {
    try {
      setLoading(true);
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      let data: ArrayBuffer;
      let source: 'cache' | 'network';
      const cached = await getCachedPDF(book.id);
      if (cached) {
        data = cached.arrayBuffer;
        source = 'cache';
        setLoadSource('cache');
      } else {
        if (!book.pdf_url) throw new Error('No PDF available');
        const res = await fetch(book.pdf_url);
        if (!res.ok) throw new Error('Failed to load PDF');
        data = await res.arrayBuffer();
        source = 'network';
        setLoadSource('network');
      }
      const pdf = await pdfjs.getDocument({ data }).promise;
      pdfRef.current = pdf as unknown as PDFDocumentProxy;
      const pages = pdf.numPages;
      totalPagesRef.current = pages;
      setTotalPages(pages);

      // Measure first page so scroll-mode placeholders have correct dimensions
      try {
        const first = await (pdf as unknown as PDFDocumentProxy).getPage(1);
        const vp = first.getViewport({ scale: scaleRef.current });
        setPageSize({ w: Math.round(vp.width), h: Math.round(vp.height) });
      } catch { /* keep defaults */ }

      if (source === 'network') {
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
      canvas.width  = vp.width;
      canvas.height = vp.height;
      const task = page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp });
      renderTask.current = task;
      await task.promise;
      lastRenderScale.current = s;
      setCssScale(1);
      setPageLoading(false);
    } catch (e) {
      if ((e as Error)?.name !== 'RenderingCancelledException') setPageLoading(false);
    }
  }

  useEffect(() => {
    if (viewMode === 'page' && pdfRef.current && !loading) renderSinglePage(currentPage, scale);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, scale, viewMode]);

  // ── Scroll-mode: initial render when entering scroll ─────────────────────────
  useEffect(() => {
    if (viewMode !== 'scroll' || !pdfRef.current || totalPages === 0 || loading) return;
    renderedAt.current.clear();
    // rAF ensures canvas ref callbacks have fired before we try to render
    const raf = requestAnimationFrame(() => {
      renderScrollWindow(currentPageRef.current, scaleRef.current);
      pageCanvasRefs.current[currentPageRef.current - 1]?.scrollIntoView({ block: 'start' });
    });
    return () => cancelAnimationFrame(raf);
  }, [viewMode, totalPages, loading, renderScrollWindow]);

  // ── Scroll-mode: re-render window on scale change ────────────────────────────
  useEffect(() => {
    if (viewMode !== 'scroll' || loading || totalPages === 0) return;
    const center = currentPageRef.current;
    const s = scale;
    const start = Math.max(1, center - SCROLL_WINDOW);
    const end   = Math.min(totalPages, center + SCROLL_WINDOW);
    const jobs: Promise<void>[] = [];
    for (let i = start; i <= end; i++) {
      const canvas = pageCanvasRefs.current[i - 1];
      if (!canvas) continue;
      renderedAt.current.set(i, s);
      jobs.push(renderScrollPage(i, canvas, s));
    }
    Promise.all(jobs).then(() => { lastRenderScale.current = s; setCssScale(1); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, renderScrollPage]);

  // ── Scroll-mode: track current page and load more pages on scroll ─────────────
  useEffect(() => {
    if (viewMode !== 'scroll' || loading || totalPages === 0) return;
    const el = scrollAreaRef.current;
    if (!el) return;

    function getMostVisiblePage(): number {
      const elRect = el!.getBoundingClientRect();
      let best = currentPageRef.current, bestOverlap = -Infinity;
      pageCanvasRefs.current.forEach((canvas, i) => {
        if (!canvas) return;
        const r = canvas.getBoundingClientRect();
        const overlap = Math.min(r.bottom, elRect.bottom) - Math.max(r.top, elRect.top);
        if (overlap > bestOverlap) { bestOverlap = overlap; best = i + 1; }
      });
      return best;
    }

    function onScroll() {
      const page = getMostVisiblePage();
      setCurrentPage(page);
      renderScrollWindow(page, scaleRef.current);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => saveProgress(page), 800);
    }

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [viewMode, loading, totalPages, renderScrollWindow]);

  // ── Navigation ────────────────────────────────────────────────────────────────
  const goToPage = useCallback(async (page: number) => {
    const p = Math.max(1, Math.min(page, totalPagesRef.current));
    setCurrentPage(p);
    await saveProgress(p);
    if (viewModeRef.current === 'scroll') {
      pageCanvasRefs.current[p - 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      className="h-dvh bg-[#1a1a1a] flex flex-col"
      style={{ touchAction: 'pan-y' }}
    >
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-bg-primary/95 backdrop-blur border-b border-border px-4 h-12 flex items-center justify-between gap-4 flex-shrink-0">
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
      <div
        ref={scrollAreaRef}
        className="flex-1 min-h-0 overflow-auto flex justify-center py-6 px-4"
      >
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
                className="shadow-modal rounded"
                width={pageSize.w}
                height={pageSize.h}
                style={{ maxWidth: '100%', display: 'block' }}
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
          onScaleChange={(s) => { lastRenderScale.current = s; setCssScale(1); setScale(s); }}
          onViewModeChange={handleViewModeChange}
          onFullscreenToggle={toggleFullscreen}
        />
      )}
    </div>
  );
}
