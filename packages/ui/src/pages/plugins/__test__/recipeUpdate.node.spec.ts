import type { ApiError, UpdateItem } from 'kuroshiro-shared'
import { describe, expect, it } from 'vitest'
import { ApiRefusal } from '@/api/client'
import { buildApiError } from '@/testing/fixtures/errors'
import { buildUpdateItem } from '@/testing/fixtures/plugins'
import {
  applyButton,
  checkedByDefault,
  checkFailure,
  conflictSentence,
  linesOf,
  recipeChange,
  recipeDay,
  recipeTakenOver,
  updateGroups,
  updateItemName,
} from '../recipeUpdate'

const refusal = (overrides: Partial<ApiError>) => new ApiRefusal(buildApiError(overrides))

function field(overrides: Partial<Extract<UpdateItem, { itemType: 'field' }>> = {}): UpdateItem {
  return buildUpdateItem({
    itemType: 'field',
    key: 'city',
    kind: 'added',
    snapshot: null,
    local: null,
    upstream: { keyname: 'city', label: 'City', type: 'select', helpText: 'Where you live', default: 'berlin', required: true, order: 1, options: [{ label: 'Berlin', value: 'berlin' }, { label: 'Hamburg', value: 'hamburg' }] },
    ...overrides,
  } as UpdateItem)
}

