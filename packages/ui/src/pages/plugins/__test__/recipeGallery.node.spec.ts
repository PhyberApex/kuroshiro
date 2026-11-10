import { describe, expect, it } from 'vitest'
import { ApiRefusal, ServerUnreachable } from '@/api/client'
import { linkTo, sentence } from '@/pages/devices/sentence'
import { buildPluginSummary } from '@/testing/fixtures/plugins'
import { heldFromRecipe } from '../importPlugin'
import { categoryLabel, countLine, endLine, failedNotice, galleryQueryOf, heldByRecipe, installsLine, noMatchSentence, searchable, sortOf } from '../recipeGallery'

const refusal = (code: ApiRefusal['code']) => new ApiRefusal({ statusCode: 502, code, message: 'The server\'s own sentence.' })

describe('what the address holds', () => {
  it('reads an order it knows, and installs for anything else', () => {
    expect(sortOf('newest')).toBe('newest')
    expect(sortOf('fork')).toBe('install')
    expect(sortOf(undefined)).toBe('install')
  })

  it('searches from three characters on, trimmed', () => {
    expect(searchable(' we ')).toBe('')
    expect(searchable(' wea ')).toBe('wea')
  })

  it('asks the API for what is chosen, leaving out what is not', () => {
    expect(galleryQueryOf({ search: '', category: undefined, sort: 'install' })).toEqual({ sort: 'install' })
    expect(galleryQueryOf({ search: 'weather', category: 'calendar', sort: 'newest' })).toEqual({ search: 'weather', category: 'calendar', sort: 'newest' })
  })
})

describe('the words of the Recipe Gallery', () => {
  it('capitalises a category\'s slug', () => {
    expect(categoryLabel('calendar')).toBe('Calendar')
  })

  it('counts what is shown, naming the order as the select has it', () => {
    expect(countLine({ shown: 25, total: 412, filtered: false, sort: 'install' })).toBe('Showing 25 of 412 Recipes, most installed first')
    expect(countLine({ shown: 8, total: 8, filtered: true, sort: 'newest' })).toBe('Showing 8 of 8 Recipes that match, newest first')
    expect(countLine({ shown: 1, total: 1, filtered: true, sort: 'popularity' })).toBe('Showing 1 of 1 Recipe that matches, most popular first')
    expect(countLine({ shown: 3, total: 3, filtered: false, sort: 'oldest' })).toBe('Showing 3 of 3 Recipes, oldest first')
  })

  it('ends the list with what was asked for', () => {
    expect(endLine(true)).toBe('That is every Recipe that matches.')
    expect(endLine(false)).toBe('That is the whole catalog.')
  })

  it('says what nothing matched', () => {
    expect(noMatchSentence({ search: 'weather' })).toBe('No Recipe is called “weather”.')
    expect(noMatchSentence({ search: 'weather', category: 'calendar' })).toBe('No Recipe is called “weather” in Calendar.')
    expect(noMatchSentence({ search: '', category: 'calendar' })).toBe('No Recipe is in Calendar.')
  })

  it('counts installs', () => {
    expect(installsLine(1)).toBe('1 install')
    expect(installsLine(1234)).toBe('1,234 installs')
  })

  it('names the Plugins already made from a Recipe', () => {
    expect(heldFromRecipe([])).toEqual([])
    expect(heldFromRecipe([{ id: 'a', name: 'Weather' }])).toEqual(sentence('You already have ', linkTo('Weather', '/plugins/a'), ' from this Recipe.'))
  })
})

describe('the Plugins already imported', () => {
  it('are grouped by their Recipe, and a Plugin from no Recipe is left out', () => {
    const tonight = { ...buildPluginSummary({ id: 'a', name: 'Tonight', sourceRecipeId: '41120' }) }
    const moon = { ...buildPluginSummary({ id: 'b', name: 'Moon', sourceRecipeId: '41120' }) }
    const own = buildPluginSummary({ id: 'c', sourceRecipeId: null })
    expect([...heldByRecipe([tonight, own, moon])]).toEqual([['41120', [tonight, moon]]])
  })
})

describe('a failed load', () => {
  it('says trmnl.com did not answer', () => {
    expect(failedNotice(refusal('upstream-unreachable'))).toEqual({ title: 'trmnl.com did not answer.', reason: 'No Recipes could be loaded.' })
  })

  it('says trmnl.com is busy, as a wait', () => {
    expect(failedNotice(refusal('upstream-busy'))).toEqual({ title: 'trmnl.com is busy with other requests.', reason: 'Wait a minute and try again.' })
  })

  it('says Kuroshiro\'s server is not answering, as every page does', () => {
    expect(failedNotice(new ServerUnreachable())).toEqual({ title: 'Could not load the Recipes.', reason: 'Kuroshiro\'s server is not answering.' })
  })
})
