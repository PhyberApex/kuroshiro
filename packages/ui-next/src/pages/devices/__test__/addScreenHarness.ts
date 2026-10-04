import type { MountedApp } from './screensViewHarness'
import { expect } from 'vitest'
import { mountApp } from '@/testing/app'
import { NEW_SCREEN_ID } from './screensViewHarness'

/** Add Screen for Kitchen, opened with the kind the address names. */
export async function mountAddScreen(kind?: string) {
  const screen = await mountApp({ at: `/devices/kitchen/screens/new${kind ? `?kind=${kind}` : ''}` })
  await expect.element(screen.getByRole('heading', { name: 'Add Screen', level: 2 })).toBeVisible()
  return screen
}

export function kindOf(screen: MountedApp, name: string) {
  return screen.getByRole('radiogroup', { name: 'Kind of Screen' }).getByRole('radio', { name, exact: true })
}

export const nameField = (screen: MountedApp) => screen.getByRole('textbox', { name: 'Name', exact: true })

export const path = (screen: MountedApp) => screen.router.currentRoute.value.fullPath

/** The Screens view, opened on the Screen that was just added. */
export const OPENED_ON_THE_NEW_SCREEN = `/devices/kitchen?screen=${NEW_SCREEN_ID}`
