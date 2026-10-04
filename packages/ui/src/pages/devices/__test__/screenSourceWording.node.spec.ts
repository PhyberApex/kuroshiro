import { describe, expect, it } from 'vitest'
import { buildDeviceDetail } from '@/testing/fixtures/devices'
import { buildScreen } from '@/testing/fixtures/screens'
import { fileFacts, isWebAddress, noSlotLine, pluginRenderedSentence, removalWording } from '../screenSourceWording'

const kitchen = buildDeviceDetail({ id: 'kitchen', name: 'Kitchen' })
const NOW = new Date('2026-10-03T07:35:00.000Z')
const text = (sentence: { text: string }[]) => sentence.map(part => part.text).join('')

describe('a File Screen\'s facts line', () => {
  it('gives the size, the weight and the day it was uploaded, then what it was converted for', () => {
    const file = { originalName: 'harbour.png', width: 1600, height: 960, bytes: 421_888, uploadedAt: '2026-09-12T10:00:00.000Z' }
    expect(fileFacts(file, kitchen)).toBe('1600 × 960 · 412 KB · uploaded 12 September 2026. Converted for TRMNL OG (2-bit), Greyscale, 4 levels.')
  })

  it('leaves out what a Screen uploaded earlier does not have', () => {
    const file = { originalName: null, width: null, height: null, bytes: null, uploadedAt: '2026-09-12T10:00:00.000Z' }
    expect(fileFacts(file, kitchen)).toBe('Uploaded 12 September 2026. Converted for TRMNL OG (2-bit), Greyscale, 4 levels.')
    expect(fileFacts({ ...file, uploadedAt: null }, buildDeviceDetail({ deviceModel: null, palette: null }))).toBe('')
  })
})

describe('the sentence of a Plugin Screen', () => {
  const plugin = { id: 'weather', name: 'Weather', kind: 'Poll' as const, requiredFieldEmpty: false, fetchAlertFiring: false }

  it('links the Plugin and says when it was last rendered', () => {
    const sentence = pluginRenderedSentence(plugin, '2026-10-03T07:31:00.000Z', NOW)
    expect(text(sentence)).toMatch(/^Rendered from the Plugin Weather, last at \d\d:31\.$/)
    expect(sentence.find(part => part.to)).toEqual({ text: 'Weather', to: '/plugins/weather' })
  })

  it('gives the day for a render older than a day, and no time for a Screen never rendered', () => {
    expect(text(pluginRenderedSentence(plugin, '2026-09-28T07:31:00.000Z', NOW))).toMatch(/^Rendered from the Plugin Weather, last on 28 Sept? 2026, \d\d:31\.$/)
    expect(text(pluginRenderedSentence(plugin, null, NOW))).toBe('Rendered from the Plugin Weather.')
  })
})

describe('what a confirmation says is lost and what stays', () => {
  it('names what is lost by the Screen\'s kind', () => {
    const lost = (kind: 'file' | 'mashup' | 'html' | 'external') => removalWording(buildScreen({ kind, name: 'Harbour photo', plugin: null }), kitchen).lost
    expect(lost('file')).toBe('The Screen, its Schedule and the uploaded image.')
    expect(lost('mashup')).toBe('The Screen, its Schedule and the Mashup\'s layout.')
    expect(lost('html')).toBe('The Screen, its Schedule and the HTML written for it.')
    expect(lost('external')).toBe('The Screen, its Schedule and the link.')
  })

  it('says the other Screens move up, and for a Mashup that its Plugins stay', () => {
    expect(removalWording(buildScreen({ kind: 'file', name: 'Harbour photo', plugin: null }), kitchen)).toMatchObject({
      action: 'Delete Screen',
      title: 'Delete Harbour photo?',
      stays: 'Kitchen\'s other Screens, which move up in the Order.',
    })
    expect(removalWording(buildScreen({ kind: 'mashup', name: 'Weekend board', plugin: null }), kitchen).stays).toBe('The Plugins in its slots.')
  })

  it('words a Plugin Screen as unassigning', () => {
    expect(removalWording(buildScreen({ kind: 'plugin', name: 'Weather' }), kitchen)).toEqual({
      action: 'Unassign Plugin',
      title: 'Unassign Weather from Kitchen?',
      lost: 'This Screen on Kitchen and its Schedule.',
      stays: 'The Plugin Weather, with its template, its Data Sources and its place in any Mashup.',
    })
  })
})

describe('the small rules', () => {
  it('takes only an http or https address for an image', () => {
    expect(isWebAddress('https://example.com/a.png')).toBe(true)
    expect(isWebAddress('http://192.168.1.4/cam.jpg')).toBe(true)
    expect(isWebAddress('ftp://example.com/a.png')).toBe(false)
    expect(isWebAddress('example.com/a.png')).toBe(false)
    expect(isWebAddress('')).toBe(false)
  })

  it('names the Plugins that lose their slot', () => {
    expect(noSlotLine(['Trains'])).toBe('Trains no longer has a slot. The Plugin itself stays.')
    expect(noSlotLine(['Trains', 'Notes'])).toBe('Trains and Notes no longer have a slot. The Plugins themselves stay.')
  })
})
