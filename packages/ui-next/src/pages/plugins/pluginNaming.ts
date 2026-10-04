import type { PluginFormPart } from './pluginForm'

/** The part of the Plugin's form that "Name and description" edits. */
export const pluginNaming: PluginFormPart<{ name: string, description: string }> = {
  keys: ['name', 'description'],
  read: plugin => ({ name: plugin.name, description: plugin.description ?? '' }),
  toInput: draft => ({ name: draft.name.trim(), description: draft.description.trim() || null }),
  validate: draft => draft.name.trim() ? [] : [{ path: 'name', message: 'A Plugin needs a name.' }],
}
