import type { DeviceRenderTarget } from '../device-models.service'
import { describe, expect, it } from 'vitest'
import { SCREEN_SHELL_FIXTURE_BODY, SCREEN_SHELL_FIXTURE_EXPECTED, SCREEN_SHELL_FIXTURE_MODEL, SCREEN_SHELL_FIXTURE_PALETTE } from '../../../../../test/fixtures/screen-shell.fixture'
import { BW, GRAY_4, GRAY_16, OG_PLUS, V2 } from '../../test/mockDeviceModelsService'
import { asService } from '../../test/mockService'
import { screenClasses, screenStyle, viewFull, wrapInScreenShell } from '../screen-shell'

// The shared cross-package fixture is deliberately untyped against either package's
// DeviceModel/Palette entities (see the comment in screen-shell.fixture.ts) — this is the
// one documented boundary cast into this package's DeviceRenderTarget shape.
const fixtureTarget = asService<DeviceRenderTarget>({ model: SCREEN_SHELL_FIXTURE_MODEL, palette: SCREEN_SHELL_FIXTURE_PALETTE })

describe('screen shell', () => {
  it('builds the screen class list from model and palette', () => {
    expect(screenClasses({ model: V2, palette: GRAY_16 })).toEqual([
      'screen',
      'screen--v2',
      'screen--lg',
      'screen--density-2x',
      'screen--4bit',
    ])
    expect(screenClasses({ model: OG_PLUS, palette: BW })).toContain('screen--1bit')
  })

  it('emits no orientation class regardless of model.rotation', () => {
    expect(screenClasses({ model: { ...OG_PLUS, rotation: 90 }, palette: GRAY_4 })).not.toContain('screen--portrait')
    expect(screenClasses({ model: { ...OG_PLUS, rotation: 90 }, palette: GRAY_4 })).not.toContain('screen--landscape')
    expect(screenClasses({ model: V2, palette: GRAY_16 })).not.toContain('screen--portrait')
    expect(screenClasses({ model: V2, palette: GRAY_16 })).not.toContain('screen--landscape')
  })

  it('serialises the model CSS variables as an inline style', () => {
    expect(screenStyle({ model: V2, palette: GRAY_16 })).toBe('--screen-w: 1040px; --screen-h: 780px;')
    expect(screenStyle({ model: { ...V2, cssVariables: {} }, palette: GRAY_16 })).toBe('')
  })

  it('wraps a full view', () => {
    expect(viewFull('<p>x</p>')).toBe('<div class="view view--full"><p>x</p></div>')
  })

  it('wraps body markup in a complete document loading the TRMNL framework', () => {
    const html = wrapInScreenShell({ model: V2, palette: GRAY_16 }, '<div class="view view--full">hi</div>')
    expect(html).toContain('<link rel="stylesheet" href="https://usetrmnl.com/css/latest/plugins.css">')
    expect(html).toContain('<script src="https://usetrmnl.com/js/latest/plugins.js"></script>')
    expect(html).toContain('<body class="environment trmnl">')
    expect(html).toContain('<div class="screen screen--v2 screen--lg screen--density-2x screen--4bit" style="--screen-w: 1040px; --screen-h: 780px;"><div class="view view--full">hi</div></div>')
  })

  it('omits the style attribute when the model has no CSS variables', () => {
    const html = wrapInScreenShell({ model: { ...OG_PLUS, cssVariables: {} }, palette: GRAY_4 }, 'x')
    expect(html).toContain('<div class="screen screen--og_plus screen--md screen--density-1x screen--2bit">x</div>')
  })

  it('matches the cross-package golden fixture shared with the UI copy', () => {
    expect(screenClasses(fixtureTarget)).toEqual(SCREEN_SHELL_FIXTURE_EXPECTED.classes)
    expect(screenStyle(fixtureTarget)).toBe(SCREEN_SHELL_FIXTURE_EXPECTED.style)
    expect(wrapInScreenShell(fixtureTarget, SCREEN_SHELL_FIXTURE_BODY)).toContain(SCREEN_SHELL_FIXTURE_EXPECTED.wrappedDiv)
  })
})
