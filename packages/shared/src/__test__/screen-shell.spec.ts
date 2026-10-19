import type { ScreenShellTarget } from '../screen-shell.ts'
import { describe, expect, it } from 'vitest'
import { effectiveFrameworkVersion, screenClasses, screenStyle, TRMNL_FRAMEWORK_VERSION, viewFull, wrapInScreenShell } from '../screen-shell.ts'
import { SCREEN_SHELL_FIXTURE_BODY, SCREEN_SHELL_FIXTURE_EXPECTED, SCREEN_SHELL_FIXTURE_MODEL, SCREEN_SHELL_FIXTURE_PALETTE } from './screen-shell.fixture.ts'

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
  it('adds the no-bleed and dark-mode modifiers TRMNL applies from a Plugin\'s settings, and neither by default', () => {
    expect(screenClasses(V2, { noScreenPadding: true, darkMode: true })).toEqual(['screen', 'screen--v2', 'screen--lg', 'screen--density-2x', 'screen--4bit', 'screen--no-bleed', 'screen--dark-mode'])
    expect(screenClasses(V2, { noScreenPadding: true })).toContain('screen--no-bleed')
    expect(screenClasses(V2, { noScreenPadding: true })).not.toContain('screen--dark-mode')
    expect(screenClasses(V2, {})).toEqual(screenClasses(V2))
    expect(wrapInScreenShell(OG_PLUS, '<p>x</p>', '3.4.3', { darkMode: true })).toContain('<div class="screen screen--og_plus screen--md screen--density-1x screen--2bit screen--dark-mode">')
  })

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

  it('wraps body markup in a complete document loading the TRMNL framework at the given version', () => {
    const html = wrapInScreenShell(V2, '<div class="view view--full">hi</div>', TRMNL_FRAMEWORK_VERSION)
    expect(html).toContain(`<link rel="stylesheet" href="https://trmnl.com/css/${TRMNL_FRAMEWORK_VERSION}/plugins.css">`)
    expect(html).toContain(`<script src="https://trmnl.com/js/${TRMNL_FRAMEWORK_VERSION}/plugins.js"></script>`)
    expect(html).toContain('<body class="environment trmnl">')
    expect(html).toContain('<div class="screen screen--v2 screen--lg screen--density-2x screen--4bit" style="--screen-w: 1040px; --screen-h: 780px;"><div class="view view--full">hi</div></div>')
  })

  it('honours whatever version it is given, not a fixed constant', () => {
    const html = wrapInScreenShell(V2, 'x', '3.5.1')
    expect(html).toContain('<link rel="stylesheet" href="https://trmnl.com/css/3.5.1/plugins.css">')
    expect(html).toContain('<script src="https://trmnl.com/js/3.5.1/plugins.js"></script>')
  })

  it('omits the style attribute when the model has no CSS variables', () => {
    const html = wrapInScreenShell({ ...OG_PLUS, palette: GRAY_4 }, 'x', TRMNL_FRAMEWORK_VERSION)
    expect(html).toContain('<div class="screen screen--og_plus screen--md screen--density-1x screen--2bit">x</div>')
  })

  it('matches the golden fixture consumed by both packages', () => {
    expect(screenClasses(fixtureTarget)).toEqual(SCREEN_SHELL_FIXTURE_EXPECTED.classes)
    expect(screenStyle(fixtureTarget)).toBe(SCREEN_SHELL_FIXTURE_EXPECTED.style)
    expect(wrapInScreenShell(fixtureTarget, SCREEN_SHELL_FIXTURE_BODY, TRMNL_FRAMEWORK_VERSION)).toContain(SCREEN_SHELL_FIXTURE_EXPECTED.wrappedDiv)
  })
})

describe('effectiveFrameworkVersion', () => {
  it('is the Plugin\'s own version when it has one', () => {
    expect(effectiveFrameworkVersion('3.3.1')).toBe('3.3.1')
  })

  it('is the Instance pin when the Plugin has none', () => {
    expect(effectiveFrameworkVersion(null)).toBe(TRMNL_FRAMEWORK_VERSION)
    expect(effectiveFrameworkVersion(undefined)).toBe(TRMNL_FRAMEWORK_VERSION)
  })
})
