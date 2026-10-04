export interface SectionName {
  id: string
  title: string
}

/** `../primitives/IconButton.gallery.vue` is the section "Icon Button" with the anchor `icon-button`. */
export function sectionNameFromPath(path: string): SectionName {
  const words = path
    .slice(path.lastIndexOf('/') + 1)
    .replace(/\.gallery\.vue$/, '')
    .split(/(?<=[a-z0-9])(?=[A-Z])/)
  return {
    id: words.join('-').toLowerCase(),
    title: words.join(' '),
  }
}

const FIRST_SECTION_ID = 'tokens'

/** The tokens lead, because every other section is built from them; the rest follow by title. */
export function bySectionOrder(a: SectionName, b: SectionName) {
  if (a.id === FIRST_SECTION_ID || b.id === FIRST_SECTION_ID)
    return Number(b.id === FIRST_SECTION_ID) - Number(a.id === FIRST_SECTION_ID)
  return a.title.localeCompare(b.title)
}
