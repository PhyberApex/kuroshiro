import type { FieldValueRead } from 'kuroshiro-shared'
import type { PluginField } from './entities/plugin-field.entity.js'

type FieldDefinition = Pick<PluginField, 'keyname' | 'fieldType' | 'defaultValue' | 'required'>

export type StoredFieldValues = Record<string, string>

export interface FieldValueView {
  value: string | null
  isSet: boolean
}

export function isSecretField(field: Pick<PluginField, 'fieldType'>): boolean {
  return field.fieldType === 'password'
}

/** What a render sees for each Plugin Field: the Field Value, else the Plugin Field's default, else empty (ADR-0032). */
export function resolveFieldValues(fields: FieldDefinition[], stored: StoredFieldValues): Record<string, string> {
  return Object.fromEntries(fields.map(field => [field.keyname, stored[field.keyname] ?? field.defaultValue ?? '']))
}

/** What stands in for a password Field Value wherever the admin's browser reads a render's context. */
const HIDDEN_FIELD_VALUE = '••••••••'

/** The resolved Field Values with every password that has a value hidden; one without a value stays empty. */
export function hideSecretFieldValues(fields: Array<Pick<PluginField, 'keyname' | 'fieldType'>>, resolved: Record<string, string>): Record<string, string> {
  const secretKeynames = new Set(fields.filter(isSecretField).map(field => field.keyname))
  return Object.fromEntries(Object.entries(resolved).map(([keyname, value]) => [keyname, value && secretKeynames.has(keyname) ? HIDDEN_FIELD_VALUE : value]))
}

/** `author_bio` is a read-only credit, never an input, so it can't be what a Plugin is waiting on. */
export function needsValues(fields: FieldDefinition[], stored: StoredFieldValues): boolean {
  return fields.some(field =>
    field.required
    && field.fieldType !== 'author_bio'
    && stored[field.keyname] === undefined
    && !field.defaultValue,
  )
}

/** The admin-facing read of a Plugin's Field Values: a secret one reports only whether it is set. */
export function fieldValueViews(fields: FieldDefinition[], stored: StoredFieldValues): Record<string, FieldValueView> {
  return Object.fromEntries(fields.map((field) => {
    const value = stored[field.keyname]
    const isSet = value !== undefined
    return [field.keyname, { value: isSet && !isSecretField(field) ? value : null, isSet }]
  }))
}

/** The read-model form of a Plugin's Field Values, by keyname: a secret one reports only whether it is set. */
export function toFieldValueReads(fields: FieldDefinition[], stored: StoredFieldValues): Record<string, FieldValueRead> {
  return Object.fromEntries(fields.map((field): [string, FieldValueRead] => {
    const value = stored[field.keyname]
    return [field.keyname, isSecretField(field) ? { secret: true, set: value !== undefined } : { secret: false, value: value ?? null }]
  }))
}
