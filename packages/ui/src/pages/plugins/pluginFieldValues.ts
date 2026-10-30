import type { PluginDetail, PluginFieldAttributes, PluginFieldInput } from 'kuroshiro-shared'
import type { PluginFormPart } from './pluginForm'
import { isListField, isReadOnlyFieldType } from 'kuroshiro-shared'
import { CREDIT_TYPE } from './pluginFields'

/**
 * The Field Values as their controls hold them, by keyname. A keyname without an entry is not sent, which keeps what
 * is stored: so a password has an entry only once one is typed, and its stored secret is never here.
 */
export interface FieldValuesDraft {
  values: Record<string, string>
}

/** The value of every Plugin Field that gets a row, as `fieldsWithRow` picks them, so none of a read-only type. */
function shownValues(plugin: PluginDetail): Record<string, string> {
  return Object.fromEntries(plugin.fields.flatMap((field, index) => {
    const stored = plugin.fieldValues[field.keyname]
    const hasRow = !isReadOnlyFieldType(field.type) && field.keyname !== '' && plugin.fields.findIndex(other => other.keyname === field.keyname) === index
    return !hasRow || stored?.secret !== false ? [] : [[field.keyname, stored.value ?? '']]
  }))
}

/** By keyname in a fixed order, so that two drafts holding the same values send the same. */
function sentValues(values: Record<string, string>): Record<string, string | null> {
  return Object.fromEntries(Object.keys(values).sort().map(keyname => [keyname, values[keyname] || null]))
}

/** The part of the Plugin's form that the section "Field Values" edits. */
export const pluginFieldValues: PluginFormPart<FieldValuesDraft> = {
  keys: ['fieldValues'],
  read: plugin => ({ values: shownValues(plugin) }),
  toInput: draft => ({ fieldValues: sentValues(draft.values) }),
}

/** Whether the server holds a password under the keyname. Its value never reaches the browser. */
export function isSecretStored(plugin: PluginDetail, keyname: string) {
  const stored = plugin.fieldValues[keyname]
  return stored?.secret === true && stored.set
}

/**
 * The values for the Plugin Fields as the form holds them now. The value of a keyname that is gone goes with it, as
 * the server drops it at the save, and a keyname that is back has its saved value again. An empty value is held only
 * where a save has something to clear: a saved value, or a stored password named in `cleared` because its Plugin Field
 * is no password any more and would be read back. Anywhere else nothing is sent, which keeps a stored password.
 */
export function valuesAmong(keynames: string[], entered: Record<string, string>, saved: Record<string, string>, cleared: string[] = []): Record<string, string> {
  return Object.fromEntries(keynames.flatMap((keyname) => {
    const value = entered[keyname] ?? saved[keyname] ?? ''
    const clears = keyname in saved || cleared.includes(keyname)
    return value === '' && !clears ? [] : [[keyname, value]]
  }))
}

export type FieldControl = 'text' | 'url' | 'date' | 'time' | 'textarea' | 'number' | 'switch' | 'select' | 'secret' | 'lines' | 'checklist'

const CONTROLS: Record<string, FieldControl> = {
  url: 'url',
  date: 'date',
  time: 'time',
  text: 'textarea',
  code: 'textarea',
  number: 'number',
  boolean: 'switch',
  select: 'select',
  password: 'secret',
}

/**
 * The control a Plugin Field's value is entered with: a list Plugin Field's as one value per line, or as a checklist of
 * its options (ADR-0064). A type Kuroshiro has no control for is single-line text.
 */
export function fieldControl(type: string | undefined, attributes?: PluginFieldAttributes | null): FieldControl {
  if (isListField(type, attributes))
    return type === 'select' ? 'checklist' : 'lines'
  return CONTROLS[type ?? ''] ?? 'text'
}

/**
 * Whether a Field Value holds an explicit value its control can empty with "Clear": a select, a checklist or On or off
 * one, never text, number or password. True even where the value chosen is the Plugin Field's default, since it is
 * still an explicit choice and not "no value".
 */
export function isClearable(type: string | undefined, entered: string, attributes?: PluginFieldAttributes | null) {
  const control = fieldControl(type, attributes)
  return (control === 'select' || control === 'checklist' || control === 'switch') && entered !== ''
}

type NotedField = Pick<PluginFieldInput, 'fieldType' | 'defaultValue' | 'required'>

/** What stands at the right of a Field Value's row. "Empty" marks the row and stops nothing. */
export function fieldValueNote(field: NotedField, { entered, secretStored }: { entered: string, secretStored: boolean }) {
  if (entered === '' && secretStored)
    return 'Set. A secret is never shown again.'
  if (field.defaultValue && (entered === '' || entered === field.defaultValue))
    return 'The default'
  return field.required && entered === '' ? 'Empty' : undefined
}

export const ON = 'true'
export const OFF = 'false'

/** Whether an "On or off" Plugin Field is on: by its value, and by its default while it has none. */
export const isOn = (entered: string, defaultValue: string | undefined) => (entered || defaultValue) === ON

/** The text of the Plugin's `author_bio` Plugin Field, which is a credit to read and never an input. */
export function creditOf(fields: PluginFieldInput[]) {
  const credit = fields.find(field => field.fieldType === CREDIT_TYPE)
  return credit?.description || credit?.defaultValue || undefined
}

/** The Plugin Fields that get a row: every one that is an input, once per keyname, in their order. */
/** A group of rows under its name, or under none for the Plugin Fields of no group. */
export interface FieldGroup<T> {
  name: string | null
  fields: T[]
}

/** The rows in their groups: those of no group first, then each group in the order it first appears, each keeping the rows' order. */
export function groupsOf<T extends Pick<PluginFieldInput, 'attributes'>>(fields: T[]): FieldGroup<T>[] {
  const groups = new Map<string | null, T[]>([[null, []]])
  fields.forEach((field) => {
    const name = field.attributes?.group?.trim() || null
    groups.set(name, [...groups.get(name) ?? [], field])
  })
  return [...groups].filter(([name, grouped]) => name === null ? true : grouped.length > 0).map(([name, grouped]) => ({ name, fields: grouped }))
}

export function fieldsWithRow(fields: PluginFieldInput[]) {
  return fields.filter((field, index) => !isReadOnlyFieldType(field.fieldType)
    && field.keyname !== ''
    && fields.findIndex(other => other.keyname === field.keyname) === index)
}
