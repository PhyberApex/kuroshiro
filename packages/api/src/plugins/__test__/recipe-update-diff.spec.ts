import type { ComparablePlugin } from '../services/recipe-update-diff.js'
import { describe, expect, it } from 'vitest'
import { computeRecipeContentHash, diffRecipeUpdate } from '../services/recipe-update-diff.js'

function basePlugin(overrides: Partial<ComparablePlugin> = {}): ComparablePlugin {
  return {
    name: 'Daily Weather',
    description: 'Shows the forecast',
    refreshInterval: 15,
    dataSources: [],
    templates: [],
    fields: [],
    ...overrides,
  }
}

describe('diffRecipeUpdate', () => {
  describe('mode', () => {
    it('is three-way when a snapshot is given', () => {
      const result = diffRecipeUpdate(basePlugin(), basePlugin(), basePlugin())
      expect(result.mode).toBe('three-way')
    })

    it('is two-way when there is no snapshot', () => {
      const result = diffRecipeUpdate(null, basePlugin(), basePlugin())
      expect(result.mode).toBe('two-way')
    })
  })

  describe('three-way scalars', () => {
    it('emits an upstream-only change with conflict: false', () => {
      const snapshot = basePlugin({ name: 'Old Name' })
      const local = basePlugin({ name: 'Old Name' })
      const upstream = basePlugin({ name: 'New Name' })

      const { items } = diffRecipeUpdate(snapshot, local, upstream)

      expect(items).toEqual([
        { kind: 'changed', conflict: false, itemType: 'name', key: 'name', local: 'Old Name', upstream: 'New Name', snapshot: 'Old Name' },
      ])
    })

    it('flags a conflict when both upstream and local changed the same item', () => {
      const snapshot = basePlugin({ name: 'Old Name' })
      const local = basePlugin({ name: 'My Name' })
      const upstream = basePlugin({ name: 'New Name' })

      const { items } = diffRecipeUpdate(snapshot, local, upstream)

      expect(items).toHaveLength(1)
      expect(items[0]).toMatchObject({ kind: 'changed', conflict: true, itemType: 'name' })
    })

    it('flags a conflict even when the local and upstream changes happen to match', () => {
      const snapshot = basePlugin({ name: 'Old Name' })
      const local = basePlugin({ name: 'New Name' })
      const upstream = basePlugin({ name: 'New Name' })

      const { items } = diffRecipeUpdate(snapshot, local, upstream)

      expect(items).toHaveLength(1)
      expect(items[0]).toMatchObject({ conflict: true })
    })

    it('emits nothing for a local-only change', () => {
      const snapshot = basePlugin({ name: 'Old Name' })
      const local = basePlugin({ name: 'My Name' })
      const upstream = basePlugin({ name: 'Old Name' })

      const { items } = diffRecipeUpdate(snapshot, local, upstream)

      expect(items).toEqual([])
    })

    it('emits an added description when it only exists upstream', () => {
      const snapshot = basePlugin({ description: undefined })
      const local = basePlugin({ description: undefined })
      const upstream = basePlugin({ description: 'New description' })

      const { items } = diffRecipeUpdate(snapshot, local, upstream)

      expect(items).toContainEqual(
        expect.objectContaining({ kind: 'added', itemType: 'description', upstream: 'New description' }),
      )
    })

    it('emits a removed description when upstream drops it', () => {
      const snapshot = basePlugin({ description: 'Old description' })
      const local = basePlugin({ description: 'Old description' })
      const upstream = basePlugin({ description: undefined })

      const { items } = diffRecipeUpdate(snapshot, local, upstream)

      expect(items).toContainEqual(
        expect.objectContaining({ kind: 'removed', itemType: 'description', snapshot: 'Old description' }),
      )
    })

    it('treats refreshInterval changes the same as any other scalar', () => {
      const snapshot = basePlugin({ refreshInterval: 15 })
      const local = basePlugin({ refreshInterval: 15 })
      const upstream = basePlugin({ refreshInterval: 30 })

      const { items } = diffRecipeUpdate(snapshot, local, upstream)

      expect(items).toContainEqual(
        expect.objectContaining({ kind: 'changed', conflict: false, itemType: 'refreshInterval', upstream: 30 }),
      )
    })
  })

  describe('three-way data sources', () => {
    it('emits an added data source', () => {
      const snapshot = basePlugin({ dataSources: [] })
      const local = basePlugin({ dataSources: [] })
      const upstream = basePlugin({ dataSources: [{ name: 'weather', mode: 'fetch', method: 'GET', url: 'https://api.example.com', headers: {}, body: {} }] })

      const { items } = diffRecipeUpdate(snapshot, local, upstream)

      expect(items).toHaveLength(1)
      expect(items[0]).toMatchObject({ kind: 'added', conflict: false, itemType: 'dataSource', key: 'weather' })
    })

    it('emits a removed data source', () => {
      const snapshot = basePlugin({ dataSources: [{ name: 'weather', mode: 'fetch', method: 'GET', url: 'https://api.example.com' }] })
      const local = basePlugin({ dataSources: [{ name: 'weather', mode: 'fetch', method: 'GET', url: 'https://api.example.com' }] })
      const upstream = basePlugin({ dataSources: [] })

      const { items } = diffRecipeUpdate(snapshot, local, upstream)

      expect(items).toHaveLength(1)
      expect(items[0]).toMatchObject({ kind: 'removed', conflict: false, itemType: 'dataSource', key: 'weather' })
    })

    it('never emits a data source that only exists locally', () => {
      const snapshot = basePlugin({ dataSources: [] })
      const local = basePlugin({ dataSources: [{ name: 'admin-added', mode: 'literal', literalValue: 'x' }] })
      const upstream = basePlugin({ dataSources: [] })

      const { items } = diffRecipeUpdate(snapshot, local, upstream)

      expect(items).toEqual([])
    })

    it('does not flag a literal data source as changed when only fetch-only fields differ', () => {
      const snapshot = basePlugin({ dataSources: [{ name: 'note', mode: 'literal', literalValue: 'hello' }] })
      // Simulates the DB column defaults a literal-mode row carries (method defaults to 'GET', etc.)
      const local = basePlugin({ dataSources: [{ name: 'note', mode: 'literal', method: 'GET', url: null, headers: undefined, body: undefined, transformJs: null, literalValue: 'hello' }] })
      const upstream = basePlugin({ dataSources: [{ name: 'note', mode: 'literal', literalValue: 'hello' }] })

      const { items } = diffRecipeUpdate(snapshot, local, upstream)

      expect(items).toEqual([])
    })

    it('flags a mode flip (polling -> static) as an ordinary changed item', () => {
      const snapshot = basePlugin({ dataSources: [{ name: 'source', mode: 'fetch', method: 'GET', url: 'https://api.example.com' }] })
      const local = basePlugin({ dataSources: [{ name: 'source', mode: 'fetch', method: 'GET', url: 'https://api.example.com' }] })
      const upstream = basePlugin({ dataSources: [{ name: 'source', mode: 'literal', literalValue: { fixed: true } }] })

      const { items } = diffRecipeUpdate(snapshot, local, upstream)

      expect(items).toHaveLength(1)
      expect(items[0]).toMatchObject({ kind: 'changed', itemType: 'dataSource', key: 'source' })
    })
  })

  describe('three-way templates and fields', () => {
    it('diffs templates by layout', () => {
      const snapshot = basePlugin({ templates: [{ layout: 'full', liquidMarkup: 'old' }] })
      const local = basePlugin({ templates: [{ layout: 'full', liquidMarkup: 'old' }] })
      const upstream = basePlugin({ templates: [{ layout: 'full', liquidMarkup: 'new' }] })

      const { items } = diffRecipeUpdate(snapshot, local, upstream)

      expect(items).toEqual([
        expect.objectContaining({ kind: 'changed', conflict: false, itemType: 'template', key: 'full' }),
      ])
    })

    it('diffs fields by keyname and never emits a locally added field', () => {
      const snapshot = basePlugin({ fields: [{ keyname: 'api_key', fieldType: 'string', name: 'API Key', required: true, order: 1 }] })
      const local = basePlugin({
        fields: [
          { keyname: 'api_key', fieldType: 'string', name: 'API Key', required: true, order: 1 },
          { keyname: 'admin_added', fieldType: 'string', name: 'Admin Added', required: false, order: 2 },
        ],
      })
      const upstream = basePlugin({ fields: [{ keyname: 'api_key', fieldType: 'string', name: 'API Key (renamed)', required: true, order: 1 }] })

      const { items } = diffRecipeUpdate(snapshot, local, upstream)

      expect(items).toEqual([
        expect.objectContaining({ kind: 'changed', itemType: 'field', key: 'api_key' }),
      ])
    })
  })

  describe('two-way (no snapshot)', () => {
    it('emits every upstream vs local difference with no conflicts', () => {
      const local = basePlugin({ name: 'Old Name', dataSources: [{ name: 'weather', mode: 'fetch', method: 'GET', url: 'https://old.example.com' }] })
      const upstream = basePlugin({ name: 'New Name', dataSources: [{ name: 'weather', mode: 'fetch', method: 'GET', url: 'https://new.example.com' }] })

      const { mode, items } = diffRecipeUpdate(null, local, upstream)

      expect(mode).toBe('two-way')
      expect(items.every(item => item.conflict === false)).toBe(true)
      expect(items).toContainEqual(expect.objectContaining({ itemType: 'name', kind: 'changed' }))
      expect(items).toContainEqual(expect.objectContaining({ itemType: 'dataSource', key: 'weather', kind: 'changed' }))
    })

    it('offers a field whose select options changed upstream, including one imported before options were kept', () => {
      const withoutOptions = { keyname: 'units', fieldType: 'select', name: 'Units', required: false, order: 1 }
      const snapshot = basePlugin({ fields: [withoutOptions] })
      const local = basePlugin({ fields: [withoutOptions] })
      const upstream = basePlugin({ fields: [{ ...withoutOptions, options: [{ label: 'Metric', value: 'metric' }] }] })

      const { items } = diffRecipeUpdate(snapshot, local, upstream)

      expect(items).toEqual([
        expect.objectContaining({ kind: 'changed', conflict: false, itemType: 'field', key: 'units' }),
      ])
    })

    it('never emits an item for a Data Source/template/field that only exists locally', () => {
      const local = basePlugin({ dataSources: [{ name: 'admin-added', mode: 'literal', literalValue: 'x' }] })
      const upstream = basePlugin({ dataSources: [] })

      const { items } = diffRecipeUpdate(null, local, upstream)

      expect(items).toEqual([])
    })

    it('emits an added item for something upstream has that local does not', () => {
      const local = basePlugin({ fields: [] })
      const upstream = basePlugin({ fields: [{ keyname: 'api_key', fieldType: 'string', name: 'API Key', required: true, order: 1 }] })

      const { items } = diffRecipeUpdate(null, local, upstream)

      expect(items).toEqual([
        expect.objectContaining({ kind: 'added', conflict: false, itemType: 'field', key: 'api_key' }),
      ])
    })
  })
})

describe('computeRecipeContentHash', () => {
  it('is stable regardless of object key order', () => {
    const a = { name: 'x', refreshInterval: 15 }
    const b = { refreshInterval: 15, name: 'x' }

    expect(computeRecipeContentHash(a)).toBe(computeRecipeContentHash(b))
  })

  it('differs when content differs', () => {
    expect(computeRecipeContentHash({ name: 'x' })).not.toBe(computeRecipeContentHash({ name: 'y' }))
  })
})
