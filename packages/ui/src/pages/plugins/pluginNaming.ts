import type { PluginFormPart } from './pluginForm'
import { FRAMEWORK_VERSION_PATTERN } from 'kuroshiro-shared'

/** What is wrong with a Plugin's name as entered, or nothing. */
export const pluginNameProblem = (name: string) => name.trim() ? undefined : 'A Plugin needs a name.'

/** What is wrong with a Framework Version as entered, or nothing. Empty follows the Instance's version. */
function frameworkVersionProblem(version: string) {
  const trimmed = version.trim()
  return !trimmed || FRAMEWORK_VERSION_PATTERN.test(trimmed) ? undefined : 'Use a version such as 3.3.1.'
}

/** The version the browser preview draws the Plugin's own Screens with: the entered one once it is valid, else none (the Instance's). */
export const enteredFrameworkVersion = (version: string) => frameworkVersionProblem(version) ? null : version.trim() || null

/** The part of the Plugin's form that "Name and description" edits, with the Framework Version under the description. */
export const pluginNaming: PluginFormPart<{ name: string, description: string, frameworkVersion: string }> = {
  keys: ['name', 'description', 'frameworkVersion'],
  read: plugin => ({ name: plugin.name, description: plugin.description ?? '', frameworkVersion: plugin.frameworkVersion ?? '' }),
  toInput: draft => ({ name: draft.name.trim(), description: draft.description.trim() || null, frameworkVersion: draft.frameworkVersion.trim() || null }),
  validate: (draft) => {
    const name = pluginNameProblem(draft.name)
    const version = frameworkVersionProblem(draft.frameworkVersion)
    return [
      ...name ? [{ path: 'name', message: name }] : [],
      ...version ? [{ path: 'frameworkVersion', message: version }] : [],
    ]
  },
}
