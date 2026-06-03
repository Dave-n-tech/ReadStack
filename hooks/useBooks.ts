'use client';

import { useState, useEffect } from 'react';
import { evictCachedPDF } from '@/lib/cache/pdf-cache';
import type { Book, CreateBookInput } from '@/types';

export function useBooks() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBooks();
  }, []);

  async function fetchBooks() {
    try {
      setLoading(true);
      const res = await fetch('/api/books');
      if (!res.ok) throw new Error('Failed to fetch books');
      setBooks(await res.json());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function createBook(data: CreateBookInput): Promise<Book> {
    const res = await fetch('/api/books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create book');
    const created: Book = await res.json();
    setBooks((prev) => [created, ...prev]);
    return created;
  }

  async function deleteBook(id: string): Promise<void> {
    const res = await fetch(`/api/books/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete book');
    await evictCachedPDF(id);
    setBooks((prev) => prev.filter((b) => b.id !== id));
  }

  return { books, loading, error, createBook, deleteBook, refetch: fetchBooks };
}
