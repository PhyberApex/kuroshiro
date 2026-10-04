import type { RecipeUpdateFacts } from '../recipe-update.mapper.js'
import { describe, expect, it } from 'vitest'
import { toRecipeUpdatePreview } from '../recipe-update.mapper.js'

function facts(overrides: Partial<RecipeUpdateFacts> = {}): RecipeUpdateFacts {
  return {
    recipe: { id: '41120', name: 'Moon Phase' },
    snapshotTakenAt: new Date('2026-09-12T08:00:00.000Z'),
    contentHash: 'hash',
    mode: 'three-way',
    items: [],
    requiredFieldsLeftEmpty: [],
    ...overrides,
  }
}

describe('toRecipeUpdatePreview', () => {
  it('answers the Recipe, the Recipe Snapshot\'s date and what the check found', () => {
    expect(toRecipeUpdatePreview(facts({ requiredFieldsLeftEmpty: ['city'] }))).toEqual({
      recipe: { id: '41120', name: 'Moon Phase' },
      snapshotTakenAt: '2026-09-12T08:00:00.000Z',
      contentHash: 'hash',
      mode: 'three-way',
      items: [],
      requiredFieldsLeftEmpty: ['city'],
    })
  })

  it('reads a template as its markup and a side that does not exist as null', () => {
    const preview = toRecipeUpdatePreview(facts({
      items: [{ itemType: 'template', key: 'quadrant', kind: 'added', conflict: false, upstream: { layout: 'quadrant', liquidMarkup: '<p>Hi</p>' } }],
    }))

    expect(preview.items).toEqual([{ itemType: 'template', key: 'quadrant', kind: 'added', conflict: false, snapshot: null, local: null, upstream: '<p>Hi</p>' }])
  })

  it('reads a literal Data Source with what its mode uses only, and a Plugin Field in the words of a Plugin read', () => {
    const preview = toRecipeUpdatePreview(facts({
      items: [
        { itemType: 'dataSource', key: 'moon', kind: 'changed', conflict: true, snapshot: { mode: 'literal', literalValue: 1 }, local: { mode: 'literal', literalValue: 2 }, upstream: { mode: 'literal', literalValue: 3 } },
        {
          itemType: 'field',
          key: 'city',
          kind: 'removed',
          conflict: false,
          snapshot: { keyname: 'city', fieldType: 'select', name: 'City', description: 'Where', defaultValue: 'berlin', options: [{ label: 'Berlin', value: 'berlin' }], required: true, order: 1 },
        },
      ],
    }))

    expect(preview.items[0]).toMatchObject({ snapshot: { mode: 'literal', literalValue: 1 }, local: { mode: 'literal', literalValue: 2 }, upstream: { mode: 'literal', literalValue: 3 } })
    expect(preview.items[1]).toMatchObject({
      snapshot: { keyname: 'city', label: 'City', type: 'select', helpText: 'Where', default: 'berlin', options: [{ label: 'Berlin', value: 'berlin' }], required: true, order: 1 },
      local: null,
      upstream: null,
    })
  })
})
