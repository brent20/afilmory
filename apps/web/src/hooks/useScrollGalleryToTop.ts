import { useScrollViewElement } from '@afilmory/ui'
import { useCallback } from 'react'

/**
 * Returns a function that jumps the gallery back to the very top of the page.
 *
 * On desktop the gallery scrolls inside a scroll area; on mobile the page itself scrolls.
 * Both are reset so it works everywhere.
 */
export const useScrollGalleryToTop = () => {
  const scrollElement = useScrollViewElement()

  return useCallback(() => {
    const jump = () => {
      if (scrollElement) {
        scrollElement.scrollTop = 0
      }
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }

    jump()

    // Clicking a collection changes the photos on screen. Jump once more after the new
    // layout has been drawn so the page can't be left part-way down.
    requestAnimationFrame(() => requestAnimationFrame(jump))
  }, [scrollElement])
}
