import type { Component } from 'vue'
import type { AddScreenKindWording } from './addScreen'
import AddExternalScreen from './AddExternalScreen.vue'
import AddFileScreen from './AddFileScreen.vue'
import AddHtmlScreen from './AddHtmlScreen.vue'
import AddMashupScreen from './AddMashupScreen.vue'
import AddPluginScreen from './AddPluginScreen.vue'

/** A kind of Add Screen: a row of the page's radio row and the form shown while it is chosen, which is handed the `device`. */
interface AddScreenKindEntry extends AddScreenKindWording {
  form: Component
}

/** The kinds in the order of the page's radio row. The first is the one chosen when the address names none. */
export const ADD_SCREEN_KINDS: AddScreenKindEntry[] = [
  { kind: 'plugin', label: 'Plugin', hint: 'One of your Plugins, rendered for this Device', form: AddPluginScreen },
  { kind: 'mashup', label: 'Mashup', hint: 'Several Plugins sharing one Screen in a layout', form: AddMashupScreen },
  { kind: 'link', label: 'External link', hint: 'An image fetched from a URL', form: AddExternalScreen },
  { kind: 'file', label: 'File', hint: 'An image you upload', form: AddFileScreen },
  { kind: 'html', label: 'HTML', hint: 'Markup you write here, with a live preview', form: AddHtmlScreen },
]
