'use client';

import { useState, useEffect, useRef } from 'react';
import { useCategories } from '@/hooks/useCategories';
import { useBooks } from '@/hooks/useBooks';
import BookCard from '@/components/library/BookCard';
import CreateCategoryModal from '@/components/library/CreateCategoryModal';
import AddBookModal from '@/components/library/AddBookModal';
import Spinner from '@/components/ui/Spinner';
import type { Category } from '@/types';

function PencilIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3,6 5,6 21,6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

// ─── Collection tab ───────────────────────────────────────────────────────────
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
    <div
      className={`flex items-center border-b-2 flex-shrink-0 transition-colors ${
        active ? 'border-accent-gold' : 'border-transparent'
      }`}
    >
      {/* Main tab button */}
      <button
        onClick={onSelect}
        className={`flex items-center gap-2 pl-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
          active
            ? 'text-text-primary pr-1.5'
            : 'text-text-muted hover:text-text-secondary pr-4'
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
            className="bg-transparent border-b border-accent-gold outline-none w-24 text-text-primary"
          />
        ) : (
          <span>{category.name}</span>
        )}
        <span className={`text-xs font-mono ${active ? 'text-text-muted' : 'text-border-light'}`}>
          {count}
        </span>
      </button>

      {/* Edit / delete — only when this tab is active */}
      {active && !renaming && (
        <div className="flex items-center gap-0.5 pr-3">
          <button
            onClick={() => { setNameInput(category.name); setRenaming(true); }}
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
            title="Rename"
          >
            <PencilIcon />
          </button>
          <button
            onClick={onDelete}
            className="p-1 rounded text-text-muted hover:text-accent-red hover:bg-accent-red-muted transition-colors"
            title="Delete collection"
          >
            <TrashIcon />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Library page ─────────────────────────────────────────────────────────────
export default function LibraryPage() {
  const { categories, loading: catsLoading, createCategory, updateCategory, deleteCategory } = useCategories();
  const { books, loading: booksLoading, createBook, deleteBook } = useBooks();

  const [activeTab, setActiveTab]                   = useState<string | null>(null);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [showAddBook, setShowAddBook]               = useState(false);

  const loading        = catsLoading || booksLoading;
  const uncategorized  = books.filter((b) => !b.category_id);
  const activeCategory = categories.find((c) => c.id === activeTab) ?? null;
  const defaultCategory = activeTab && activeTab !== '__uncategorized' ? activeTab : null;

  const filteredBooks = (() => {
    if (activeTab === null)              return books;
    if (activeTab === '__uncategorized') return uncategorized;
    return books.filter((b) => b.category_id === activeTab);
  })();

  // Fall back to All if the active collection is deleted
  useEffect(() => {
    if (activeTab && activeTab !== '__uncategorized' && !categories.find((c) => c.id === activeTab)) {
      setActiveTab(null);
    }
  }, [categories, activeTab]);

  async function handleDeleteCollection(category: Category) {
    if (!confirm(`Delete "${category.name}"? Books inside will become uncategorized.`)) return;
    await deleteCategory(category.id);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">
            Your Library
          </h1>
          <p className="text-text-muted text-sm font-mono mt-1">
            {books.length} book{books.length !== 1 ? 's' : ''} &middot; {categories.length} collection{categories.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <button onClick={() => setShowCreateCategory(true)} className="btn-ghost text-xs">
            + New Collection
          </button>
          <button onClick={() => setShowAddBook(true)} className="btn-primary">
            + Add Book
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-stretch border-b border-border overflow-x-auto mb-8 gap-0">
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
            onDelete={async () => { await handleDeleteCollection(cat); }}
          />
        ))}

        {/* Uncategorized */}
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
            setActiveTab(created.id);
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
