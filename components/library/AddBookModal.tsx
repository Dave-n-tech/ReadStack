'use client';

import { useState, useRef } from 'react';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import type { Category } from '@/types';

const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`;

interface AddBookData {
  title: string;
  author: string | null;
  categoryId: string | null;
  cloudinaryPublicId: string | null;
  pdfUrl: string | null;
  totalPages: number | null;
}

interface AddBookModalProps {
  categories: Category[];
  defaultCategoryId: string | null;
  onClose: () => void;
  onCreate: (data: AddBookData) => Promise<void>;
}

export default function AddBookModal({
  categories,
  defaultCategoryId,
  onClose,
  onCreate,
}: AddBookModalProps) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [categoryId, setCategoryId] = useState(defaultCategoryId ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSubmit() {
    if (!title.trim()) return setError('Title is required');
    setError(null);
    setUploading(true);

    try {
      let pdfUrl: string | null = null;
      let cloudinaryPublicId: string | null = null;
      const totalPages: number | null = null;

      if (file) {
        const sigRes = await fetch('/api/upload-sig', { method: 'POST' });
        if (!sigRes.ok) throw new Error('Failed to get upload signature');
        const { signature, timestamp, apiKey, folder } = await sigRes.json();

        const formData = new FormData();
        formData.append('file', file);
        formData.append('signature', signature);
        formData.append('timestamp', timestamp);
        formData.append('api_key', apiKey);
        formData.append('folder', folder);

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', CLOUDINARY_UPLOAD_URL);
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              setUploadProgress(Math.round((e.loaded / e.total) * 100));
            }
          };
          xhr.onload = () => {
            if (xhr.status === 200) {
              const result = JSON.parse(xhr.responseText);
              pdfUrl = result.secure_url;
              cloudinaryPublicId = result.public_id;
              resolve();
            } else {
              reject(new Error('Upload failed'));
            }
          };
          xhr.onerror = () => reject(new Error('Upload failed'));
          xhr.send(formData);
        });
      }

      await onCreate({
        title: title.trim(),
        author: author.trim() || null,
        categoryId: categoryId || null,
        cloudinaryPublicId,
        pdfUrl,
        totalPages,
      });
    } catch (err) {
      setError((err as Error).message);
      setUploading(false);
      setUploadProgress(0);
    }
  }

  return (
    <Modal title="Add a Book" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="label">Title *</label>
          <input
            className="input"
            placeholder="Book title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={uploading}
          />
        </div>

        <div>
          <label className="label">Author</label>
          <input
            className="input"
            placeholder="Author name"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            disabled={uploading}
          />
        </div>

        <div>
          <label className="label">Collection</label>
          <select
            className="input"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            disabled={uploading}
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
            onClick={() => !uploading && fileRef.current?.click()}
            className={`border border-dashed border-border rounded-lg p-6 text-center cursor-pointer transition-colors ${!uploading ? 'hover:border-accent-gold/40 hover:bg-accent-gold-muted/30' : 'opacity-50 cursor-not-allowed'}`}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="min-w-0">
                <p className="text-sm text-text-primary truncate">{file.name}</p>
                <p className="text-xs text-text-muted mt-1">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-text-secondary">Click to select a PDF</p>
                <p className="text-xs text-text-muted mt-1">You can also add a book without a PDF and upload it later</p>
              </div>
            )}
          </div>

          {uploading && uploadProgress > 0 && (
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
        <button onClick={onClose} disabled={uploading} className="btn-ghost">
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!title.trim() || uploading}
          className="btn-primary flex items-center gap-2"
        >
          {uploading && <Spinner size="sm" />}
          {uploading ? 'Adding…' : 'Add Book'}
        </button>
      </div>
    </Modal>
  );
}
