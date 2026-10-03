import { createApp } from 'vue'
import { createWebHistory } from 'vue-router'
import './styles/index.css'

// eslint-disable-next-line perfectionist/sort-imports -- index.css declares the cascade layer order, so it has to load before any component's styles
import App from './App.vue'
import { sharedReads } from './reads/sharedReads'
import { basePathOf, createAppRouter } from './router'

// The DEV guard is replaced with `false` in a production build, which drops the gallery from the bundle.
const galleryRequested = import.meta.env.DEV && window.location.pathname.endsWith('/gallery')

async function mountGallery() {
  createApp((await import('./gallery/GalleryPage.vue')).default).mount('#app')
}

function mountApp() {
  createApp(App)
    .use(createAppRouter(createWebHistory(basePathOf(document.baseURI))))
    .use(sharedReads)
    .mount('#app')
}

if (galleryRequested)
  void mountGallery()
else
  mountApp()
