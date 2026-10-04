import type { PaletteDraft } from '../paletteForm'
import { describe, expect, it } from 'vitest'
import { ApiRefusal } from '@/api/client'
import { buildDeviceModel, buildPalette } from '@/testing/fixtures/device-models'
import { buildApiError } from '@/testing/fixtures/errors'
import { deletionWording, draftOf, draftProblems, familyOptions, nextDraftColours, paletteInput, paletteRefusedAt, savingConverts } from '../paletteForm'

const TRMNL_RED = buildPalette({ id: 'color-3bwr', name: 'Color (3 colors)', colors: ['#000000', '#FF0000', '#FFFFFF'], frameworkClass: 'screen--color-3bwr' })
const TRMNL_SIX = buildPalette({ id: 'color-6a', name: 'Color (6 colors)', colors: ['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00'], frameworkClass: 'screen--color-6a' })
const BW = buildPalette({ id: 'bw', name: 'Black & White (1-bit)', grays: 2 })
const SOFT_RED = buildPalette({ id: 'soft-red', name: 'Soft red', kind: 'custom', colors: ['#111111', '#B53A30', '#F2F0EA'], frameworkClass: 'screen--color-3bwr' })
const PALETTES = [BW, TRMNL_RED, TRMNL_SIX, SOFT_RED]

const study = { id: 'study', name: 'Study' }
const kitchen = { id: 'kitchen', name: 'Kitchen' }
const hallway = { id: 'hallway', name: 'Hallway' }

function draft(changes: Partial<PaletteDraft> = {}): PaletteDraft {
  return { name: 'Soft red', frameworkClass: 'screen--color-3bwr', colours: ['#111111', '#B53A30', '#F2F0EA'], ...changes }
}

describe('the custom Palette form', () => {
  it('starts a new Palette in black, white and red, with the colours of TRMNL\'s Palette of that family', () => {
    expect(draftOf(undefined, PALETTES)).toEqual({ name: '', frameworkClass: 'screen--color-3bwr', colours: ['#000000', '#FF0000', '#FFFFFF'] })
  })

  it('starts an existing Palette from what it is', () => {
    expect(draftOf(SOFT_RED, PALETTES)).toEqual(draft())
  })

  it('takes the colours of TRMNL\'s Palette of a new family while the colours are still those of the last one', () => {
    expect(nextDraftColours(draft({ colours: ['#000000', '#FF0000', '#FFFFFF'] }), 'screen--color-6a', PALETTES)).toEqual(TRMNL_SIX.colors)
  })

  it('keeps colours the admin changed, and those of a family TRMNL has no Palette of', () => {
    expect(nextDraftColours(draft(), 'screen--color-6a', PALETTES)).toEqual(draft().colours)
    expect(nextDraftColours(draft({ colours: ['#000000', '#FF0000', '#FFFFFF'] }), 'screen--color-7a', PALETTES)).toEqual(['#000000', '#FF0000', '#FFFFFF'])
  })

  it('offers the five Palette Families as "{name in words} · {id}"', () => {
    expect(familyOptions().map(option => option.label)).toEqual([
      'Black, white and red · 3bwr',
      'Black, white and yellow · 3bwy',
      'Black, white, red and yellow · 4bwry',
      'Six colours · 6a',
      'Seven colours · 7a',
    ])
    expect(familyOptions()[0]!.value).toBe('screen--color-3bwr')
  })

  it('finds nothing wrong with a name and colours like #RRGGBB, in any letter case and with spaces around them', () => {
    expect(draftProblems(draft({ colours: ['#b53a30', ' #F2F0EA '] }))).toEqual({ invalidColours: [] })
  })

  it('needs a name, and says which colours are not #RRGGBB', () => {
    expect(draftProblems(draft({ name: '  ', colours: ['#111111', '#B53A3', '', 'red'] }))).toEqual({
      name: 'A Palette needs a name.',
      colours: 'Enter a colour like #B53A30.',
      invalidColours: [1, 2, 3],
    })
  })

  it('needs at least one colour, and no more than that', () => {
    expect(draftProblems(draft({ colours: [] }))).toEqual({ colours: 'A Palette needs at least one colour.', invalidColours: [] })
    expect(draftProblems(draft({ colours: ['#000000'] }))).toEqual({ invalidColours: [] })
    expect(draftProblems(draft({ colours: Array.from<string>({ length: 16 }).fill('#000000') }))).toEqual({ invalidColours: [] })
  })

  it('sends the name and the colours trimmed, with the Palette Family', () => {
    expect(paletteInput(draft({ name: ' Soft red ', colours: [' #111111', '#b53a30 '] }))).toEqual({ name: 'Soft red', frameworkClass: 'screen--color-3bwr', colors: ['#111111', '#b53a30'] })
  })

  it('words a taken name on the name, with the name, and the server\'s field messages where they belong', () => {
    const taken = new ApiRefusal(buildApiError({ statusCode: 409, code: 'palette-name-taken', message: 'There is already a custom Palette with that name.' }))
    expect(paletteRefusedAt(taken, draft({ name: ' Soft red ' }))).toEqual({ name: 'There is already a custom Palette called Soft red. Give this one a name that tells them apart.', invalidColours: [] })

    const invalid = new ApiRefusal(buildApiError({ statusCode: 400, code: 'validation', fields: [{ path: 'colors', message: 'colors must each be a #RRGGBB hex value' }] }))
    expect(paletteRefusedAt(invalid, draft())).toEqual({ colours: 'colors must each be a #RRGGBB hex value', invalidColours: [] })

    expect(paletteRefusedAt(new Error('Kuroshiro\'s server is not answering.'), draft())).toEqual({ invalidColours: [] })
  })

  it('says whose stored images a save converts again', () => {
    expect(savingConverts([])).toBeUndefined()
    expect(savingConverts([study])).toBe('Saving converts Study\'s stored images again.')
    expect(savingConverts([kitchen, study])).toBe('Saving converts Kitchen and Study\'s stored images again.')
  })
})

