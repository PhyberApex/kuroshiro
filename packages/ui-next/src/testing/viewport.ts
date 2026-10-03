import { page } from 'vitest/browser'
import { settled } from './paint'

/** The two widths a page is shot at; the phone layout starts below 820 px. */
export const VIEWPORTS = {
  phone: { width: 375, height: 812 },
  desktop: { width: 1280, height: 800 },
} as const

export type ViewportName = keyof typeof VIEWPORTS

/** Resizes the page and waits until the new layout is painted. */
export async function resizeTo(width: number, height: number = VIEWPORTS.desktop.height) {
  await page.viewport(width, height)
  await settled()
}

export function resetViewport() {
  return resizeTo(VIEWPORTS.desktop.width)
}
