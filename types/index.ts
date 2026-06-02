export interface Category {
  id: string;
  name: string;
  color: string;
  position: number;
  user_id: string;
  created_at?: string;
}

export interface Book {
  id: string;
  title: string;
  author: string | null;
  category_id: string | null;
  categories?: {
    id: string;
    name: string;
    color: string;
  } | null;
  pdf_url: string | null;
  cloudinary_public_id: string | null;
  pdf_status: 'active' | 'evicted';
  current_page: number;
  total_pages: number | null;
  last_opened_at: string | null;
  uploaded_at: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface SyncQueueItem {
  id: number;
  type: 'progress';
  payload: {
    bookId: string;
    currentPage: number;
  };
  timestamp: number;
  retries: number;
}

export interface CachedPDF {
  bookId: string;
  arrayBuffer: ArrayBuffer;
  totalPages: number;
  cachedAt: number;
}

export interface UploadSignature {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
}
