import { createApp } from 'vue'
import { createWebHistory } from 'vue-router'

import App from './App.vue'

import { sharedReads } from './reads/sharedReads'
import { basePathOf, createAppRouter } from './router'
import { applyStoredAppearance } from './shell/appearance'
import './styles/index.css'

// The DEV guard is replaced with `false` in a production build, which drops the gallery from the bundle.
const galleryRequested = import.meta.env.DEV && window.location.pathname.endsWith('/gallery')

async function mountGallery() {
  createApp((await import('./gallery/GalleryPage.vue')).default).mount('#app')
}

function mountAdminUi() {
  createApp(App)
    .use(createAppRouter(createWebHistory(basePathOf(document.baseURI))))
    .use(sharedReads)
    .mount('#app')
}

applyStoredAppearance()

if (galleryRequested)
  void mountGallery()
else
  mountAdminUi()
