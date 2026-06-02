# ReadStack — Setup Guide

## Prerequisites
- Node.js 18+
- A Supabase account (free) — supabase.com
- A Cloudinary account (free) — cloudinary.com
- A Vercel account (free, for deployment) — vercel.com

---

## 1. Clone and install

```bash
pnpm install
cp .env.local.example .env.local
```

---

## 2. Supabase setup (~3 min)

1. Go to [supabase.com](https://supabase.com) → New Project
2. Choose a name, set a database password, pick a region close to you
3. Once created, go to **Project Settings → API**
4. Copy into `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL` → Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → anon/public key
   - `SUPABASE_SERVICE_ROLE_KEY` → service_role key (keep secret)
5. Go to **SQL Editor → New Query**, paste the contents of `supabase/schema.sql`, and run it
6. Enable Google OAuth:
   - Go to **Authentication → Providers → Google**
   - Enable it and follow the instructions to create a Google OAuth app
   - Set the redirect URL to: `https://your-project.supabase.co/auth/v1/callback`

---

## 3. Cloudinary setup (~2 min)

1. Go to [cloudinary.com](https://cloudinary.com) → Sign up / Dashboard
2. Copy into `.env.local`:
   - `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` → Cloud name
   - `CLOUDINARY_API_KEY` → API Key
   - `CLOUDINARY_API_SECRET` → API Secret
3. Go to **Settings → Upload → Upload presets** — no changes needed (we use signed uploads)

---

## 4. App URL and cron secret

In `.env.local`:
```
NEXT_PUBLIC_APP_URL=http://localhost:3000   # Change to your domain when deploying
CRON_SECRET=<run: openssl rand -base64 32>
```

---

## 5. Run locally

```bash
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 6. Deploy to Vercel

```bash
pnpm install -g vercel
vercel
```

- Add all `.env.local` variables to Vercel's Environment Variables
- Update `NEXT_PUBLIC_APP_URL` to your production URL
- Update the Google OAuth redirect URL in Supabase to your production URL
- Vercel will automatically pick up `vercel.json` and run the eviction cron daily at 2 AM UTC

---

## How PDF eviction works

Books that haven't been opened in **30 days** have their PDFs deleted from Cloudinary automatically. Your reading progress, title, author, and collection are kept forever — only the file is removed. Re-uploading the PDF resumes from your last page.

---

## Swapping the database later

All database logic lives in `lib/db/repositories/`. To switch providers:

1. Create new repository files with the same function signatures
2. Update `lib/db/index.js` to import the new files
3. That's it — no other code changes needed

---

## Project structure

```
app/                    Next.js App Router pages + API routes
components/             React components (library, reader, ui)
hooks/                  Client-side data hooks
lib/
  supabase/             Supabase clients (server + browser)
  db/repositories/      Database access layer (swap-friendly)
  cache/                IndexedDB (PDF cache + offline sync queue)
  cloudinary.js         Cloudinary server-side helpers
supabase/schema.sql     Database schema + RLS policies
vercel.json             Cron job configuration
```
