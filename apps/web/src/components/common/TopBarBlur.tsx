import { clsxm } from '@afilmory/utils'

/**
 * Keeps page content blurred as it scrolls up past a header and into the area behind the clock and
 * Dynamic Island (Safari lets the page run under its top bar). Place it inside the header; it sits
 * directly above it. On desktop and in browsers without that area it is off-screen and does nothing.
 */
export const TopBarBlur = ({ className }: { className?: string }) => (
  <div
    aria-hidden
    className={clsxm(
      'bg-background/50 pointer-events-none absolute inset-x-0 bottom-full h-[60svh] backdrop-blur-[56px] lg:hidden',
      className,
    )}
  />
)
