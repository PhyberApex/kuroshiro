import { describe, expect, it } from 'vitest'
import { ApiRefusal, ServerUnreachable } from '@/api/client'
import { linkTo, sentence } from '@/pages/devices/sentence'
import { importArrival, importedBefore, importTrouble, recipeProblem } from '../importPlugin'

const refusal = (code: ApiRefusal['code'], message = 'The server\'s own sentence.') => new ApiRefusal({ statusCode: 422, code, message })

describe('a Recipe as entered', () => {
  it('has no problem when its id can be read', () => {
    expect(recipeProblem('41120')).toBeUndefined()
    expect(recipeProblem('https://trmnl.com/recipes/41120')).toBeUndefined()
  })

  it('asks for a Recipe when nothing is entered', () => {
    expect(recipeProblem('  ')).toBe('Enter a Recipe\'s address or its id.')
  })

  it('says what a Recipe looks like for anything else', () => {
    expect(recipeProblem('weather')).toBe('This is not a Recipe address or id. It looks like https://trmnl.com/recipes/41120, or 41120.')
  })
})

describe('the Plugins that came from a Recipe before', () => {
  it('are no sentence when there are none', () => {
    expect(importedBefore([])).toEqual([])
  })

  it('name one Plugin as a link, and the import as a second', () => {
    expect(importedBefore([{ id: 'weather', name: 'Weather' }])).toEqual(sentence(
      'You already have ',
      linkTo('Weather', '/plugins/weather'),
      ' from this Recipe. Importing makes a second Plugin.',
    ))
  })

  it('list several', () => {
    const plugins = [{ id: 'a', name: 'Weather' }, { id: 'b', name: 'Weather (copy)' }, { id: 'c', name: 'Forecast' }]

    expect(importedBefore(plugins).map(part => part.text).join('')).toBe('You already have Weather, Weather (copy) and Forecast from this Recipe. Importing makes another Plugin.')
  })
})

describe('why nothing was imported', () => {
  const wording = { upstream: 'trmnl.com', entered: { 'recipe-oauth': true, 'import-no-plugin': 'This Recipe holds no template.' } } as const

  it('goes under the field for a refusal about what was entered, in the refusal\'s words or the way\'s own', () => {
    expect(importTrouble(refusal('recipe-oauth'), wording)).toEqual({ entered: 'This Recipe signs in to another service with OAuth, which Kuroshiro cannot do.' })
    expect(importTrouble(refusal('import-no-plugin'), wording)).toEqual({ entered: 'This Recipe holds no template.' })
  })

  it('names the site that did not answer', () => {
    expect(importTrouble(refusal('upstream-unreachable'), wording)).toEqual({ unanswered: 'trmnl.com did not answer.' })
  })

  it('is a failure in the foot for a way that downloads nothing, and for anything else', () => {
    expect(importTrouble(refusal('upstream-unreachable'), { entered: {} })).toEqual({ failure: 'Not imported. TRMNL did not answer.' })
    expect(importTrouble(refusal('device-not-found'), wording)).toEqual({ failure: 'Not imported. That Device does not exist.' })
    expect(importTrouble(new ServerUnreachable(), wording)).toEqual({ failure: 'Not imported. Kuroshiro\'s server is not answering.' })
    expect(importTrouble(undefined, wording)).toEqual({ failure: 'Not imported. Something went wrong.' })
  })

  it('shows the server\'s sentence for a refusal without wording', () => {
    expect(importTrouble(refusal('recipe-static-transform'), { entered: { 'recipe-static-transform': true } })).toEqual({ entered: 'The server\'s own sentence.' })
  })
})

describe('what the Plugin\'s page is told about an import', () => {
  const plugin = undefined as never

  it.each([
    [{ type: 'recipe', id: '41120', name: 'Moon Phase' } as const, 'recipe', 'Moon Phase'],
    [{ type: 'file', fileName: 'moon.trmnlp.zip' } as const, 'file', 'moon.trmnlp.zip'],
    [{ type: 'github', repository: 'usetrmnl/moon-phase' } as const, 'github', 'usetrmnl/moon-phase'],
  ])('names where it came from: %o', (origin, type, name) => {
    expect(importArrival({ plugin, origin, hasTransform: true }, { id: 'kitchen', name: 'Kitchen' })).toEqual({ how: 'imported', origin: type, name, hasTransform: true, device: { id: 'kitchen', name: 'Kitchen' } })
  })
})
