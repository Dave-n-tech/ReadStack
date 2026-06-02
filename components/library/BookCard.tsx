'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { isPDFCached } from '@/lib/cache/pdf-cache';
import clsx from 'clsx';
import type { Book } from '@/types';

interface BookCardProps {
  book: Book;
  onDelete: (id: string) => Promise<void>;
}

function getCoverUrl(pdfUrl: string | null): string | null {
  if (!pdfUrl || !pdfUrl.includes('/image/upload/')) return null;
  // Insert page-1 thumbnail transformation into the existing image URL
  return pdfUrl.replace('/image/upload/', '/image/upload/pg_1,w_480,h_640,c_fill,f_auto,q_auto/');
}

export default function BookCard({ book, onDelete }: BookCardProps) {
  const [cached, setCached] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [coverError, setCoverError] = useState(false);

  const progress = book.total_pages && book.current_page
    ? Math.round((book.current_page / book.total_pages) * 100)
    : 0;

  const isEvicted = book.pdf_status === 'evicted';
  const hasNoPDF = !book.pdf_url && !isEvicted;
  const coverUrl = !coverError ? getCoverUrl(book.pdf_url) : null;

  useEffect(() => {
    isPDFCached(book.id).then(setCached);
  }, [book.id]);

  async function handleDelete() {
    if (!confirm(`Remove "${book.title}"? This will also delete the PDF.`)) return;
    setDeleting(true);
    await onDelete(book.id);
  }

  const lastOpened = book.last_opened_at
    ? formatRelative(new Date(book.last_opened_at))
    : null;

  return (
    <div
      className={clsx(
        'group relative flex flex-col rounded-xl overflow-hidden border transition-all duration-200',
        deleting ? 'opacity-40 pointer-events-none' : 'hover:-translate-y-1 hover:shadow-card',
        'bg-bg-card border-border hover:border-border-light'
      )}
    >
      {/* Cover */}
      <Link
        href={isEvicted || hasNoPDF ? '#' : `/reader/${book.id}`}
        className={clsx('block', (isEvicted || hasNoPDF) && 'cursor-default')}
      >
        <div className="aspect-[4/5] bg-bg-elevated relative overflow-hidden">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={book.title}
              className="w-full h-full object-cover"
              onError={() => setCoverError(true)}
            />
          ) : (
            /* Gradient placeholder */
            <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center">
              <div
                className="w-full h-full absolute inset-0"
                style={{
                  background: `linear-gradient(135deg, ${book.categories?.color ?? '#6EBF8B'}33 0%, ${book.categories?.color ?? '#6EBF8B'}11 100%)`,
                }}
              />
              <span className="font-display text-sm text-text-secondary leading-snug relative z-10 line-clamp-4 px-2">
                {book.title}
              </span>
              {book.author && (
                <span className="text-xs text-text-muted mt-2 relative z-10 line-clamp-1 px-2">
                  {book.author}
                </span>
              )}
            </div>
          )}

          {/* Status badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {cached && (
              <span className="text-2xs font-mono bg-accent-green-muted text-accent-green border border-accent-green/20 px-1.5 py-0.5 rounded">
                offline
              </span>
            )}
            {isEvicted && (
              <span className="text-2xs font-mono bg-accent-red-muted text-accent-red border border-accent-red/20 px-1.5 py-0.5 rounded">
                re-upload
              </span>
            )}
          </div>

          {/* Hover overlay */}
          {!isEvicted && !hasNoPDF && (
            <div className="absolute inset-0 bg-bg-overlay opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-xs font-mono text-text-primary bg-bg-card px-3 py-1.5 rounded-full border border-border">
                {book.current_page > 1 ? `Resume p.${book.current_page}` : 'Start reading'}
              </span>
            </div>
          )}
        </div>
      </Link>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <div>
          <h3 className="text-sm font-medium text-text-primary leading-snug line-clamp-2">
            {book.title}
          </h3>
          {book.author && (
            <p className="text-xs text-text-secondary mt-0.5 line-clamp-1">{book.author}</p>
          )}
        </div>

        {/* Progress bar */}
        {book.total_pages && book.total_pages > 0 ? (
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-2xs text-text-muted font-mono">
                p.{book.current_page} / {book.total_pages}
              </span>
              <span className="text-2xs font-mono" style={{ color: book.categories?.color ?? '#6EBF8B' }}>
                {progress}%
              </span>
            </div>
            <div className="h-0.5 bg-border rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progress}%`,
                  backgroundColor: book.categories?.color ?? '#6EBF8B',
                }}
              />
            </div>
          </div>
        ) : null}

        {lastOpened && (
          <p className="text-2xs text-text-muted font-mono">{lastOpened}</p>
        )}
      </div>

      {/* Actions menu */}
      <div className="absolute top-2 right-2">
        <button
          onClick={(e) => { e.preventDefault(); setShowMenu(!showMenu); }}
          className="w-6 h-6 rounded bg-bg-card/80 border border-border text-text-muted hover:text-text-primary flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
        >
          ⋯
        </button>
        {showMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-7 z-20 bg-bg-elevated border border-border rounded-lg shadow-modal py-1 min-w-[130px] animate-fade-in">
              {!isEvicted && !hasNoPDF && (
                <Link
                  href={`/reader/${book.id}`}
                  className="block px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-card transition-colors"
                  onClick={() => setShowMenu(false)}
                >
                  Open reader
                </Link>
              )}
              <button
                onClick={() => { handleDelete(); setShowMenu(false); }}
                className="w-full text-left px-4 py-2 text-sm text-accent-red hover:bg-accent-red-muted transition-colors"
              >
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function formatRelative(date: Date): string {
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString();
}
