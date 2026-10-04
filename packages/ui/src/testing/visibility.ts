import { onTestFinished, vi } from 'vitest'

/**
 * Holds the tab visible for the rest of the test. Spec files run side by side and the tab
 * that takes the shots is never in front, so a page that only asks while its tab is visible
 * (`usePolling`) would ask in some runs and not in others.
 */
export function holdTabVisible() {
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  onTestFinished(() => visibility.mockRestore())
}
