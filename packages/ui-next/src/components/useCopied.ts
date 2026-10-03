import { computed, onBeforeUnmount, ref } from 'vue'
import { copyText } from './copyText'

const COPIED_FOR_MS = 2000

/**
 * The state of a "Copy" button: `copy` writes what `text` gives to the clipboard, and
 * `showsCopied` is true for 2 seconds after it got there, or for as long as `held` says so.
 */
export function useCopied(text: () => string, held: () => boolean | undefined) {
  const justCopied = ref(false)
  let revertTimer: ReturnType<typeof setTimeout> | undefined

  async function copy() {
    if (!await copyText(text()))
      return
    justCopied.value = true
    clearTimeout(revertTimer)
    revertTimer = setTimeout(() => {
      justCopied.value = false
    }, COPIED_FOR_MS)
  }

  onBeforeUnmount(() => clearTimeout(revertTimer))

  return { copy, showsCopied: computed(() => held() || justCopied.value) }
}
