import { useState } from 'react'

/** What a hovered or tapped chart mark says (touch has no hover) */
export const useReadout = () => {
  const [text, setText] = useState('')
  return { text, set: setText, clear: () => setText('') }
}
