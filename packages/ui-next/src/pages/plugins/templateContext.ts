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
    const value = untouchedSecret ? HIDDEN_FIELD_VALUE : entered[keyname] || defaultValue || ''
    return [keyname, value && fieldType === PASSWORD_TYPE ? HIDDEN_FIELD_VALUE : value]
  }))
}

/**
 * The preview's context from the form alone: the unsaved name and the Field Values, bare and under
 * `trmnl.plugin_settings.custom_fields_values`. It holds no Data Source, no Webhook Payload and no Sensors.
 */
export function formContext(plugin: PluginDetail, unsaved: Pick<UpdatePluginInput, 'name' | 'fields' | 'fieldValues'>): PreviewData['context'] {
  const values = fieldValuesOf(plugin, unsaved.fields ?? savedFields(plugin), unsaved.fieldValues ?? savedValues(plugin))
  return {
    ...values,
    trmnl: { plugin_settings: { instance_name: unsaved.name ?? plugin.name, custom_fields_values: values } },
  }
}