describe('the Recipe Update Check', () => {
  it('names an Update Item by what it is, with the key of a template, a Data Source or a Plugin Field in mono', () => {
    expect(updateItemName(buildUpdateItem({ itemType: 'refreshInterval', key: 'refreshInterval' }))).toEqual({ what: 'Refresh interval', code: null })
    expect(updateItemName(buildUpdateItem({ itemType: 'name', key: 'name' }))).toEqual({ what: 'Name', code: null })
    expect(updateItemName(buildUpdateItem({ itemType: 'template', key: 'full' }))).toEqual({ what: 'Template', code: 'full' })
    expect(updateItemName(buildUpdateItem({ itemType: 'dataSource', key: 'forecast' }))).toEqual({ what: 'Data Source', code: 'forecast' })
    expect(updateItemName(field())).toEqual({ what: 'Plugin Field', code: 'city' })
  })

  it('groups the Update Items under the four headings in order, leaving out an empty one', () => {
    const template = buildUpdateItem({ itemType: 'template', key: 'full' })
    const interval = buildUpdateItem({ itemType: 'refreshInterval', key: 'refreshInterval' })
    const name = buildUpdateItem({ itemType: 'name', key: 'name' })

    expect(updateGroups([template, field(), interval, name])).toEqual([
      { title: 'Plugin details', items: [interval, name] },
      { title: 'Templates', items: [template] },
      { title: 'Plugin Fields', items: [field()] },
    ])
  })

  it('reads the Recipe\'s OAuth settings as one Update Item of the Data Sources, a line per setting (ADR-0068)', () => {
    const oauth = buildUpdateItem({
      itemType: 'oauthSettings',
      key: 'oauthSettings',
      kind: 'changed',
      conflict: false,
      snapshot: { oauth_enabled: 'true', oauth_token_url: 'https://oauth2.example.com/token' },
      local: null,
      upstream: { oauth_enabled: 'true', oauth_token_url: 'https://oauth2.example.com/v2/token' },
    } as UpdateItem)

    expect(updateItemName(oauth)).toEqual({ what: 'OAuth settings', code: null })
    expect(updateGroups([oauth])).toEqual([{ title: 'Data Sources', items: [oauth] }])
    expect(recipeChange(oauth, 'three-way')).toEqual({
      before: ['oauth_enabled: true', 'oauth_token_url: https://oauth2.example.com/token'],
      after: ['oauth_enabled: true', 'oauth_token_url: https://oauth2.example.com/v2/token'],
    })
    expect(conflictSentence('oauthSettings')).toBe('The Recipe and you both changed these OAuth settings since the Recipe Snapshot. Applying replaces your version with the Recipe\'s.')
  })

  it('checks every Update Item but a conflict', () => {
    const conflict = buildUpdateItem({ itemType: 'dataSource', key: 'forecast', conflict: true })
    const template = buildUpdateItem({ itemType: 'template', key: 'full' })

    expect(checkedByDefault([conflict, template])).toEqual({ 'dataSource:forecast': false, 'template:full': true })
  })

  it('words the primary button by the number checked', () => {
    expect(applyButton(0)).toBe('Apply 0 Update Items')
    expect(applyButton(1)).toBe('Apply 1 Update Item')
    expect(applyButton(5)).toBe('Apply 5 Update Items')
  })

  it('reads a value as the lines its diff compares', () => {
    expect(linesOf(buildUpdateItem({ itemType: 'refreshInterval', upstream: 30 }), 'upstream')).toEqual(['every 30 minutes'])
    expect(linesOf(buildUpdateItem({ itemType: 'description', snapshot: null }), 'snapshot')).toEqual([])
    expect(linesOf(buildUpdateItem({ itemType: 'template', upstream: '<div>\n  {{ phase }}\n</div>' }), 'upstream')).toEqual(['<div>', '  {{ phase }}', '</div>'])
    expect(linesOf(buildUpdateItem({
      itemType: 'dataSource',
      upstream: { mode: 'fetch', method: 'GET', url: 'https://api.example.com/moon', headers: { Authorization: 'Bearer {{ token }}' }, body: {}, transformJs: 'return data\n  .phase' },
    }), 'upstream')).toEqual([
      'method: GET',
      'url: https://api.example.com/moon',
      'header Authorization: Bearer {{ token }}',
      'transform:',
      '  return data',
      '    .phase',
    ])
    expect(linesOf(buildUpdateItem({ itemType: 'dataSource', upstream: { mode: 'literal', literalValue: { phase: 'full' }, transformJs: null } }), 'upstream')).toEqual([
      'fixed data:',
      '  {',
      '    "phase": "full"',
      '  }',
    ])
    expect(linesOf(field(), 'upstream')).toEqual([
      'label: City',
      'type: select',
      'options: Berlin, Hamburg',
      'default: berlin',
      'required: yes',
      'help text: Where you live',
      'place: 1',
    ])
  })

  it('reads a name, a description and a Framework Version as the one line each is', () => {
    expect(linesOf(buildUpdateItem({ itemType: 'name', upstream: 'Moon phase' }), 'upstream')).toEqual(['Moon phase'])
    expect(linesOf(buildUpdateItem({ itemType: 'description', upstream: 'Tonight\'s moon' }), 'upstream')).toEqual(['Tonight\'s moon'])
    expect(linesOf(buildUpdateItem({ itemType: 'frameworkVersion', upstream: '1.2.0' }), 'upstream')).toEqual(['1.2.0'])
  })

  it('leaves out of the lines what a Data Source or a Plugin Field does not have', () => {
    expect(linesOf(buildUpdateItem({
      itemType: 'dataSource',
      upstream: { mode: 'fetch', method: 'POST', url: null, headers: {}, body: { city: 'Berlin' }, transformJs: null },
    }), 'upstream')).toEqual([
      'method: POST',
      'url: ',
      'body: {"city":"Berlin"}',
    ])
    expect(linesOf(field({ upstream: { keyname: 'city', label: 'City', type: 'string', helpText: null, default: null, required: false, order: 2, options: null, attributes: {} } }), 'upstream')).toEqual([
      'label: City',
      'type: string',
      'required: no',
      'place: 2',
    ])
  })

  it('tells the Recipe\'s change from the Recipe Snapshot, or from the Plugin without one', () => {
    const item = buildUpdateItem({ itemType: 'refreshInterval', snapshot: 15, local: 20, upstream: 30 })

    expect(recipeChange(item, 'three-way')).toEqual({ before: ['every 15 minutes'], after: ['every 30 minutes'] })
    expect(recipeChange({ ...item, snapshot: null } as UpdateItem, 'two-way')).toEqual({ before: ['every 20 minutes'], after: ['every 30 minutes'] })
  })

  it('says what a conflict means, and that a Data Source keeps the headers added by hand', () => {
    expect(conflictSentence('template')).toBe('The Recipe and you both changed this Template since the Recipe Snapshot. Applying replaces your version with the Recipe\'s.')
    expect(conflictSentence('dataSource')).toBe('The Recipe and you both changed this Data Source since the Recipe Snapshot. Applying replaces your version with the Recipe\'s; headers you added yourself are kept.')
  })

  it('words a check that failed by why', () => {
    expect(checkFailure(refusal({ statusCode: 502, code: 'upstream-unreachable', details: { reason: 'fetch failed' } }), 'Weather')).toBe('trmnl.com did not answer. Nothing was changed.')
    expect(checkFailure(refusal({ statusCode: 422, code: 'recipe-not-found', details: { id: '41120' } }), 'Weather')).toBe('TRMNL no longer has the Recipe 41120. Weather keeps working as it is.')
    expect(checkFailure(refusal({ statusCode: 422, code: 'recipe-webhook-transform' }), 'Weather')).toBe('This Recipe runs a transform on each payload it is sent, which a Webhook Plugin does not do.')
  })

  it('dates the Recipe by its day, and tells a Recipe Snapshot taken over from one taken at the import', () => {
    expect(recipeDay('2026-09-12T08:00:00.000Z')).toBe('12 September 2026')
    expect(recipeTakenOver({ importedAt: '2026-09-12T08:00:00.000Z', snapshotTakenAt: '2026-09-12T08:00:00.120Z' })).toBe(false)
    expect(recipeTakenOver({ importedAt: '2026-09-12T08:00:00.000Z', snapshotTakenAt: '2026-10-01T09:00:00.000Z' })).toBe(true)
    expect(recipeTakenOver({ importedAt: '2026-09-12T08:00:00.000Z', snapshotTakenAt: null })).toBe(false)
  })
})
