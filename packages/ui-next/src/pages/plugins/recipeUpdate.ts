import type { PluginDetail, RecipeDataSource, RecipeField, RecipeUpdateMode, UpdateItem, UpdateItemType } from 'kuroshiro-shared'
import { isRefusal } from '@/api/client'
import { failureReason } from '@/components/failureReason'
import { fetchInterval } from './pluginPageWording'

/** The words of the Recipe Update Check and the Plugin page's Recipe section, and what the check's page decides from what the server answered. */

const NAMES: Record<UpdateItemType, string> = {
  name: 'Name',
  description: 'Description',
  refreshInterval: 'Refresh interval',
  template: 'Template',
  dataSource: 'Data Source',
  field: 'Plugin Field',
}

const KEYED: ReadonlySet<UpdateItemType> = new Set(['template', 'dataSource', 'field'])

/** What a row of the check reads: "Refresh interval", or "Template" with `full` in mono. */
export function updateItemName(item: UpdateItem): { what: string, code: string | null } {
  return { what: NAMES[item.itemType], code: KEYED.has(item.itemType) ? item.key : null }
}

const GROUPS: Array<{ title: string, types: UpdateItemType[] }> = [
  { title: 'Plugin details', types: ['name', 'description', 'refreshInterval'] },
  { title: 'Templates', types: ['template'] },
  { title: 'Data Sources', types: ['dataSource'] },
  { title: 'Plugin Fields', types: ['field'] },
]

export function updateGroups(items: UpdateItem[]) {
  return GROUPS
    .map(({ title, types }) => ({ title, items: items.filter(item => types.includes(item.itemType)) }))
    .filter(group => group.items.length > 0)
}

export const updateItemId = (item: Pick<UpdateItem, 'itemType' | 'key'>) => `${item.itemType}:${item.key}`

/** Every Update Item is checked when the check arrives, but a conflict, where keeping your own version is the safe choice. */
export function checkedByDefault(items: UpdateItem[]): Record<string, boolean> {
  return Object.fromEntries(items.map(item => [updateItemId(item), !item.conflict]))
}

export const applyButton = (count: number) => `Apply ${count} Update ${count === 1 ? 'Item' : 'Items'}`

export const placesChanged = (count: number) => count === 1 ? '1 place' : `${count} places`

const indented = (text: string) => text.split('\n').map(line => `  ${line}`)

function dataSourceLines(source: RecipeDataSource): string[] {
  if (source.mode === 'literal')
    return ['fixed data:', ...indented(JSON.stringify(source.literalValue, null, 2))]
  return [
    `method: ${source.method}`,
    `url: ${source.url ?? ''}`,
    ...Object.entries(source.headers).map(([name, value]) => `header ${name}: ${value}`),
    ...(Object.keys(source.body).length > 0 ? [`body: ${JSON.stringify(source.body)}`] : []),
    ...(source.transformJs ? ['transform:', ...indented(source.transformJs)] : []),
  ]
}

function fieldLines(field: RecipeField): string[] {
  return [
    `label: ${field.label}`,
    `type: ${field.type}`,
    ...(field.options ? [`options: ${field.options.map(option => option.label).join(', ')}`] : []),
    ...(field.default ? [`default: ${field.default}`] : []),
    `required: ${field.required ? 'yes' : 'no'}`,
    ...(field.helpText ? [`help text: ${field.helpText}`] : []),
    `place: ${field.order}`,
  ]
}

type Side = 'snapshot' | 'local' | 'upstream'

type ValueOf<T extends UpdateItemType> = NonNullable<Extract<UpdateItem, { itemType: T }>['upstream']>

const LINES: { [T in UpdateItemType]: (value: ValueOf<T>) => string[] } = {
  name: value => [value],
  description: value => [value],
  refreshInterval: value => [fetchInterval(value)],
  template: value => value.split('\n'),
  dataSource: dataSourceLines,
  field: fieldLines,
}

/** One side of an Update Item as the lines its diff compares; none where the item does not exist on that side. */
export function linesOf(item: UpdateItem, side: Side): string[] {
  const value = item[side]
  return value === null ? [] : (LINES[item.itemType] as (value: unknown) => string[])(value)
}

/** The Recipe's change, from the Recipe Snapshot or, without one, from the Plugin as it is. */
export function recipeChange(item: UpdateItem, mode: RecipeUpdateMode) {
  return { before: linesOf(item, mode === 'three-way' ? 'snapshot' : 'local'), after: linesOf(item, 'upstream') }
}

const CONFLICT_SUBJECT: Record<UpdateItemType, string> = {
  name: 'name',
  description: 'description',
  refreshInterval: 'refresh interval',
  template: 'Template',
  dataSource: 'Data Source',
  field: 'Plugin Field',
}

export function conflictSentence(itemType: UpdateItemType) {
  const kept = itemType === 'dataSource' ? '; headers you added yourself are kept.' : '.'
  return `The Recipe and you both changed this ${CONFLICT_SUBJECT[itemType]} since the Recipe Snapshot. Applying replaces your version with the Recipe's${kept}`
}

/** Why the check could not download the Recipe, after "Could not download the Recipe." */
export function checkFailure(error: unknown, pluginName: string): string | undefined {
  if (isRefusal(error, 'upstream-unreachable'))
    return 'trmnl.com did not answer. Nothing was changed.'
  if (isRefusal(error, 'recipe-not-found'))
    return `TRMNL no longer has the Recipe ${String(error.details.id)}. ${pluginName} keeps working as it is.`
  return failureReason(error)
}

const DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

/** "12 September 2026", in the browser's timezone. */
export const recipeDay = (at: string) => DAY.format(new Date(at))

// An import takes its Recipe Snapshot a moment before the Plugin is stored, so the two instants differ by milliseconds.
const SAME_MOMENT_MS = 60_000

/** Whether an applied or skipped check took the Recipe Snapshot, rather than the import or the Plugin a duplicate was made of. */
export function recipeTakenOver({ importedAt, snapshotTakenAt }: Pick<NonNullable<PluginDetail['recipe']>, 'importedAt' | 'snapshotTakenAt'>) {
  return snapshotTakenAt !== null && Date.parse(snapshotTakenAt) - Date.parse(importedAt) > SAME_MOMENT_MS
}

export const recipePage = (recipeId: string) => `https://trmnl.com/recipes/${recipeId}`
