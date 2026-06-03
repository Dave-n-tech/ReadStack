'use client';

import { useState, useRef } from 'react';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import type { Category, CreateBookInput } from '@/types';

const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`;

interface UploadResult {
  pdfUrl: string;
  publicId: string;
}

interface AddBookModalProps {
  categories: Category[];
  defaultCategoryId: string | null;
  onClose: () => void;
  onCreate: (data: CreateBookInput) => Promise<void>;
}

export default function AddBookModal({
  categories,
  defaultCategoryId,
  onClose,
  onCreate,
}: AddBookModalProps) {
  const [title,      setTitle]      = useState('');
  const [author,     setAuthor]     = useState('');
  const [categoryId, setCategoryId] = useState(defaultCategoryId ?? '');
  const [file,       setFile]       = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // Background upload state — tracked separately so form fields stay enabled
  const [uploadState,    setUploadState]    = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);

  const fileRef         = useRef<HTMLInputElement>(null);
  const xhrRef          = useRef<XMLHttpRequest | null>(null);
  const uploadResultRef = useRef<UploadResult | null>(null);  // avoids stale closure in handleSubmit
  const uploadPromise   = useRef<Promise<UploadResult> | null>(null);

  // ── Start upload as soon as the user picks a file ──────────────────────────
  function handleFileChange(selected: File | null) {
    // Abort any in-flight upload for the previous file
    xhrRef.current?.abort();
    xhrRef.current = null;
    uploadResultRef.current = null;
    uploadPromise.current = null;

    setFile(selected);
    setError(null);
    setUploadProgress(0);

    if (!selected) {
      setUploadState('idle');
      return;
    }

    setUploadState('uploading');
    const promise = runUpload(selected);
    uploadPromise.current = promise;

    promise.then(
      (result) => {
        uploadResultRef.current = result;
        setUploadState('done');
      },
      (err: Error) => {
        if (err.message === 'aborted') return; // user changed file — ignore
        setUploadState('error');
        setError(`Upload failed: ${err.message}`);
      },
    );
  }

  async function runUpload(f: File): Promise<UploadResult> {
    const sigRes = await fetch('/api/upload-sig', { method: 'POST' });
    if (!sigRes.ok) throw new Error('could not get upload signature');
    const { signature, timestamp, apiKey, folder } = await sigRes.json();

    const formData = new FormData();
    formData.append('file', f);
    formData.append('signature', signature);
    formData.append('timestamp', String(timestamp));
    formData.append('api_key', apiKey);
    formData.append('folder', folder);

    return new Promise<UploadResult>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      xhr.open('POST', CLOUDINARY_UPLOAD_URL);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
      };

      xhr.onload = () => {
        xhrRef.current = null;
        if (xhr.status === 200) {
          const r = JSON.parse(xhr.responseText);
          resolve({ pdfUrl: r.secure_url, publicId: r.public_id });
        } else {
          reject(new Error(`server returned ${xhr.status}`));
        }
      };

      xhr.onerror  = () => { xhrRef.current = null; reject(new Error('network error')); };
      xhr.onabort  = () => { xhrRef.current = null; reject(new Error('aborted')); };
      xhr.send(formData);
    });
  }

  // ── Submit: upload is already done (or nearly done) ────────────────────────
  async function handleSubmit() {
    if (!title.trim()) return setError('Title is required');
    setError(null);
    setSubmitting(true);

    try {
      let pdfUrl: string | null = null;
      let cloudinaryPublicId: string | null = null;

      if (file) {
        if (uploadState === 'error') {
          setSubmitting(false);
          return; // error already shown
        }

        // If upload is still running (user submitted very quickly), wait for it
        if (uploadState === 'uploading' && uploadPromise.current) {
          const result = await uploadPromise.current;
          pdfUrl = result.pdfUrl;
          cloudinaryPublicId = result.publicId;
        } else if (uploadResultRef.current) {
          pdfUrl = uploadResultRef.current.pdfUrl;
          cloudinaryPublicId = uploadResultRef.current.publicId;
        }
      }

      await onCreate({
        title:              title.trim(),
        author:             author.trim() || null,
        categoryId:         categoryId || null,
        cloudinaryPublicId,
        pdfUrl,
        totalPages:         null,
      });
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  function handleClose() {
    xhrRef.current?.abort();
    onClose();
  }

  const busy = submitting || (uploadState === 'uploading' && submitting);

  return (
    <Modal title="Add a Book" onClose={handleClose}>
      <div className="space-y-4">
        <div>
          <label className="label">Title *</label>
          <input
            autoFocus
            className="input"
            placeholder="Book title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={submitting}
          />
        </div>

        <div>
          <label className="label">Author</label>
          <input
            className="input"
            placeholder="Author name"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            disabled={submitting}
          />
        </div>

        <div>
          <label className="label">Collection</label>
          <select
            className="input"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            disabled={submitting}
          >
            <option value="">No collection</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">PDF File</label>
          <div
            onClick={() => !submitting && fileRef.current?.click()}
            className={`border border-dashed rounded-lg p-6 text-center transition-colors ${
              uploadState === 'done'
                ? 'border-accent-green/40 bg-accent-green-muted/20 cursor-pointer'
                : uploadState === 'error'
                ? 'border-accent-red/40 bg-accent-red-muted/20 cursor-pointer'
                : submitting
                ? 'border-border opacity-50 cursor-not-allowed'
                : 'border-border cursor-pointer hover:border-accent-gold/40 hover:bg-accent-gold-muted/30'
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="min-w-0 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-text-primary truncate">{file.name}</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {(file.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
                {uploadState === 'uploading' && (
                  <Spinner size="sm" />
                )}
                {uploadState === 'done' && (
                  <span className="text-accent-green text-xs font-mono flex-shrink-0">✓ ready</span>
                )}
                {uploadState === 'error' && (
                  <span className="text-accent-red text-xs font-mono flex-shrink-0">✗ failed</span>
                )}
              </div>
            ) : (
              <div>
                <p className="text-sm text-text-secondary">Click to select a PDF</p>
                <p className="text-xs text-text-muted mt-1">
                  You can also add a book without a PDF and upload it later
                </p>
              </div>
            )}
          </div>

          {/* Upload progress bar — shown while uploading */}
          {uploadState === 'uploading' && uploadProgress > 0 && (
            <div className="mt-2">
              <div className="flex justify-between text-xs font-mono text-text-muted mb-1">
                <span>Uploading…</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-1 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent-gold rounded-full transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="text-sm text-accent-red bg-accent-red-muted border border-accent-red/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <button onClick={handleClose} disabled={submitting} className="btn-ghost">
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!title.trim() || submitting || uploadState === 'error'}
          className="btn-primary flex items-center gap-2"
        >
          {submitting && <Spinner size="sm" />}
          {submitting
            ? uploadState === 'uploading' ? 'Uploading…' : 'Saving…'
            : 'Add Book'}
        </button>
      </div>
    </Modal>
  );
}
