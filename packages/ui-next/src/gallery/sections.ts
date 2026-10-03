import type { Component } from 'vue'
import type { SectionName } from './sectionNames'
import { bySectionOrder, sectionNameFromPath } from './sectionNames'

export interface GallerySection extends SectionName {
  component: Component
}

// A primitive registers its section by putting a `<Name>.gallery.vue` beside its component.
const sectionComponents = import.meta.glob<Component>('../**/*.gallery.vue', { eager: true, import: 'default' })

export const sections: GallerySection[] = Object.entries(sectionComponents)
  .map(([path, component]) => ({ ...sectionNameFromPath(path), component }))
  .sort(bySectionOrder)
