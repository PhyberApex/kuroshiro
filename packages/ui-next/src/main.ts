import { createApp } from 'vue'
import './styles/index.css'
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource-variable/jetbrains-mono/wght.css'

// eslint-disable-next-line perfectionist/sort-imports -- index.css declares the cascade layer order, so it has to load before any component's styles
import App from './App.vue'

createApp(App).mount('#app')
