import type { JsonObject } from '../../utils/json.js'
import * as crypto from 'node:crypto'

// A plain, framework-free shape every side of the diff (the stored Recipe
// Snapshot, the Plugin's current local state, and a freshly re-fetched
// Recipe) is mapped into before comparing — see RecipeUpdateService for the
// entity/ParsedPlugin -> ComparablePlugin mapping.

export type ComparableDataSourceMode = 'fetch' | 'literal'

export interface ComparableDataSource {
  name: string
  mode: ComparableDataSourceMode
  method?: string
  url?: string | null
  headers?: Record<string, string>
  body?: JsonObject
  transformJs?: string | null
  literalValue?: Record<string, unknown> | unknown[] | string | number | boolean | null
}

export interface ComparableTemplate {
  layout: string
  liquidMarkup: string
}

export interface ComparableField {
  keyname: string
  fieldType: string
  name: string
  description?: string | null
  defaultValue?: string | null
  required: boolean
  order: number
}

export interface ComparablePlugin {
  name: string
  description?: string | null
  refreshInterval: number
  dataSources: ComparableDataSource[]
  templates: ComparableTemplate[]
  fields: ComparableField[]
}

export type UpdateItemKind = 'added' | 'changed' | 'removed'

export const UPDATE_ITEM_TYPES = ['name', 'description', 'refreshInterval', 'template', 'dataSource', 'field'] as const
export type UpdateItemType = typeof UPDATE_ITEM_TYPES[number]

export type RecipeUpdateMode = 'two-way' | 'three-way'

export interface NormalizedDataSource {
  mode: ComparableDataSourceMode
  method?: string
  url?: string | null
  headers?: Record<string, string>
  body?: JsonObject
  transformJs?: string | null
  literalValue?: ComparableDataSource['literalValue']
}

export interface NormalizedTemplate {
  layout: string
  liquidMarkup: string
}

export interface NormalizedField {
  keyname: string
  fieldType: string
  name: string
  description: string | null
  defaultValue: string | null
  required: boolean
  order: number
}

export interface UpdateItem {
  kind: UpdateItemKind
  conflict: boolean
  itemType: UpdateItemType
  key: string
  local?: unknown
  upstream?: unknown
  snapshot?: unknown
}

export interface RecipeDiffResult {
  mode: RecipeUpdateMode
  items: UpdateItem[]
}

function isAbsent(value: unknown): boolean {
  return value === undefined || value === null
}

