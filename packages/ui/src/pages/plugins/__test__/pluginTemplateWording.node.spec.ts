import { describe, expect, it } from 'vitest'
import { buildDeviceModel, buildPalette } from '@/testing/fixtures/device-models'
import { buildDeviceSummary } from '@/testing/fixtures/devices'
import {
  devicePreviewButton,
  devicePreviewDrawingLine,
  devicePreviewDrawnLine,
  devicePreviewFailedLine,
  devicePreviewSignalLine,
  editorName,
  honestLine,
  removedSentence,
  targetFacts,
} from '../pluginTemplateWording'

const model = buildDeviceModel({ label: 'TRMNL OG (2-bit)', width: 800, height: 480 })
const gray4 = buildPalette({ name: '4 Grays (2-bit)', grays: 4 })
const kitchen = buildDeviceSummary({ name: 'Kitchen' })

describe('the words of the Template section', () => {
  it('names the editor for a screen reader by the Plugin and the size', () => {
    expect(editorName('Weather', 'half_horizontal')).toBe('Template of Weather, Half horizontal')
  })

  it('says what a removed Template leaves its slot with', () => {
    expect(removedSentence('quadrant')).toBe('Removed when you save. A quadrant slot then shows the full template.')
    expect(removedSentence('half_vertical')).toBe('Removed when you save. A half vertical slot then shows the full template.')
  })

  describe('the facts under the plate', () => {
    it('are the Device Model, the size and the Palette for a Device', () => {
      expect(targetFacts({ device: kitchen, model, palette: gray4 })).toBe('TRMNL OG (2-bit) · 800 × 480 · 4 Grays (2-bit)')
    })

    it('are the size alone for a chosen Device Model, whose name the selects show', () => {
      expect(targetFacts({ device: null, model, palette: gray4 })).toBe('800 × 480')
    })
  })

  describe('the honest line', () => {
    it('says what the Device shows the drawing in', () => {
      expect(honestLine({ device: kitchen, model, palette: gray4 }, 'full')).toBe('Your browser draws this. Kitchen shows it in 4 grays.')
    })

    it('speaks of the Device when none is chosen, and counts a colour Palette\'s colours', () => {
      const colour = buildPalette({ grays: 2, colors: ['#000', '#fff', '#f00', '#0f0', '#00f', '#ff0'] })

      expect(honestLine({ device: null, model, palette: colour }, 'full')).toBe('Your browser draws this. The Device shows it in 6 colours.')
    })

    it('calls two grays black and white', () => {
      expect(honestLine({ device: kitchen, model, palette: buildPalette({ grays: 2 }) }, 'full')).toBe('Your browser draws this. Kitchen shows it in black and white.')
    })

    it('goes on about the slot for a slot size', () => {
      expect(honestLine({ device: kitchen, model, palette: gray4 }, 'quadrant'))
        .toBe('Your browser draws this. Kitchen shows it in 4 grays, in a quarter of a Mashup; the other slots are left empty here.')
      expect(honestLine({ device: kitchen, model, palette: gray4 }, 'half_horizontal'))
        .toBe('Your browser draws this. Kitchen shows it in 4 grays, in the top or bottom half of a Mashup; the other slots are left empty here.')
    })
  })

  describe('the device preview (ADR-0040)', () => {
    it('names the Device in the button, or "the Device" with none chosen', () => {
      expect(devicePreviewButton(kitchen)).toBe('See it as Kitchen shows it')
      expect(devicePreviewButton(null)).toBe('See it as the Device shows it')
    })

    it('names the Device while drawing', () => {
      expect(devicePreviewDrawingLine(kitchen)).toBe('Drawing it as Kitchen shows it')
      expect(devicePreviewDrawingLine(null)).toBe('Drawing it as the Device shows it')
    })

    it('says what it drew and when, once drawn', () => {
      const drawnAt = new Date('2026-03-05T07:31:00Z')
      expect(devicePreviewDrawnLine({ device: kitchen, model, palette: gray4 }, drawnAt)).toBe(`As Kitchen shows it, in 4 grays, drawn at ${new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(drawnAt)}.`)
    })

    it('names what the content asked for, or nothing for no signal', () => {
      expect(devicePreviewSignalLine('skip')).toBe('This content asks to be skipped.')
      expect(devicePreviewSignalLine('hold')).toBe('This content asks to keep its previous image.')
      expect(devicePreviewSignalLine('none')).toBeNull()
    })

    it('names the Device in a failure other than busy', () => {
      expect(devicePreviewFailedLine(kitchen)).toBe('Could not draw it as Kitchen shows it.')
      expect(devicePreviewFailedLine(null)).toBe('Could not draw it as the Device shows it.')
    })
  })
})
