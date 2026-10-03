import { createApp } from 'vue'
import './styles/index.css'

// eslint-disable-next-line perfectionist/sort-imports -- index.css declares the cascade layer order, so it has to load before any component's styles
import App from './App.vue'

// The DEV guard is replaced with `false` in a production build, which drops the gallery from the bundle.
const galleryRequested = import.meta.env.DEV && window.location.pathname.endsWith('/gallery')

async function rootComponent() {
  return galleryRequested ? (await import('./gallery/GalleryPage.vue')).default : App
}

rootComponent().then(root => createApp(root).mount('#app'))