// A canonical string form — null and undefined collapse to the same
// representation, and object keys sort regardless of insertion order — so
// two values compare equal exactly when `deepEqual` below should say so.
// Doubles as the Recipe content hash's input (`computeRecipeContentHash`).
function stableStringify(value: unknown): string {
  if (isAbsent(value))
    return 'null'
  if (Array.isArray(value))
    return `[${value.map(stableStringify).join(',')}]`
  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).sort()
    return `{${keys.map(key => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function deepEqual(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b)
}

function normalizeTemplate(template: ComparableTemplate): NormalizedTemplate {
  return { layout: template.layout, liquidMarkup: template.liquidMarkup }
}

function normalizeField(field: ComparableField): NormalizedField {
  return {
    keyname: field.keyname,
    fieldType: field.fieldType,
    name: field.name,
    description: field.description ?? null,
    defaultValue: field.defaultValue ?? null,
    required: !!field.required,
    order: field.order ?? 0,
  }
}

// Only the properties relevant to a Data Source's own mode are compared —
// a `literal` source carries none of the fetch fields (CONTEXT.md "Data
// Source Mode"), so leftover fetch-shaped column defaults on a row that was
// never a fetch source must not register as a difference.
function normalizeDataSource(dataSource: ComparableDataSource): NormalizedDataSource {
  if (dataSource.mode === 'literal') {
    return { mode: 'literal', literalValue: dataSource.literalValue ?? null }
  }
  return {
    mode: 'fetch',
    method: (dataSource.method ?? 'GET').toUpperCase(),
    url: dataSource.url ?? null,
    headers: dataSource.headers ?? {},
    body: dataSource.body ?? {},
    transformJs: dataSource.transformJs ?? null,
  }
}

interface DiffEntry {
  itemType: UpdateItemType
  key: string
  snapshot?: unknown
  local?: unknown
  upstream?: unknown
}

function scalarEntry(itemType: UpdateItemType, snapshot: unknown, local: unknown, upstream: unknown): DiffEntry {
  return { itemType, key: itemType, snapshot, local, upstream }
}

function toNormalizedMap<T>(list: T[] | undefined, getKey: (item: T) => string, normalize: (item: T) => unknown): Map<string, unknown> {
  const map = new Map<string, unknown>()
  for (const item of list ?? []) {
    map.set(getKey(item), normalize(item))
  }
  return map
}

// Three-way compares the Recipe Snapshot against upstream, so a key present
// only locally (an admin-added Data Source/template/field) never enters the
// union and is never emitted. Two-way has no snapshot, so it compares
// upstream against local directly — iterating upstream's keys only has the
// same effect: a local-only key is simply never visited.
function keyedEntries<T>(
  itemType: UpdateItemType,
  mode: RecipeUpdateMode,
  snapshotList: T[] | undefined,
  localList: T[],
  upstreamList: T[],
  getKey: (item: T) => string,
  normalize: (item: T) => unknown,
): DiffEntry[] {
  const snapshotMap = toNormalizedMap(snapshotList, getKey, normalize)
  const localMap = toNormalizedMap(localList, getKey, normalize)
  const upstreamMap = toNormalizedMap(upstreamList, getKey, normalize)

  const keys = mode === 'three-way'
    ? new Set([...snapshotMap.keys(), ...upstreamMap.keys()])
    : new Set(upstreamMap.keys())

  return Array.from(keys, key => ({
    itemType,
    key,
    snapshot: snapshotMap.get(key),
    local: localMap.get(key),
    upstream: upstreamMap.get(key),
  }))
}

function kindOf(base: unknown, upstream: unknown): UpdateItemKind {
  if (isAbsent(base))
    return 'added'
  if (isAbsent(upstream))
    return 'removed'
  return 'changed'
}

// Attaches whichever of local/upstream/snapshot actually have a value — an
// absent one (a key that doesn't exist on that side) is omitted rather than
// reported as `undefined`.
function withPresentValues(item: UpdateItem, entry: DiffEntry, mode: RecipeUpdateMode): UpdateItem {
  if (entry.local !== undefined)
    item.local = entry.local
  if (entry.upstream !== undefined)
    item.upstream = entry.upstream
  if (mode === 'three-way' && entry.snapshot !== undefined)
    item.snapshot = entry.snapshot
  return item
}

// The item is decided against a single "base": the Snapshot in three-way
// mode, or the local state itself in two-way mode (there being no Snapshot
// to compare against) — which is also why two-way never produces a
// `conflict` or a `removed` keyed item (see keyedEntries above).
function decideItem(mode: RecipeUpdateMode, entry: DiffEntry): UpdateItem | null {
  const base = mode === 'three-way' ? entry.snapshot : entry.local

  if (deepEqual(base, entry.upstream))
    return null

  const item: UpdateItem = {
    kind: kindOf(base, entry.upstream),
    conflict: mode === 'three-way' && !deepEqual(entry.local, entry.snapshot),
    itemType: entry.itemType,
    key: entry.key,
  }
  return withPresentValues(item, entry, mode)
}

/** Pure three-way (or, with no Snapshot, two-way) diff between a Recipe Snapshot, a Plugin's local state, and a freshly re-fetched Recipe. See ADR-0030 and the "Update Item" CONTEXT.md entry for the semantics. */
export function diffRecipeUpdate(snapshot: ComparablePlugin | null, local: ComparablePlugin, upstream: ComparablePlugin): RecipeDiffResult {
  const mode: RecipeUpdateMode = snapshot ? 'three-way' : 'two-way'

  const entries: DiffEntry[] = [
    scalarEntry('name', snapshot?.name, local.name, upstream.name),
    scalarEntry('description', snapshot?.description, local.description, upstream.description),
    scalarEntry('refreshInterval', snapshot?.refreshInterval, local.refreshInterval, upstream.refreshInterval),
    ...keyedEntries('template', mode, snapshot?.templates, local.templates, upstream.templates, t => t.layout, normalizeTemplate),
    ...keyedEntries('dataSource', mode, snapshot?.dataSources, local.dataSources, upstream.dataSources, d => d.name, normalizeDataSource),
    ...keyedEntries('field', mode, snapshot?.fields, local.fields, upstream.fields, f => f.keyname, normalizeField),
  ]

  const items = entries
    .map(entry => decideItem(mode, entry))
    .filter((item): item is UpdateItem => item !== null)

  return { mode, items }
}

/** A stable digest of a parsed Recipe's content — independent of object key order, unlike the archive's zip bytes or ETag (ADR-0030). */
export function computeRecipeContentHash(parsed: unknown): string {
  return crypto.createHash('sha256').update(stableStringify(parsed)).digest('hex')
}
