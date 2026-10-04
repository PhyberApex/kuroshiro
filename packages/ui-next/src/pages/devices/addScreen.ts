import type { PluginSummary } from 'kuroshiro-shared'
import type { RadioChoice } from '@/components/RadioRow.vue'
import { NOT_IN_DEMO } from '@/api/refusalWording'

/** A kind as Add Screen's address names it (`?kind=`). */
export type AddScreenKind = 'plugin' | 'mashup' | 'link' | 'file' | 'html'

export interface AddScreenKindWording {
  kind: AddScreenKind
  label: string
  hint: string
}

/** The kinds as the page's radio row offers them. An upload is refused in demo mode, so the File kind cannot be chosen there. */
export function offeredKinds(kinds: AddScreenKindWording[], demoMode: boolean): RadioChoice<AddScreenKind>[] {
  return kinds.map(({ kind, label, hint }) => {
    const disabled = demoMode && kind === 'file'
    return { value: kind, label, hint: disabled ? NOT_IN_DEMO : hint, disabled }
  })
}

/** The kind the address names when it can be chosen, and the first kind otherwise. */
export function chosenKind(offered: RadioChoice<AddScreenKind>[], named: unknown) {
  return (offered.find(kind => kind.value === named && !kind.disabled) ?? offered[0]!).value
}

/** Every Plugin as a choice for the Device: one that is already on it cannot be assigned again. */
export function pluginChoices(plugins: PluginSummary[], device: { id: string, name: string }): RadioChoice<string>[] {
  return plugins.map((plugin) => {
    const disabled = plugin.devices.some(assigned => assigned.id === device.id)
    const kind = `${plugin.kind} Plugin${plugin.needsValues ? ' · a required Plugin Field is empty' : ''}`
    return { value: plugin.id, label: plugin.name, hint: disabled ? `Already on ${device.name}` : kind, disabled }
  })
}

/** The Plugins whose name holds what is searched for, whatever its case. */
export function pluginsCalled(plugins: PluginSummary[], query: string) {
  const sought = query.trim().toLowerCase()
  return plugins.filter(plugin => plugin.name.toLowerCase().includes(sought))
}

/** The choice that is checked: the one the admin picked while it is offered, and the first that can be chosen otherwise. */
export function preselected(choices: RadioChoice<string>[], picked: string | undefined) {
  const free = choices.filter(choice => !choice.disabled)
  return (free.find(choice => choice.value === picked) ?? free[0])?.value
}

/** A file's name without its ending, as the name a File Screen starts with. */
export function nameFromFile(fileName: string) {
  return fileName.replace(/(?<=.)\.[^.]*$/, '')
}
