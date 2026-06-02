'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PDFViewer from '@/components/reader/PDFViewer';
import Spinner from '@/components/ui/Spinner';
import type { Book } from '@/types';

export default function ReaderPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const router = useRouter();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBook() {
      try {
        const res = await fetch(`/api/books/${bookId}`);
        if (!res.ok) throw new Error('Book not found');
        const data = await res.json();
        setBook(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    fetchBook();
  }, [bookId]);

  if (loading) {
    return (
      <div className="min-h-dvh bg-bg-primary flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="min-h-dvh bg-bg-primary flex flex-col items-center justify-center gap-4">
        <p className="text-text-secondary">{error || 'Book not found'}</p>
        <button onClick={() => router.push('/library')} className="btn-ghost">
          ← Back to library
        </button>
      </div>
    );
  }

  if (book.pdf_status === 'evicted') {
    return (
      <div className="min-h-dvh bg-bg-primary flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="font-display text-4xl text-text-muted/20 mb-2">◈</div>
        <h2 className="font-display text-xl text-text-primary font-semibold">
          PDF removed
        </h2>
        <p className="text-text-secondary text-sm max-w-xs">
          This PDF was removed after 30 days of inactivity. Re-upload it to continue
          reading from page {book.current_page}.
        </p>
        <button onClick={() => router.push('/library')} className="btn-ghost mt-2">
          ← Back to library
        </button>
      </div>
    );
  }

  return (
    <PDFViewer
      book={book}
      onBack={() => router.push('/library')}
    />
  );
}
