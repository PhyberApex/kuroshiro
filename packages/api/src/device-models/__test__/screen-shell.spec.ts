import { describe, expect, it } from 'vitest'
import { screenClasses, screenStyle, viewFull, wrapInScreenShell } from '../screen-shell'
import { BW, GRAY_4, GRAY_16, OG_PLUS, V2 } from './mockDeviceModelsService'

describe('screen shell', () => {
  it('builds the screen class list from model, palette and orientation', () => {
    expect(screenClasses({ model: V2, palette: GRAY_16 })).toEqual([
      'screen',
      'screen--v2',
      'screen--lg',
      'screen--density-2x',
      'screen--4bit',
      'screen--landscape',
    ])
    expect(screenClasses({ model: OG_PLUS, palette: BW })).toContain('screen--1bit')
    expect(screenClasses({ model: { ...OG_PLUS, rotation: 90 }, palette: GRAY_4 })).toContain('screen--portrait')
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
    expect(html).toContain('<div class="screen screen--v2 screen--lg screen--density-2x screen--4bit screen--landscape" style="--screen-w: 1040px; --screen-h: 780px;"><div class="view view--full">hi</div></div>')
  })

  it('omits the style attribute when the model has no CSS variables', () => {
    const html = wrapInScreenShell({ model: { ...OG_PLUS, cssVariables: {} }, palette: GRAY_4 }, 'x')
    expect(html).toContain('<div class="screen screen--og_plus screen--md screen--density-1x screen--2bit screen--landscape">x</div>')
  })
})
