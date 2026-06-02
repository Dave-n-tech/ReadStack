import clsx from 'clsx';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
}

export default function Spinner({ size = 'md' }: SpinnerProps) {
  return (
    <span
      className={clsx(
        'inline-block rounded-full border-2 border-border border-t-accent-gold animate-spin-slow',
        size === 'sm' && 'w-3.5 h-3.5',
        size === 'md' && 'w-5 h-5',
        size === 'lg' && 'w-8 h-8',
      )}
    />
  );
}
