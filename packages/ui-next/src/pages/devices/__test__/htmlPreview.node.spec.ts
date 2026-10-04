import { describe, expect, it } from 'vitest'
import { buildDeviceModel, buildPalette } from '@/testing/fixtures/device-models'
import { buildDeviceDetail } from '@/testing/fixtures/devices'
import { htmlScreenDocument, shellTargetOf } from '../htmlPreview'

const OG = buildDeviceModel({ name: 'og_plus', cssClasses: ['screen--og_plus'], cssVariables: { '--screen-w': '800px' } })
const X = buildDeviceModel({ name: 'x', cssClasses: ['screen--x'] })
const GREYS = buildPalette({ id: 'greys', frameworkClass: 'screen--2bit' })
const BLACK_AND_WHITE = buildPalette({ id: 'bw', frameworkClass: 'screen--1bit' })

describe('what an HTML Screen is previewed for', () => {
  it('is the Device\'s own Device Model and Palette', () => {
    const device = buildDeviceDetail({ deviceModel: { name: 'x', label: 'TRMNL X', width: 1872, height: 1404, deprecated: false }, palette: { id: 'bw', name: 'Black and white', kind: 'official' } })

    expect(shellTargetOf(device, [OG, X], [GREYS, BLACK_AND_WHITE])).toEqual({ model: X, palette: BLACK_AND_WHITE })
  })

  it('is nothing for a Device without a Device Model or a Palette, or with one the Instance does not hold', () => {
    expect(shellTargetOf(buildDeviceDetail({ deviceModel: null }), [OG], [buildPalette()])).toBeUndefined()
    expect(shellTargetOf(buildDeviceDetail({ palette: null }), [buildDeviceModel()], [GREYS])).toBeUndefined()
    expect(shellTargetOf(buildDeviceDetail(), [X], [buildPalette()])).toBeUndefined()
  })
})

describe('the document an HTML Screen is previewed from', () => {
  it('holds the markup as a full view in the screen shell the server renders with', () => {
    const document = htmlScreenDocument({ model: OG, palette: GREYS }, '<h1>Milk</h1>')

    expect(document).toContain('<link rel="stylesheet" href="https://usetrmnl.com/css/latest/plugins.css">')
    expect(document).toContain('<body class="environment trmnl">')
    expect(document).toContain('<div class="screen screen--og_plus screen--2bit" style="--screen-w: 800px;"><div class="view view--full"><h1>Milk</h1></div></div>')
  })
})
