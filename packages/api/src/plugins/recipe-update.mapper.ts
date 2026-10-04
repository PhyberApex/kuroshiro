import type { RecipeDataSource, RecipeField, RecipeUpdatePreview, UpdateItem as UpdateItemRead, UpdateItemType } from 'kuroshiro-shared'
import type { NormalizedDataSource, NormalizedField, NormalizedTemplate, RecipeUpdateMode, UpdateItem } from './services/recipe-update-diff.js'
import { toIsoStringOrNull } from '../utils/readModel.js'

export interface RecipeUpdateFacts {
  recipe: { id: string, name: string }
  snapshotTakenAt: Date | null
  contentHash: string
  mode: RecipeUpdateMode
  items: UpdateItem[]
  requiredFieldsLeftEmpty: string[]
}

function toDataSource(value: unknown): RecipeDataSource {
  const source = value as NormalizedDataSource
  if (source.mode === 'literal')
    return { mode: 'literal', literalValue: source.literalValue ?? null }
  return {
    mode: 'fetch',
    method: source.method ?? 'GET',
    url: source.url ?? null,
    headers: source.headers ?? {},
    body: source.body ?? {},
    transformJs: source.transformJs ?? null,
  }
}

function toField(value: unknown): RecipeField {
  const field = value as NormalizedField
  return {
    keyname: field.keyname,
    label: field.name,
    type: field.fieldType,
    helpText: field.description,
    default: field.defaultValue,
    required: field.required,
    order: field.order,
    options: field.options,
  }
}

const SIDE_READS: Record<UpdateItemType, (value: unknown) => unknown> = {
  name: value => value,
  description: value => value,
  refreshInterval: value => value,
  template: value => (value as NormalizedTemplate).liquidMarkup,
  dataSource: toDataSource,
  field: toField,
}

function toUpdateItemRead(item: UpdateItem): UpdateItemRead {
  const side = (value: unknown) => value === undefined || value === null ? null : SIDE_READS[item.itemType](value)
  return {
    itemType: item.itemType,
    key: item.key,
    kind: item.kind,
    conflict: item.conflict,
    snapshot: side(item.snapshot),
    local: side(item.local),
    upstream: side(item.upstream),
  } as UpdateItemRead
}

export function toRecipeUpdatePreview(facts: RecipeUpdateFacts): RecipeUpdatePreview {
  return {
    recipe: facts.recipe,
    snapshotTakenAt: toIsoStringOrNull(facts.snapshotTakenAt),
    contentHash: facts.contentHash,
    mode: facts.mode,
    items: facts.items.map(toUpdateItemRead),
    requiredFieldsLeftEmpty: facts.requiredFieldsLeftEmpty,
  }
}
