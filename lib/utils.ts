import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * `cn` — composable className helper. Merges Tailwind classes intelligently
 * so later utilities override earlier ones (e.g. `cn('p-2', cond && 'p-4')`).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Format a Firestore Timestamp / Date / number into a relative-ish string.
 * Used in the SOS feed and coordinator dashboard.
 */
export function timeAgo(input: Date | number): string {
  const ts = typeof input === 'number' ? input : input.getTime();
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
