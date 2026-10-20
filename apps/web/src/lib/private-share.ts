/**
 * Tracks whether this page was opened from a private share link (/?s=<secret>).
 * Kept dependency-free so main.tsx can import it before the app loads.
 */
const KEY = '__PRIVATE_SHARE__'

type ShareWindow = Window & { [KEY]?: boolean }

export const markPrivateShare = (): void => {
  ;(window as ShareWindow)[KEY] = true
}

export const isPrivateShare = (): boolean => typeof window !== 'undefined' && (window as ShareWindow)[KEY] === true
