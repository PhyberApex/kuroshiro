import { describe, expect, it } from 'vitest'
import { buildDeviceModel, buildPalette } from '@/testing/fixtures/device-models'
import { customPalettesByName, inUseAndOthers, labelled, noneCalled, othersTitle, paletteNames, panelSize, seenFrom, swatchColours, syncOutcome } from '../deviceModelsWording'
import { PALETTE_FAMILIES, paletteFamilyName } from '../paletteFamilies'

const KITCHEN = { id: 'kitchen', name: 'Kitchen' }

const OG = buildDeviceModel({ name: 'og_plus', label: 'TRMNL OG', usedBy: [KITCHEN] })
const X = buildDeviceModel({ name: 'v2', label: 'TRMNL X', width: 1872, height: 1404 })
const KOBO = buildDeviceModel({ name: 'kobo_aura', label: 'Kobo Aura', deprecated: true })

describe('palette families', () => {
  it('names the five colour families in words, in the order a select offers them', () => {
    expect(PALETTE_FAMILIES.map(family => [family.id, family.name])).toEqual([
      ['3bwr', 'Black, white and red'],
      ['3bwy', 'Black, white and yellow'],
      ['4bwry', 'Black, white, red and yellow'],
      ['6a', 'Six colours'],
      ['7a', 'Seven colours'],
    ])
  })

  it('finds a Palette\'s family by its framework class', () => {
    expect(paletteFamilyName('screen--color-6a')).toBe('Six colours')
    expect(paletteFamilyName('screen--color-3bwr')).toBe('Black, white and red')
  })

  it('has no words for a family that is no colour family', () => {
    expect(paletteFamilyName('screen--2bit')).toBeUndefined()
  })
})

describe('device models wording', () => {
  describe('a Palette\'s swatches', () => {
    it('are its own colours', () => {
      expect(swatchColours(buildPalette({ colors: ['#111111', '#B53A30', '#F2F0EA'] }))).toEqual(['#111111', '#B53A30', '#F2F0EA'])
    })

    it('are its greys from black to white where it has no colours', () => {
      expect(swatchColours(buildPalette({ colors: null, grays: 2 }))).toEqual(['#000000', '#ffffff'])
      expect(swatchColours(buildPalette({ colors: null, grays: 4 }))).toEqual(['#000000', '#555555', '#aaaaaa', '#ffffff'])
    })

    it('are never more than eight greys', () => {
      const greys = swatchColours(buildPalette({ colors: null, grays: 256 }))

      expect(greys).toHaveLength(8)
      expect([greys[0], greys[7]]).toEqual(['#000000', '#ffffff'])
    })
  })

  describe('the custom Palettes', () => {
    it('are the custom ones alone, by name whatever its case', () => {
      const palettes = [
        buildPalette({ id: 'a', name: 'study panel', kind: 'custom' }),
        buildPalette({ id: 'b', name: '4 Grays (2-bit)' }),
        buildPalette({ id: 'c', name: 'Soft red', kind: 'custom' }),
      ]

      expect(customPalettesByName(palettes).map(palette => palette.name)).toEqual(['Soft red', 'study panel'])
    })
  })

  describe('the Device Models', () => {
    it('are in use where a Device is on them, and the others otherwise', () => {
      expect(inUseAndOthers([KOBO, OG, X])).toEqual({ inUse: [OG], others: [KOBO, X] })
    })

    it('heads the tucked list by how many are left', () => {
      expect(othersTitle({ inUse: [OG], others: [KOBO, X] })).toBe('The other 2 Device Models')
      expect(othersTitle({ inUse: [OG], others: [X] })).toBe('The other Device Model')
    })

    it('heads the tucked list as all of them where none is in use', () => {
      expect(othersTitle({ inUse: [], others: [KOBO, OG, X] })).toBe('All 3 Device Models')
    })

    it('are found by a part of their label, whatever its case', () => {
      expect(labelled([KOBO, OG, X], 'trmnl')).toEqual([OG, X])
      expect(labelled([KOBO, OG, X], ' aura ')).toEqual([KOBO])
      expect(labelled([KOBO, OG, X], '')).toEqual([KOBO, OG, X])
    })

    it('says that none is called what was typed', () => {
      expect(noneCalled(' inkplate ')).toBe('No Device Model is called “inkplate”.')
    })

    it('gives a panel\'s size as width by height', () => {
      expect(panelSize(X)).toBe('1872 × 1404')
    })

    it('names the Palettes a Device Model supports, in the Device Model\'s order', () => {
      const palettes = [
        buildPalette({ id: 'gray-4', name: '4 Grays (2-bit)' }),
        buildPalette({ id: 'bw', name: 'Black & White (1-bit)' }),
        buildPalette({ id: 'gray-16', name: '16 Grays (4-bit)' }),
      ]

      expect(paletteNames(buildDeviceModel({ paletteIds: ['bw', 'gray-4', 'gone'] }), palettes)).toBe('Black & White (1-bit), 4 Grays (2-bit)')
    })
  })

  describe('what a sync came to', () => {
    const result = { models: 38, palettes: 11, deprecatedModels: 0, deprecatedPalettes: 0, ranAt: '2026-10-03T07:35:00.000Z' }

    it('counts the Device Models and Palettes TRMNL lists', () => {
      expect(syncOutcome(result, [OG, X])).toBe('Synced: 38 Device Models and 11 Palettes.')
    })

    it('counts one as one', () => {
      expect(syncOutcome({ ...result, models: 1, palettes: 1 }, [OG])).toBe('Synced: 1 Device Model and 1 Palette.')
    })

    it('adds how many Device Models TRMNL no longer lists', () => {
      expect(syncOutcome(result, [OG, KOBO])).toBe('Synced: 38 Device Models and 11 Palettes. 1 Device Model is no longer listed by TRMNL and stays usable.')
      expect(syncOutcome(result, [KOBO, { ...X, deprecated: true }])).toBe('Synced: 38 Device Models and 11 Palettes. 2 Device Models are no longer listed by TRMNL and stay usable.')
    })
  })

  describe('where what is shown is from, under a sync that failed', () => {
    const now = new Date('2026-10-03T07:35:00.000Z')

    it('is the last sync that reached the Device Models', () => {
      const models = [
        buildDeviceModel({ syncedAt: '2026-09-02T04:00:00.000Z', deprecated: true }),
        buildDeviceModel({ syncedAt: '2026-10-03T04:00:00.000Z' }),
      ]

      expect(seenFrom(models, now)).toBe('What you see is from 3 h ago.')
    })

    it('is the list Kuroshiro was shipped with where no sync ever worked', () => {
      expect(seenFrom([buildDeviceModel({ syncedAt: null })], now)).toBe('What you see is the list Kuroshiro was shipped with.')
    })
  })
})
