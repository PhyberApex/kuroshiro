import { describe, expect, it } from 'vitest'
import { buildPluginSummary } from '@/testing/fixtures/plugins'
import { expectPageScreenshots } from '@/testing/screenshots'
import { answerPage, fakeGallery, mountGallery, pageOf, RECIPES } from './__test__/recipeGalleryHarness'

describe('the Recipe Gallery', () => {
  it('with a Recipe already held and more to load', async () => {
    fakeGallery({
      recipes: answerPage(pageOf(RECIPES, { total: 412, hasMore: true })),
      plugins: [buildPluginSummary({ id: 'tonight', name: 'Tonight', sourceRecipeId: RECIPES[0]!.id })],
    })
    const screen = await mountGallery()
    await expect.element(screen.getByText('Showing 4 of 412 Recipes, most installed first')).toBeVisible()
    await expect.element(screen.getByText('You already have Tonight from this Recipe.')).toBeVisible()
    // Every picture is the faked one, loaded before the shot: a lazy one is in view on both widths with four cards.
    await expect.poll(() => [...document.images].every(image => image.complete && image.naturalWidth > 0)).toBe(true)

    await expectPageScreenshots('recipe-gallery')
  })
})
