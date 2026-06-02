'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';

const PRESET_COLORS = [
  '#6EBF8B', '#D4A853', '#6B9FD4', '#E05C5C',
  '#A78BFA', '#F97316', '#EC4899', '#14B8A6',
];

interface CreateCategoryModalProps {
  onClose: () => void;
  onCreate: (data: { name: string; color: string }) => Promise<void>;
}

export default function CreateCategoryModal({ onClose, onCreate }: CreateCategoryModalProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!name.trim()) return setError('Name is required');
    setSaving(true);
    setError(null);
    try {
      await onCreate({ name: name.trim(), color });
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <Modal title="New Collection" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="label">Name *</label>
          <input
            autoFocus
            className="input"
            placeholder="e.g. Interview Prep, Personal Growth"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            disabled={saving}
          />
        </div>

        <div>
          <label className="label">Color</label>
          <div className="flex gap-2 flex-wrap">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="w-7 h-7 rounded-full border-2 transition-all"
                style={{
                  backgroundColor: c,
                  borderColor: color === c ? '#F0EBE1' : 'transparent',
                  transform: color === c ? 'scale(1.15)' : 'scale(1)',
                }}
              />
            ))}
          </div>
        </div>

        {error && (
          <p className="text-sm text-accent-red bg-accent-red-muted border border-accent-red/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <button onClick={onClose} disabled={saving} className="btn-ghost">Cancel</button>
        <button
          onClick={handleSubmit}
          disabled={!name.trim() || saving}
          className="btn-primary"
        >
          {saving ? 'Creating…' : 'Create Collection'}
        </button>
      </div>
    </Modal>
  );
}
