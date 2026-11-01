import { useEffect } from 'react'
import { Outlet } from 'react-router'

import { useCommandPaletteShortcut } from './hooks/useCommandPaletteShortcut'
import { useTrackLastPage } from './hooks/usePhotoViewer'
import { CommandPalette } from './modules/cmdk/CommandPalette'
import { RootProviders } from './providers/root-providers'

// prefetch preview page route
function App() {
  // Remember the last non-photo page so closing the photo viewer can return to it.
  useTrackLastPage()

  useEffect(() => {
    import('~/pages/(main)/photos/[photoId]/index')
  }, [])

  return (
    <RootProviders>
      <div className="overflow-hidden lg:h-svh">
        <Outlet />
        <CommandPaletteContainer />
      </div>
    </RootProviders>
  )
}

const CommandPaletteContainer = () => {
  const { isOpen, setIsOpen } = useCommandPaletteShortcut()
  return <CommandPalette isOpen={isOpen} onClose={() => setIsOpen(false)} />
}
export default App
