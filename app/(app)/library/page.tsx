'use client';

import { useState, useEffect, useRef } from 'react';
import { useCategories } from '@/hooks/useCategories';
import { useBooks } from '@/hooks/useBooks';
import BookCard from '@/components/library/BookCard';
import CreateCategoryModal from '@/components/library/CreateCategoryModal';
import AddBookModal from '@/components/library/AddBookModal';
import Spinner from '@/components/ui/Spinner';
import type { Category } from '@/types';

// ─── Collection tab with rename + delete context menu ────────────────────────
function CollectionTab({
  category,
  count,
  active,
  onSelect,
  onRename,
  onDelete,
}: {
  category: Category;
  count: number;
  active: boolean;
  onSelect: () => void;
  onRename: (name: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameInput, setNameInput] = useState(category.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) inputRef.current?.focus();
  }, [renaming]);

  async function commitRename() {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== category.name) await onRename(trimmed);
    setRenaming(false);
  }

  return (
    <div className="relative flex-shrink-0">
      {/* Tab button */}
      <button
        onClick={onSelect}
        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
          active
            ? 'border-accent-gold text-text-primary'
            : 'border-transparent text-text-muted hover:text-text-secondary hover:border-border-light'
        }`}
      >
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: category.color }}
        />
        {renaming ? (
          <input
            ref={inputRef}
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
              if (e.key === 'Escape') { setRenaming(false); setNameInput(category.name); }
            }}
            onClick={(e) => e.stopPropagation()}
            className="bg-transparent border-b border-accent-gold outline-none w-28 text-text-primary"
          />
        ) : (
          <span>{category.name}</span>
        )}
        <span className={`text-xs font-mono ${active ? 'text-text-muted' : 'text-border-light'}`}>
          {count}
        </span>
      </button>

      {/* Context menu trigger */}
      <button
        onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
        className={`absolute top-2 right-0 w-5 h-5 rounded flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors text-xs ${
          menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
        style={{ opacity: menuOpen ? 1 : undefined }}
      >
        ⋯
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 bg-bg-elevated border border-border rounded-lg shadow-modal py-1 min-w-[140px] animate-fade-in">
            <button
              onClick={() => { setRenaming(true); setMenuOpen(false); }}
              className="w-full text-left px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-card transition-colors"
            >
              Rename
            </button>
            <button
              onClick={async () => { setMenuOpen(false); await onDelete(); }}
              className="w-full text-left px-4 py-2 text-sm text-accent-red hover:bg-accent-red-muted transition-colors"
            >
              Delete collection
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Library page ─────────────────────────────────────────────────────────────
export default function LibraryPage() {
  const { categories, loading: catsLoading, createCategory, updateCategory, deleteCategory } = useCategories();
  const { books, loading: booksLoading, createBook, deleteBook } = useBooks();

  const [activeTab, setActiveTab]           = useState<string | null>(null); // null = All
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [showAddBook, setShowAddBook]       = useState(false);

  const loading = catsLoading || booksLoading;
  const uncategorized = books.filter((b) => !b.category_id);

  // If the active collection tab gets deleted, fall back to All
  useEffect(() => {
    if (activeTab && activeTab !== '__uncategorized' && !categories.find((c) => c.id === activeTab)) {
      setActiveTab(null);
    }
  }, [categories, activeTab]);

  const filteredBooks = (() => {
    if (activeTab === null) return books;
    if (activeTab === '__uncategorized') return uncategorized;
    return books.filter((b) => b.category_id === activeTab);
  })();

  // Pre-select the active collection when opening Add Book
  const defaultCategory = activeTab && activeTab !== '__uncategorized' ? activeTab : null;

  const activeCategory = categories.find((c) => c.id === activeTab) ?? null;

  return (
    <div className="max-w-6xl mx-auto px-6 pt-10">
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-text-primary tracking-tight">
            Your Library
          </h1>
          <p className="text-text-muted text-sm font-mono mt-1">
            {books.length} book{books.length !== 1 ? 's' : ''} &middot; {categories.length} collection{categories.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowCreateCategory(true)} className="btn-ghost text-xs">
            + New Collection
          </button>
          <button onClick={() => setShowAddBook(true)} className="btn-primary">
            + Add Book
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-stretch border-b border-border overflow-x-auto mb-8 gap-0 group">
        {/* All */}
        <button
          onClick={() => setActiveTab(null)}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors flex-shrink-0 ${
            activeTab === null
              ? 'border-accent-gold text-text-primary'
              : 'border-transparent text-text-muted hover:text-text-secondary hover:border-border-light'
          }`}
        >
          All
          <span className="text-xs font-mono text-text-muted">{books.length}</span>
        </button>

        {/* Collection tabs */}
        {!loading && categories.map((cat) => (
          <CollectionTab
            key={cat.id}
            category={cat}
            count={books.filter((b) => b.category_id === cat.id).length}
            active={activeTab === cat.id}
            onSelect={() => setActiveTab(cat.id)}
            onRename={async (name) => { await updateCategory(cat.id, { name }); }}
            onDelete={async () => { await deleteCategory(cat.id); }}
          />
        ))}

        {/* Uncategorized (only shown if there are books without a category) */}
        {!loading && uncategorized.length > 0 && (
          <button
            onClick={() => setActiveTab('__uncategorized')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors flex-shrink-0 ${
              activeTab === '__uncategorized'
                ? 'border-accent-gold text-text-primary'
                : 'border-transparent text-text-muted hover:text-text-secondary hover:border-border-light'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-border flex-shrink-0" />
            Uncategorized
            <span className="text-xs font-mono text-text-muted">{uncategorized.length}</span>
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-32">
          <Spinner />
        </div>
      ) : filteredBooks.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-10">
          {filteredBooks.map((book) => (
            <BookCard key={book.id} book={book} onDelete={deleteBook} />
          ))}
        </div>
      ) : (
        <div className="text-center py-24 pb-10">
          <div className="font-display text-5xl text-text-muted/20 mb-4">◈</div>
          {books.length === 0 ? (
            <>
              <h2 className="font-display text-xl text-text-secondary font-semibold mb-2">
                Your library is empty
              </h2>
              <p className="text-text-muted text-sm mb-6">
                Create a collection and add your first book to get started.
              </p>
              <button onClick={() => setShowCreateCategory(true)} className="btn-primary">
                Create your first collection
              </button>
            </>
          ) : (
            <>
              <h2 className="font-display text-xl text-text-secondary font-semibold mb-2">
                No books in {activeCategory?.name ?? 'this collection'}
              </h2>
              <p className="text-text-muted text-sm mb-6">
                Add a book to get started.
              </p>
              <button onClick={() => setShowAddBook(true)} className="btn-primary">
                + Add Book
              </button>
            </>
          )}
        </div>
      )}

      {/* Modals */}
      {showCreateCategory && (
        <CreateCategoryModal
          onClose={() => setShowCreateCategory(false)}
          onCreate={async (data) => {
            const created = await createCategory(data);
            setShowCreateCategory(false);
            setActiveTab(created.id); // switch to the new collection
          }}
        />
      )}

      {showAddBook && (
        <AddBookModal
          categories={categories}
          defaultCategoryId={defaultCategory}
          onClose={() => setShowAddBook(false)}
          onCreate={async (data) => {
            await createBook(data);
            setShowAddBook(false);
          }}
        />
      )}
    </div>
  );
}
