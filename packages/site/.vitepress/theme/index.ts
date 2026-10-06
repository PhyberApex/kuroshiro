import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import ThemedShot from './ThemedShot.vue'
import '@fontsource-variable/archivo'
import '@fontsource-variable/jetbrains-mono'
import './style.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('ThemedShot', ThemedShot)
  },
} satisfies Theme
