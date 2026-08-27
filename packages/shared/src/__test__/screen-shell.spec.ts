import type { ScreenShellTarget } from '../screen-shell'
import { describe, expect, it } from 'vitest'
import { screenClasses, screenStyle, viewFull, wrapInScreenShell } from '../screen-shell'
import { SCREEN_SHELL_FIXTURE_BODY, SCREEN_SHELL_FIXTURE_EXPECTED, SCREEN_SHELL_FIXTURE_MODEL, SCREEN_SHELL_FIXTURE_PALETTE } from './screen-shell.fixture'

const V2: ScreenShellTarget = {
  model: { cssClasses: ['screen--v2', 'screen--lg', 'screen--density-2x'], cssVariables: { '--screen-w': '1040px', '--screen-h': '780px' } },
  palette: { frameworkClass: 'screen--4bit' },
}

const OG_PLUS: ScreenShellTarget = {
  model: { cssClasses: ['screen--og_plus', 'screen--md', 'screen--density-1x'], cssVariables: {} },
  palette: { frameworkClass: 'screen--2bit' },
}

const GRAY_4: ScreenShellTarget['palette'] = { frameworkClass: 'screen--2bit' }
const BW: ScreenShellTarget['palette'] = { frameworkClass: 'screen--1bit' }

const fixtureTarget: ScreenShellTarget = { model: SCREEN_SHELL_FIXTURE_MODEL, palette: SCREEN_SHELL_FIXTURE_PALETTE }

describe('screen shell', () => {
  it('builds the screen class list from model and palette', () => {
    expect(screenClasses(V2)).toEqual([
      'screen',
      'screen--v2',
      'screen--lg',
      'screen--density-2x',
      'screen--4bit',
    ])
    expect(screenClasses({ ...OG_PLUS, palette: BW })).toContain('screen--1bit')
  })

  it('emits no orientation class regardless of model.rotation', () => {
    expect(screenClasses({ ...OG_PLUS, palette: GRAY_4 })).not.toContain('screen--portrait')
    expect(screenClasses({ ...OG_PLUS, palette: GRAY_4 })).not.toContain('screen--landscape')
    expect(screenClasses(V2)).not.toContain('screen--portrait')
    expect(screenClasses(V2)).not.toContain('screen--landscape')
  })

  it('serialises the model CSS variables as an inline style', () => {
    expect(screenStyle(V2)).toBe('--screen-w: 1040px; --screen-h: 780px;')
    expect(screenStyle({ ...V2, model: { ...V2.model, cssVariables: {} } })).toBe('')
  })

  it('wraps a full view', () => {
    expect(viewFull('<p>x</p>')).toBe('<div class="view view--full"><p>x</p></div>')
  })

  it('wraps body markup in a complete document loading the TRMNL framework', () => {
    const html = wrapInScreenShell(V2, '<div class="view view--full">hi</div>')
    expect(html).toContain('<link rel="stylesheet" href="https://usetrmnl.com/css/latest/plugins.css">')
    expect(html).toContain('<script src="https://usetrmnl.com/js/latest/plugins.js"></script>')
    expect(html).toContain('<body class="environment trmnl">')
    expect(html).toContain('<div class="screen screen--v2 screen--lg screen--density-2x screen--4bit" style="--screen-w: 1040px; --screen-h: 780px;"><div class="view view--full">hi</div></div>')
  })

  it('omits the style attribute when the model has no CSS variables', () => {
    const html = wrapInScreenShell({ ...OG_PLUS, palette: GRAY_4 }, 'x')
    expect(html).toContain('<div class="screen screen--og_plus screen--md screen--density-1x screen--2bit">x</div>')
  })

  it('matches the golden fixture consumed by both packages', () => {
    expect(screenClasses(fixtureTarget)).toEqual(SCREEN_SHELL_FIXTURE_EXPECTED.classes)
    expect(screenStyle(fixtureTarget)).toBe(SCREEN_SHELL_FIXTURE_EXPECTED.style)
    expect(wrapInScreenShell(fixtureTarget, SCREEN_SHELL_FIXTURE_BODY)).toContain(SCREEN_SHELL_FIXTURE_EXPECTED.wrappedDiv)
  })
})
