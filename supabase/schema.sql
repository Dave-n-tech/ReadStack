-- ═══════════════════════════════════════════════════════════
-- ReadStack Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════

-- ─── Users ──────────────────────────────────────────────────
-- Extends Supabase's built-in auth.users table.
-- Populated on first sign-in via /api/auth/callback.

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT,
  email         TEXT NOT NULL,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Categories ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#6EBF8B',
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_category_name_per_user UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);

-- ─── Books ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS books (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id           UUID REFERENCES categories(id) ON DELETE SET NULL,

  -- Metadata
  title                 TEXT NOT NULL,
  author                TEXT,

  -- Storage
  cloudinary_public_id  TEXT,
  pdf_url               TEXT,
  pdf_status            TEXT NOT NULL DEFAULT 'active'
                          CHECK (pdf_status IN ('active', 'evicted', 'uploading')),

  -- Reading state
  current_page          INTEGER NOT NULL DEFAULT 1,
  total_pages           INTEGER,

  -- Timestamps
  last_opened_at        TIMESTAMPTZ,
  uploaded_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_books_user_id        ON books(user_id);
CREATE INDEX IF NOT EXISTS idx_books_category_id    ON books(category_id);
CREATE INDEX IF NOT EXISTS idx_books_last_opened_at ON books(last_opened_at);
CREATE INDEX IF NOT EXISTS idx_books_pdf_status     ON books(pdf_status);

-- ─── Row Level Security ──────────────────────────────────────
-- Users can only read/write their own data.

ALTER TABLE users      ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE books      ENABLE ROW LEVEL SECURITY;

-- Users
CREATE POLICY "users: select own" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users: insert own" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "users: update own" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Categories
CREATE POLICY "categories: select own" ON categories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "categories: insert own" ON categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "categories: update own" ON categories
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "categories: delete own" ON categories
  FOR DELETE USING (auth.uid() = user_id);

-- Books
CREATE POLICY "books: select own" ON books
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "books: insert own" ON books
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "books: update own" ON books
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "books: delete own" ON books
  FOR DELETE USING (auth.uid() = user_id);

-- ─── Auto-update updated_at ─────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER books_updated_at
  BEFORE UPDATE ON books
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
