import type { ScreenRead } from 'kuroshiro-shared'
import { ref, watch } from 'vue'
import { updateScreen } from '@/api/screens'
import { useSaveAsChanged } from '@/components/useSaveAsChanged'

/**
 * A File or External link Screen's Dithering switch, saved as changed: the switch alone is sent, then the Screens
 * are read again. A Screen read again with another value (a save elsewhere) is taken over unless a save is under way.
 */
export function useScreenDither(screen: () => ScreenRead, reload: () => Promise<void>) {
  const dither = ref(screen().dither)
  const save = useSaveAsChanged(async (entered: boolean) => {
    const saved = await updateScreen(screen().id, { dither: entered })
    await reload()
    return saved.dither
  }, dither)

  watch(() => screen().dither, (saved) => {
    if (save.status !== 'saving')
      dither.value = saved
  })

  function switchTo(on: boolean) {
    dither.value = on
    save.commit()
  }

  return { dither, save, switchTo }
}
