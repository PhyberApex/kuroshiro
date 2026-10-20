import type { PluginFieldAttributes, PluginFieldOption } from 'kuroshiro-shared'
import { isPlainObject } from '../utils/json.js'

/** The value TRMNL stores a bare select option under, as a Recipe's template and default name it (ADR-0060). */
const storedOptionValue = (label: string) => label.toLowerCase().replaceAll(' ', '_')

// A `.trmnlp` manifest writes a select's options either as bare strings or as
// single-entry `{ Label: value }` maps; anything else in the list is skipped.
export function parseFieldOptions(options: unknown): PluginFieldOption[] | undefined {
  if (!Array.isArray(options))
    return undefined

  return options.flatMap((option): PluginFieldOption[] => {
    if (isPlainObject(option))
      return Object.entries(option).map(([label, value]) => ({ label, value: String(value) }))
    if (option === null || option === undefined)
      return []
    const label = String(option)
    return [{ label, value: storedOptionValue(label) }]
  })
}

/** A Plugin Field's attributes as TRMNL's form builder names them, `hint` as `help_text`; none for an empty set (ADR-0053). */
export function formatFieldAttributes({ hint, ...rest }: PluginFieldAttributes = {}): Record<string, string | number | boolean> {
  return { ...rest, ...(hint !== undefined ? { help_text: hint } : {}) }
}

/** An option as a manifest writes it: bare where an import would derive the same value again, else `{ Label: value }`. */
export function formatFieldOptions(options: PluginFieldOption[]): Array<string | Record<string, string>> {
  return options.map(option => storedOptionValue(option.label) === option.value ? option.label : { [option.label]: option.value })
}
