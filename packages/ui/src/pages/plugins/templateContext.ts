import type { PluginDetail, PluginFieldInput, PreviewData, UpdatePluginInput } from 'kuroshiro-shared'

/** What stands in for a password Field Value, as in the data the server hands the preview. */
const HIDDEN_FIELD_VALUE = '••••••••'

const PASSWORD_TYPE = 'password'

type ContextField = Pick<PluginFieldInput, 'keyname' | 'fieldType' | 'defaultValue'>

function savedFields(plugin: PluginDetail): ContextField[] {
  return plugin.fields.map(field => ({ keyname: field.keyname, fieldType: field.type, defaultValue: field.default ?? undefined }))
}

function savedValues(plugin: PluginDetail): Record<string, string | null> {
  return Object.fromEntries(Object.entries(plugin.fieldValues).flatMap(([keyname, stored]) => stored.secret ? [] : [[keyname, stored.value]]))
}

/** What a render reads for each Plugin Field: its Field Value, else its default, else empty; a password as dots. */
function fieldValuesOf(plugin: PluginDetail, fields: ContextField[], entered: Record<string, string | null>): Record<string, string> {
  return Object.fromEntries(fields.map(({ keyname, fieldType, defaultValue }) => {
    const stored = plugin.fieldValues[keyname]
    const untouchedSecret = !(keyname in entered) && stored?.secret === true && stored.set
    const value = untouchedSecret ? HIDDEN_FIELD_VALUE : entered[keyname] ?? defaultValue ?? ''
    return [keyname, value && fieldType === PASSWORD_TYPE ? HIDDEN_FIELD_VALUE : value]
  }))
}

type Unsaved = Pick<UpdatePluginInput, 'name' | 'fields' | 'fieldValues'>

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** `trmnl` with the form's name and Field Values in it; what the server put beside them stays. */
function trmnlWith(trmnl: unknown, instanceName: string, values: Record<string, string>) {
  const settings = isRecord(trmnl) && isRecord(trmnl.plugin_settings) ? trmnl.plugin_settings : {}
  return { ...(isRecord(trmnl) ? trmnl : {}), plugin_settings: { ...settings, instance_name: instanceName, custom_fields_values: values } }
}

/**
 * The data the server fetched for the preview, with the form as it stands now laid over it: the unsaved name and the
 * Field Values, bare and under `trmnl.plugin_settings.custom_fields_values`, as a render after the save would read them.
 * So a changed Field Value is drawn without waiting for the next fetch. What the data holds under a name stays the
 * data's, and a Webhook Payload that is a list is the whole context.
 */
export function heldWithForm(held: PreviewData, plugin: PluginDetail, unsaved: Unsaved): PreviewData {
  if (Array.isArray(held.context))
    return held

  const values = fieldValuesOf(plugin, unsaved.fields ?? savedFields(plugin), unsaved.fieldValues ?? savedValues(plugin))
  const fetchedNames = held.names.filter(({ origin }) => origin !== 'fieldValue')
  const taken = new Set([...fetchedNames.map(({ name }) => name), 'sensors', 'trmnl'])
  const bare = Object.entries(values).filter(([keyname]) => !taken.has(keyname))
  const valueNames = new Set(held.names.filter(({ origin }) => origin === 'fieldValue').map(({ name }) => name))
  const fetched = Object.fromEntries(Object.entries(held.context).filter(([name]) => !valueNames.has(name)))
  const ownsTrmnl = fetchedNames.some(({ name, origin }) => name === 'trmnl' && origin === 'trmnl')

  return {
    ...held,
    context: {
      ...Object.fromEntries(bare),
      ...fetched,
      ...(ownsTrmnl ? { trmnl: trmnlWith(held.context.trmnl, unsaved.name ?? plugin.name, values) } : {}),
    },
    names: [...bare.map(([name]) => ({ name, origin: 'fieldValue' as const, error: null })), ...fetchedNames],
  }
}
