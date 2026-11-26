import { useEffect } from 'react'

export function useKeyboardShortcut(key: string, action: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const handle = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== key || event.defaultPrevented || (event.repeat && key !== ' ') || event.isComposing || event.ctrlKey || event.altKey || event.metaKey) return
      if (document.querySelector('dialog[open]')) return
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest('input:not([type="range"]), textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"]')) return
      // Consume held Space too, so keyup cannot activate the focused button.
      event.preventDefault()
      if (!event.repeat) action()
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [key, action, enabled])
}
