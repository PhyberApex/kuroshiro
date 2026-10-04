import type { PluginFieldInput, PluginFieldOption, PluginFieldRead } from 'kuroshiro-shared'
import type { FormRow } from './formRows'
import type { FieldProblem, PluginFormPart } from './pluginForm'
import { freeName, keptRows, nextAddedKey, sentPathsOf } from './formRows'

/** One Plugin Field as its row edits it. */
export interface PluginFieldDraft extends FormRow {
  /** `null` for a Plugin Field that was added and not saved yet. */
  id: string | null
  keyname: string
  label: string
  /** As the server holds it: a type Kuroshiro does not know stays as written. */
  type: string
  default: string
  /** The options' labels, one per line. */
  options: string
  /** The options as they are saved, whose values the lines keep. */
  storedOptions: PluginFieldOption[] | null
  helpText: string
  required: boolean
}

export interface PluginFieldsDraft {
  rows: PluginFieldDraft[]
}

export const CREDIT_TYPE = 'author_bio'

/** The types a Plugin Field can be given, in the order they are offered, by the name the server holds each under. */
export const FIELD_TYPE_NAMES = {
  string: 'Single-line text',
  text: 'Multi-line text',
  number: 'Number',
  boolean: 'On or off',
  password: 'Password',
  select: 'Select',
} as const

export type OfferedFieldType = keyof typeof FIELD_TYPE_NAMES

/** The type a Plugin Field is entered as: one Kuroshiro has no control for is single-line text. */
export const offeredType = (type: string): OfferedFieldType => type in FIELD_TYPE_NAMES ? type as OfferedFieldType : 'string'

export const typeName = (type: string) => type === CREDIT_TYPE ? 'Credit, read-only' : FIELD_TYPE_NAMES[offeredType(type)]

function draftOf(field: PluginFieldRead): PluginFieldDraft {
  return {
    key: field.id,
    id: field.id,
    keyname: field.keyname,
    label: field.label,
    type: field.type,
    default: field.default ?? '',
    options: (field.options ?? []).map(option => option.label).join('\n'),
    storedOptions: field.options,
    helpText: field.helpText ?? '',
    required: field.required,
    removed: false,
  }
}

const linesOf = (text: string) => text.split('\n').map(line => line.trim()).filter(Boolean)

/**
 * The options the lines stand for. A line keeps the value of the saved option it still is: the one in its place, or
 * one of its label. While no line was added or taken away, a line with another label is its place's option relabelled.
 */
function enteredOptions(row: PluginFieldDraft): PluginFieldOption[] {
  const stored = row.storedOptions ?? []
  const labels = linesOf(row.options)
  const relabelled = labels.length === stored.length
  return labels.map((label, place) => {
    const inPlace = stored[place]
    const kept = inPlace?.label === label ? inPlace : stored.find(option => option.label === label)
    return kept ?? { label, value: relabelled ? inPlace!.value : label }
  })
}

function inputOf(row: PluginFieldDraft, order: number): PluginFieldInput {
  return {
    keyname: row.keyname.trim(),
    name: row.label.trim(),
    fieldType: row.type,
    ...(row.helpText.trim() ? { description: row.helpText.trim() } : {}),
    ...(row.default && row.type !== 'password' ? { defaultValue: row.default } : {}),
    options: row.type === 'select' ? enteredOptions(row) : row.storedOptions,
    required: row.required,
    order,
  }
}

/** The path a save sends each Plugin Field at: `fields.2`. A removed one is not sent and has none. */
export const fieldPaths = (rows: PluginFieldDraft[]) => sentPathsOf('fields', rows)

const KEYNAME = /^[a-z_]\w*$/i

/** What is wrong with a keyname as entered, among the keynames before it and the names of the Plugin's Data Sources. */
function keynameProblem(entered: string, among: { earlier: string[], dataSources: string[] }) {
  const keyname = entered.trim()
  if (!KEYNAME.test(keyname))
    return 'Use letters, digits and underscores, starting with a letter.'
  if (keyname === 'trmnl')
    return '`trmnl` is taken by Kuroshiro.'
  if (among.earlier.includes(keyname))
    return `Another Plugin Field is called ${keyname}.`
  return among.dataSources.includes(keyname) ? `${keyname} is already the name of a Data Source.` : undefined
}

const optionsProblem = (row: PluginFieldDraft) => row.type === 'select' && linesOf(row.options).length === 0 ? 'A Select needs at least one option.' : undefined

function fieldsProblems(rows: PluginFieldDraft[], dataSources: string[]): FieldProblem[] {
  const kept = keptRows(rows)
  return kept.flatMap((row, index) => {
    const found = {
      keyname: keynameProblem(row.keyname, { earlier: kept.slice(0, index).map(other => other.keyname.trim()), dataSources }),
      options: optionsProblem(row),
    }
    return Object.entries(found)
      .filter((entry): entry is [string, string] => entry[1] !== undefined)
      .map(([field, message]) => ({ path: `fields.${index}.${field}`, message }))
  })
}

/** The part of the Plugin's form that the tucked section "Plugin Fields" edits. */
export const pluginFields: PluginFormPart<PluginFieldsDraft> = {
  keys: ['fields'],
  read: plugin => ({ rows: plugin.fields.map(draftOf) }),
  toInput: draft => ({ fields: keptRows(draft.rows).map(inputOf) }),
  validate: (draft, { plugin, unsaved }) => fieldsProblems(draft.rows, (unsaved.dataSources ?? plugin.dataSources).map(source => source.name.trim())),
}

/** What "Add a Plugin Field" appends: a single-line text called `field`, or the next free `field_n`. */
export function addedPluginField(rows: PluginFieldDraft[]): PluginFieldDraft {
  return {
    key: nextAddedKey(rows),
    id: null,
    keyname: freeName('field', keptRows(rows).map(row => row.keyname.trim())),
    label: '',
    type: 'string',
    default: '',
    options: '',
    storedOptions: null,
    helpText: '',
    required: false,
    removed: false,
  }
}

/** The rows in the order of `keys`, which is how a reordered list names its rows. */
export function inOrderOf(rows: PluginFieldDraft[], keys: string[]) {
  return keys.flatMap(key => rows.find(row => row.key === key) ?? [])
}
