import { ref, watch } from 'vue'

const APPEARANCES = ['system', 'light', 'dark'] as const

export type Appearance = typeof APPEARANCES[number]

export const APPEARANCE_STORAGE_KEY = 'kuroshiro:appearance'

const isAppearance = (value: unknown): value is Appearance => APPEARANCES.includes(value as Appearance)

/** A browser that refuses storage (a private window) follows the system and forgets a choice with the tab. */
function storedAppearance(): Appearance {
  try {
    const stored = localStorage.getItem(APPEARANCE_STORAGE_KEY)
    return isAppearance(stored) ? stored : 'system'
  }
  catch {
    return 'system'
  }
}

function storeAppearance(appearance: Appearance) {
  try {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, appearance)
  }
  catch {}
}

/** The tokens follow `color-scheme`, which follows the system unless `data-theme` on the root forces one side. */
function showAppearance(appearance: Appearance) {
  if (appearance === 'system')
    delete document.documentElement.dataset.theme
  else
    document.documentElement.dataset.theme = appearance
}

/** Puts the side this browser chose in force. Called before the app mounts, so a chosen side does not flash the other one. */
export function applyStoredAppearance() {
  showAppearance(storedAppearance())
}

/** The side the admin UI is shown in: "system" follows the system preference. Kept in this browser and saved nowhere else. */
export function useAppearance() {
  const appearance = ref(storedAppearance())
  watch(appearance, (chosen) => {
    storeAppearance(chosen)
    showAppearance(chosen)
  })
  return appearance
}
