'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import type { User } from '@supabase/supabase-js';

export default function Navbar({ user }: { user: User }) {
  const [signingOut, setSigningOut] = useState(false);
  const [visible, setVisible] = useState(true);
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const isOnline = useOnlineStatus();
  const isReader = pathname?.startsWith('/reader/');
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isReader) {
      setVisible(true);
      return;
    }

    // Auto-hide after 3s of inactivity in the reader
    const scheduleHide = () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setVisible(false), 3000);
    };

    scheduleHide();

    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientY < 72) {
        // Cursor near top — reveal
        setVisible(true);
        if (hideTimer.current) clearTimeout(hideTimer.current);
      } else {
        // Cursor moved away — start hide timer if not already running
        scheduleHide();
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [isReader]);

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push('/login');
  }

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const name = (user?.user_metadata?.full_name ?? user?.email) as string | undefined;

  return (
    <header
      className={`sticky top-0 z-40 border-b border-border bg-bg-primary/90 backdrop-blur-sm transition-transform duration-300 ${
        isReader && !visible ? '-translate-y-full' : 'translate-y-0'
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/library" className="font-display text-xl font-bold text-text-primary tracking-tight">
          Read<span className="text-accent-gold">Stack</span>
        </Link>

        <div className="flex items-center gap-4">
          {!isOnline && (
            <div className="flex items-center gap-1.5 text-2xs font-mono text-accent-gold bg-accent-gold-muted px-2.5 py-1 rounded-full border border-accent-gold/20">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-gold" />
              Offline
            </div>
          )}

          <div className="flex items-center gap-3">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={name}
                className="w-7 h-7 rounded-full ring-1 ring-border"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-bg-elevated ring-1 ring-border flex items-center justify-center text-xs text-text-secondary font-mono">
                {name?.[0]?.toUpperCase()}
              </div>
            )}
            <span className="text-sm text-text-secondary hidden sm:block truncate max-w-[140px]">
              {name}
            </span>
          </div>

          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="text-xs text-text-muted hover:text-text-secondary transition-colors font-mono disabled:opacity-50"
          >
            {signingOut ? '…' : 'Sign out'}
          </button>
        </div>
      </div>
    </header>
  );
}
