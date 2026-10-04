import type { AddPluginWayEntry } from './addPlugin'
import BuildPluginForm from './BuildPluginForm.vue'

/**
 * The ways of adding a Plugin, in the order of the page's radio row. The first is the one
 * chosen when the address names none, or one that is not here.
 */
export const ADD_PLUGIN_WAYS: AddPluginWayEntry[] = [
  // Recipe, File and GitHub go here, in front of the two ways of building.
  { way: 'poll', label: 'Build a Poll Plugin', hint: 'Kuroshiro fetches the data on a schedule', form: BuildPluginForm, props: { kind: 'Poll' } },
  { way: 'webhook', label: 'Build a Webhook Plugin', hint: 'Another system sends the data', form: BuildPluginForm, props: { kind: 'Webhook' } },
]
