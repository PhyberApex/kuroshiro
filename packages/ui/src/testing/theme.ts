import { settled } from './paint'

export const THEMES = ['light', 'dark'] as const

export type Theme = typeof THEMES[number]

export async function forceTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  await settled()
}
