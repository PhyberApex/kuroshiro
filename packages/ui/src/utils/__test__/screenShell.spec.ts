import type { RenderTarget } from '../screenShell'
import type { DeviceModel, Palette } from '@/types'
import { describe, expect, it } from 'vitest'
import { SCREEN_SHELL_FIXTURE_BODY, SCREEN_SHELL_FIXTURE_EXPECTED, SCREEN_SHELL_FIXTURE_MODEL, SCREEN_SHELL_FIXTURE_PALETTE } from '../../../../../test/fixtures/screen-shell.fixture'
import { screenClasses, screenStyle, viewFull, wrapInScreenShell } from '../screenShell'

const fixtureTarget = { model: SCREEN_SHELL_FIXTURE_MODEL, palette: SCREEN_SHELL_FIXTURE_PALETTE } as unknown as RenderTarget

const V2: DeviceModel = {
  name: 'v2',
  label: 'TRMNL X',
  width: 1872,
  height: 1404,
  colors: 16,
  bitDepth: 4,
  scaleFactor: 1.8,
  rotation: 0,
  offsetX: 0,
  offsetY: 0,
  mimeType: 'image/png',
  kind: 'trmnl',
  paletteIds: ['gray-16', 'gray-4', 'bw'],
  cssClasses: ['screen--v2', 'screen--lg', 'screen--density-2x'],
  cssVariables: { '--screen-w': '1040px', '--screen-h': '780px' },
  deprecated: false,
}
const GRAY_16: Palette = { id: 'gray-16', name: '16 Grays (4-bit)', grays: 16, frameworkClass: 'screen--4bit', deprecated: false }

describe('screenShell', () => {
  it('builds the same class list as the API', () => {
    expect(screenClasses({ model: V2, palette: GRAY_16 })).toEqual(['screen', 'screen--v2', 'screen--lg', 'screen--density-2x', 'screen--4bit'])
  })

  it('emits no orientation class regardless of model.rotation', () => {
    expect(screenClasses({ model: { ...V2, rotation: 90 }, palette: GRAY_16 })).not.toContain('screen--portrait')
    expect(screenClasses({ model: { ...V2, rotation: 90 }, palette: GRAY_16 })).not.toContain('screen--landscape')
  })

  it('serialises css variables', () => {
    expect(screenStyle({ model: V2, palette: GRAY_16 })).toBe('--screen-w: 1040px; --screen-h: 780px;')
  })

  it('wraps a body into a full document with the framework assets', () => {
    const html = wrapInScreenShell({ model: V2, palette: GRAY_16 }, viewFull('<p>x</p>'))
    expect(html).toContain('href="https://usetrmnl.com/css/latest/plugins.css"')
    expect(html).toContain('<body class="environment trmnl">')
    expect(html).toContain('<div class="screen screen--v2 screen--lg screen--density-2x screen--4bit" style="--screen-w: 1040px; --screen-h: 780px;"><div class="view view--full"><p>x</p></div></div>')
  })

  it('matches the cross-package golden fixture shared with the API copy', () => {
    expect(screenClasses(fixtureTarget)).toEqual(SCREEN_SHELL_FIXTURE_EXPECTED.classes)
    expect(screenStyle(fixtureTarget)).toBe(SCREEN_SHELL_FIXTURE_EXPECTED.style)
    expect(wrapInScreenShell(fixtureTarget, SCREEN_SHELL_FIXTURE_BODY)).toContain(SCREEN_SHELL_FIXTURE_EXPECTED.wrappedDiv)
  })
})
