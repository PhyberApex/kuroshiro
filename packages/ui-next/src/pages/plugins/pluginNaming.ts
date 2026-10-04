import type { PluginFormPart } from './pluginForm'

/** What is wrong with a Plugin's name as entered, or nothing. */
export const pluginNameProblem = (name: string) => name.trim() ? undefined : 'A Plugin needs a name.'

/** The part of the Plugin's form that "Name and description" edits. */
export const pluginNaming: PluginFormPart<{ name: string, description: string }> = {
  keys: ['name', 'description'],
  read: plugin => ({ name: plugin.name, description: plugin.description ?? '' }),
  toInput: draft => ({ name: draft.name.trim(), description: draft.description.trim() || null }),
  validate: (draft) => {
    const message = pluginNameProblem(draft.name)
    return message ? [{ path: 'name', message }] : []
  },
}