describe('deleting a custom Palette', () => {
  const seeed = buildDeviceModel({ name: 'seeed_e1002', paletteIds: ['bw', 'color-6a', 'study-panel'], defaultPaletteId: 'color-6a', usedBy: [study] })
  const og = buildDeviceModel({ name: 'og_bwr', paletteIds: ['bw', 'color-3bwr', 'soft-red'], defaultPaletteId: 'color-3bwr', usedBy: [kitchen, hallway] })
  const models = [seeed, og]

  it('says what is lost and that no Device uses it', () => {
    expect(deletionWording(SOFT_RED, models, PALETTES)).toEqual({
      title: 'Delete the Palette Soft red?',
      lost: 'The custom Palette and its 3 colours.',
      stays: 'Everything else. No Device uses it.',
    })
  })

  it('names the Palette each Device goes back to and says its stored images are converted again', () => {
    expect(deletionWording({ ...SOFT_RED, colors: ['#111111'], usedBy: [kitchen] }, models, PALETTES)).toEqual({
      title: 'Delete the Palette Soft red?',
      lost: 'The custom Palette and its 1 colour.',
      stays: 'Kitchen, which goes back to its Device Model\'s richest Palette, Color (3 colors). Its stored images are converted again.',
    })
  })

  it('groups Devices that go back to the same Palette', () => {
    expect(deletionWording({ ...SOFT_RED, usedBy: [hallway, kitchen, study] }, models, PALETTES).stays).toBe(
      'Hallway and Kitchen, which go back to their Device Model\'s richest Palette, Color (3 colors). Study, which goes back to its Device Model\'s richest Palette, Color (6 colors). Their stored images are converted again.',
    )
  })

  it('leaves the Palette unnamed for a Device whose Device Model it does not know', () => {
    expect(deletionWording({ ...SOFT_RED, usedBy: [{ id: 'attic', name: 'Attic' }] }, models, PALETTES).stays).toBe(
      'Attic, which goes back to its Device Model\'s richest Palette. Its stored images are converted again.',
    )
  })
})
