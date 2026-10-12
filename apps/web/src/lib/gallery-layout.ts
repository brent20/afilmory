/**
 * Gallery layout switches. Flip any of these between true and false and redeploy.
 */

/**
 * Roomier layout: wider page margins, bigger gaps between photos and more space above the grid.
 * Set to false to go back to the original tight layout.
 */
export const GALLERY_ROOMY_LAYOUT = true

/**
 * Show the first batch of photos with a "Show more" button instead of one very long page.
 * Set to false to load everything at once, as before.
 */
export const GALLERY_SHOW_MORE = true

/** How many photos appear at first, and how many more each click on "Show more" adds. */
export const GALLERY_BATCH_SIZE = 30

/**
 * Tick-mark timeline on the right edge (desktop, grid view). Click or drag along it to jump to a month.
 * Set to false to hide it.
 */
export const GALLERY_TIMELINE = true

/** Gap between photos in the grid, in pixels. */
export const GALLERY_GUTTER = GALLERY_ROOMY_LAYOUT ? { mobile: 8, desktop: 16 } : { mobile: 4, desktop: 4 }

/** Space on the left and right of the grid, in pixels (used to work out how many columns fit). */
export const GALLERY_SIDE_PADDING = GALLERY_ROOMY_LAYOUT ? { mobile: 24, desktop: 96 } : { mobile: 8, desktop: 32 }
