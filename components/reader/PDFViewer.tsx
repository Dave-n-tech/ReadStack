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
  render: (o: { canvasContext: CanvasRenderingContext2D; viewport: { height: number; width: number } }) => { promise: Promise<void>; cancel: () => void };
};

export default function PDFViewer({ book, onBack }: { book: Book; onBack: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);   // page mode
  const pdfRef       = useRef<PDFDocumentProxy | null>(null);
  const renderTask   = useRef<{ cancel(): void } | null>(null);

  // Scroll mode
  const pageCanvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const observerRef    = useRef<IntersectionObserver | null>(null);
  const visiblePages   = useRef<Set<number>>(new Set());
  // Map<pageNum, scaleRenderedAt> — used to detect stale renders
  const renderedAt     = useRef<Map<number, number>>(new Map());

  // Keep a ref of scale so native (non-React) event handlers always read the live value
  const scaleRef = useRef(1.2);

  const [currentPage, setCurrentPage] = useState(book.current_page ?? 1);
  const [totalPages,  setTotalPages]  = useState(book.total_pages ?? 0);
  const [scale,       setScale]       = useState(1.2);
  const [viewMode,    setViewMode]    = useState<ViewMode>('page');
  const [isFullscreen,setIsFullscreen]= useState(false);
  const [loading,     setLoading]     = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [loadSource,  setLoadSource]  = useState<'cache' | 'network' | null>(null);

  // ── Keep scaleRef current ────────────────────────────────────────────────────
  useEffect(() => { scaleRef.current = scale; }, [scale]);

  // ── Pinch-to-zoom (native listeners so we can call preventDefault) ───────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let startDist  = 0;
    let startScale = scaleRef.current;

    const dist = (t: TouchList) =>
      Math.hypot(t[1].clientX - t[0].clientX, t[1].clientY - t[0].clientY);

    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault(); // stop browser zoom from initiating
        startDist  = dist(e.touches);
        startScale = scaleRef.current;
      }
    };

    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      e.preventDefault(); // only works because passive:false below
      const ratio = dist(e.touches) / startDist;
      setScale(Math.max(0.5, Math.min(4, startScale * ratio)));
    };

    el.addEventListener('touchstart', onStart, { passive: false });
    el.addEventListener('touchmove',  onMove,  { passive: false });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove',  onMove);
    };
  }, []); // intentionally empty — uses scaleRef for current value

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

  // ── Scroll-mode: re-render VISIBLE pages when scale changes ──────────────────
  useEffect(() => {
    if (viewMode !== 'scroll' || loading) return;
    visiblePages.current.forEach((pageNum) => {
      const canvas = pageCanvasRefs.current[pageNum - 1];
      if (!canvas) return;
      renderedAt.current.set(pageNum, scale);
      renderScrollPage(pageNum, canvas, scale);
    });
  }, [scale]); // only fires on scale change; viewMode/loading guard prevents side-effects

  // ── Scroll-mode: IntersectionObserver setup ───────────────────────────────────
  useEffect(() => {
    if (viewMode !== 'scroll' || !pdfRef.current || totalPages === 0 || loading) return;

    observerRef.current?.disconnect();
    visiblePages.current.clear();
    // Don't clear renderedAt here — we want stale-scale detection to still work

    pageCanvasRefs.current = new Array(totalPages).fill(null);

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const canvas  = entry.target as HTMLCanvasElement;
          const pageNum = parseInt(canvas.dataset.page!, 10);

          if (entry.isIntersecting) {
            visiblePages.current.add(pageNum);
            setCurrentPage(pageNum);
            // Render if never rendered, or rendered at a different scale
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

    // Give DOM a tick to mount canvases, then observe them
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
    } catch {
      // ignore cancelled renders
    }
  }

  // ── Navigation ────────────────────────────────────────────────────────────────
  const goToPage = useCallback(async (page: number) => {
    const p = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(p);
    await saveProgress(p);
    if (viewMode === 'scroll') {
      pageCanvasRefs.current[p - 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [totalPages, viewMode]);

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
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // ── View-mode switch ──────────────────────────────────────────────────────────
  function handleViewModeChange(mode: ViewMode) {
    renderedAt.current.clear(); // force re-render at current scale in new mode
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
    <div ref={containerRef} className="min-h-dvh bg-[#1a1a1a] flex flex-col" style={{ touchAction: 'pan-y' }}>
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
              style={{ opacity: pageLoading ? 0.5 : 1, transition: 'opacity 0.15s' }}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-8 w-full">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <canvas
                key={n}
                data-page={n}
                ref={(el) => { pageCanvasRefs.current[n - 1] = el; }}
                className="shadow-modal rounded max-w-full"
                style={{ minHeight: '2px' }} // non-zero so observer fires correctly
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
          onScaleChange={setScale}
          onViewModeChange={handleViewModeChange}
          onFullscreenToggle={toggleFullscreen}
        />
      )}
    </div>
  );
}
