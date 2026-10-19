import type { PluginFieldAttributes, PluginFieldOption } from 'kuroshiro-shared'
import { isPlainObject } from '../utils/json.js'

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
    return [{ label: String(option), value: String(option) }]
  })
}

/** A Plugin Field's attributes as TRMNL's form builder names them, `hint` as `help_text`; none for an empty set (ADR-0053). */
export function formatFieldAttributes({ hint, ...rest }: PluginFieldAttributes = {}): Record<string, string | number> {
  return { ...rest, ...(hint !== undefined ? { help_text: hint } : {}) }
}

export function formatFieldOptions(options: PluginFieldOption[]): Array<string | Record<string, string>> {
  return options.map(option => option.label === option.value ? option.value : { [option.label]: option.value })
}
