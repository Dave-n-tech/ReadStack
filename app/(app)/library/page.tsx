'use client';

import { useState } from 'react';
import { useCategories } from '@/hooks/useCategories';
import { useBooks } from '@/hooks/useBooks';
import CategorySection from '@/components/library/CategorySection';
import CreateCategoryModal from '@/components/library/CreateCategoryModal';
import AddBookModal from '@/components/library/AddBookModal';
import Spinner from '@/components/ui/Spinner';

export default function LibraryPage() {
  const { categories, loading: catsLoading, createCategory, updateCategory, deleteCategory } = useCategories();
  const { books, loading: booksLoading, createBook, deleteBook } = useBooks();
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [showAddBook, setShowAddBook] = useState(false);
  const [addBookCategory, setAddBookCategory] = useState<string | null>(null);

  const loading = catsLoading || booksLoading;

  function handleAddBookToCategory(categoryId: string) {
    setAddBookCategory(categoryId);
    setShowAddBook(true);
  }

  const uncategorized = books.filter((b) => !b.category_id);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-end justify-between mb-10">
        <div>
          <h1 className="font-display text-3xl font-bold text-text-primary tracking-tight">
            Your Library
          </h1>
          <p className="text-text-muted text-sm font-mono mt-1">
            {books.length} book{books.length !== 1 ? 's' : ''} across {categories.length} collection{categories.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateCategory(true)}
            className="btn-ghost text-xs"
          >
            + New Collection
          </button>
          <button
            onClick={() => { setAddBookCategory(null); setShowAddBook(true); }}
            className="btn-primary"
          >
            + Add Book
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-12">
          {categories.map((category) => (
            <CategorySection
              key={category.id}
              category={category}
              books={books.filter((b) => b.category_id === category.id)}
              onAddBook={() => handleAddBookToCategory(category.id)}
              onDeleteBook={deleteBook}
              onEditCategory={updateCategory}
              onDeleteCategory={deleteCategory}
            />
          ))}

          {uncategorized.length > 0 && (
            <CategorySection
              category={{ id: null, name: 'Uncategorized', color: '#4A5568', position: 0, user_id: '' }}
              books={uncategorized}
              onAddBook={() => { setAddBookCategory(null); setShowAddBook(true); }}
              onDeleteBook={deleteBook}
              onEditCategory={null}
              onDeleteCategory={null}
            />
          )}

          {categories.length === 0 && books.length === 0 && (
            <div className="text-center py-24">
              <div className="font-display text-5xl text-text-muted/20 mb-4">◈</div>
              <h2 className="font-display text-xl text-text-secondary font-semibold mb-2">
                Your library is empty
              </h2>
              <p className="text-text-muted text-sm mb-6">
                Create a collection and add your first book to get started.
              </p>
              <button
                onClick={() => setShowCreateCategory(true)}
                className="btn-primary"
              >
                Create your first collection
              </button>
            </div>
          )}
        </div>
      )}

      {showCreateCategory && (
        <CreateCategoryModal
          onClose={() => setShowCreateCategory(false)}
          onCreate={async (data) => {
            await createCategory(data);
            setShowCreateCategory(false);
          }}
        />
      )}

      {showAddBook && (
        <AddBookModal
          categories={categories}
          defaultCategoryId={addBookCategory}
          onClose={() => { setShowAddBook(false); setAddBookCategory(null); }}
          onCreate={async (data) => {
            await createBook(data);
            setShowAddBook(false);
            setAddBookCategory(null);
          }}
        />
      )}
    </div>
  );
}
