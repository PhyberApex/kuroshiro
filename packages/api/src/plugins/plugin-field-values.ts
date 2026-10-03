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
