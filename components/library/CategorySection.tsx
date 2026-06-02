'use client';

import { useState } from 'react';
import BookCard from './BookCard';
import type { Book, Category } from '@/types';

interface CategorySectionProps {
  category: Pick<Category, 'id' | 'name' | 'color'> & { id: string | null };
  books: Book[];
  onAddBook: () => void;
  onDeleteBook: (id: string) => Promise<void>;
  onEditCategory: ((id: string, updates: Partial<Category>) => Promise<void>) | null;
  onDeleteCategory: ((id: string) => Promise<void>) | null;
}

export default function CategorySection({
  category,
  books,
  onAddBook,
  onDeleteBook,
  onEditCategory,
  onDeleteCategory,
}: CategorySectionProps) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(category.name);
  const [showMenu, setShowMenu] = useState(false);

  async function handleSaveEdit() {
    if (editName.trim() && editName !== category.name && onEditCategory && category.id) {
      await onEditCategory(category.id, { name: editName.trim() });
    }
    setEditing(false);
  }

  return (
    <section>
      <div className="flex items-center gap-3 mb-5">
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: category.color }}
        />

        {editing ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveEdit();
                if (e.key === 'Escape') { setEditing(false); setEditName(category.name); }
              }}
              className="input py-0.5 text-base font-display font-semibold w-48"
            />
            <button onClick={handleSaveEdit} className="text-accent-green text-xs font-mono">save</button>
            <button onClick={() => { setEditing(false); setEditName(category.name); }} className="text-text-muted text-xs font-mono">cancel</button>
          </div>
        ) : (
          <h2 className="font-display text-lg font-semibold text-text-primary">
            {category.name}
          </h2>
        )}

        <span className="text-xs text-text-muted font-mono">
          {books.length} book{books.length !== 1 ? 's' : ''}
        </span>

        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={onAddBook}
            className="text-xs text-text-muted hover:text-accent-gold transition-colors font-mono"
          >
            + Add book
          </button>

          {category.id && onEditCategory && (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="text-text-muted hover:text-text-secondary transition-colors text-sm w-6 h-6 flex items-center justify-center rounded hover:bg-bg-elevated"
              >
                ⋯
              </button>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-7 z-20 bg-bg-elevated border border-border rounded-lg shadow-modal py-1 min-w-[140px] animate-fade-in">
                    <button
                      onClick={() => { setEditing(true); setShowMenu(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-card transition-colors"
                    >
                      Rename
                    </button>
                    {onDeleteCategory && (
                      <button
                        onClick={() => { onDeleteCategory(category.id!); setShowMenu(false); }}
                        className="w-full text-left px-4 py-2 text-sm text-accent-red hover:bg-accent-red-muted transition-colors"
                      >
                        Delete collection
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {books.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {books.map((book) => (
            <BookCard key={book.id} book={book} onDelete={onDeleteBook} />
          ))}
        </div>
      ) : (
        <div className="border border-dashed border-border rounded-xl p-8 text-center">
          <p className="text-text-muted text-sm mb-3">No books yet</p>
          <button onClick={onAddBook} className="text-xs text-accent-gold hover:underline font-mono">
            + Add your first book
          </button>
        </div>
      )}
    </section>
  );
}
