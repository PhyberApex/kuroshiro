import type { PluginDetail, PluginFieldInput } from 'kuroshiro-shared'
import type { PluginFormPart } from './pluginForm'
import { CREDIT_TYPE } from './pluginFields'

/**
 * The Field Values as their controls hold them, by keyname. A keyname without an entry is not sent, which keeps what
 * is stored: so a password has an entry only once one is typed, and its stored secret is never here.
 */
export interface FieldValuesDraft {
  values: Record<string, string>
}

const isEntered = (plugin: PluginDetail, keyname: string) => plugin.fieldValues[keyname]?.secret === false

function shownValues(plugin: PluginDetail): Record<string, string> {
  return Object.fromEntries(plugin.fields
    .filter(field => field.type !== CREDIT_TYPE && isEntered(plugin, field.keyname))
    .map(field => [field.keyname, (plugin.fieldValues[field.keyname] as { value: string | null }).value ?? '']))
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

/**
 * The values for the Plugin Fields as the form holds them now: the value of a keyname that is gone goes with it, as
 * the server drops it at the save, and a keyname that is back has its saved value again.
 */
export function valuesAmong(keynames: string[], entered: Record<string, string>, saved: Record<string, string>): Record<string, string> {
  return Object.fromEntries(keynames.flatMap((keyname) => {
    const value = entered[keyname] ?? saved[keyname]
    return value === undefined ? [] : [[keyname, value]]
  }))
}

export type FieldControl = 'text' | 'textarea' | 'number' | 'switch' | 'select' | 'secret'

const CONTROLS: Record<string, FieldControl> = {
  text: 'textarea',
  number: 'number',
  boolean: 'switch',
  select: 'select',
  password: 'secret',
}

/** The control a Plugin Field's value is entered with. A type Kuroshiro has no control for is single-line text. */
export const fieldControl = (type: string | undefined): FieldControl => CONTROLS[type ?? ''] ?? 'text'

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
export function enteredFields(fields: PluginFieldInput[]) {
  return fields.filter((field, index) => field.fieldType !== CREDIT_TYPE
    && field.keyname !== ''
    && fields.findIndex(other => other.keyname === field.keyname) === index)
}
