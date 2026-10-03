import { describe, expect, it } from 'vitest'
import { bySectionOrder, sectionNameFromPath } from '../sectionNames'

describe('gallery section names', () => {
  it('names a section after its file', () => {
    expect(sectionNameFromPath('./Tokens.gallery.vue')).toEqual({ id: 'tokens', title: 'Tokens' })
  })

  it('splits a multi-word component name into a title and a hyphenated anchor', () => {
    expect(sectionNameFromPath('../primitives/IconButton.gallery.vue')).toEqual({ id: 'icon-button', title: 'Icon Button' })
  })

  it('puts the tokens first and the rest in title order', () => {
    const names = ['Seal', 'Tokens', 'Button', 'IconButton'].map(name => sectionNameFromPath(`../x/${name}.gallery.vue`))

    expect([...names].sort(bySectionOrder).map(name => name.title)).toEqual(['Tokens', 'Button', 'Icon Button', 'Seal'])
  })
})
