import type { AddPluginWayEntry } from './addPlugin'
import BuildPluginForm from './BuildPluginForm.vue'
import ImportFileForm from './ImportFileForm.vue'
import ImportGithubForm from './ImportGithubForm.vue'
import ImportRecipeForm from './ImportRecipeForm.vue'

/**
 * The ways of adding a Plugin, in the order of the page's radio row. The first is the one
 * chosen when the address names none, or one that is not here.
 */
export const ADD_PLUGIN_WAYS: AddPluginWayEntry[] = [
  { way: 'recipe', label: 'Recipe', hint: 'A ready-made Plugin from trmnl.com/recipes', form: ImportRecipeForm },
  { way: 'file', label: 'File', hint: 'A Plugin exported from Kuroshiro or TRMNL', form: ImportFileForm },
  { way: 'github', label: 'GitHub', hint: 'A Plugin kept in a public repository', form: ImportGithubForm },
  { way: 'poll', label: 'Build a Poll Plugin', hint: 'Kuroshiro fetches the data on a schedule', form: BuildPluginForm, props: { kind: 'Poll' } },
  { way: 'webhook', label: 'Build a Webhook Plugin', hint: 'Another system sends the data', form: BuildPluginForm, props: { kind: 'Webhook' } },
]
