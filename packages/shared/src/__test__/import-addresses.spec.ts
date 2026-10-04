import { describe, expect, it } from 'vitest'
import { githubRepositoryOf, recipeIdOf } from '../api/plugins'

describe('reading a Recipe id', () => {
  it.each([
    ['41120', '41120'],
    ['  41120 ', '41120'],
    ['https://trmnl.com/recipes/41120', '41120'],
    ['https://usetrmnl.com/recipes/41120/install?ref=x', '41120'],
    ['trmnl.com/recipes/7', '7'],
    ['041120', '41120'],
    ['https://trmnl.com/recipes/007', '7'],
    ['0', '0'],
  ])('reads “%s” as %s', (entered, id) => {
    expect(recipeIdOf(entered)).toBe(id)
  })

  it.each(['', '   ', 'weather', '41120a', 'https://trmnl.com/recipes/', 'https://trmnl.com/plugins/41120', '-5', '4 1'])('reads no id from “%s”', (entered) => {
    expect(recipeIdOf(entered)).toBeNull()
  })
})

describe('reading a GitHub repository', () => {
  it.each([
    ['https://github.com/usetrmnl/weather-plugin', 'usetrmnl/weather-plugin'],
    [' https://github.com/usetrmnl/weather-plugin/ ', 'usetrmnl/weather-plugin'],
    ['https://github.com/usetrmnl/weather-plugin.git', 'usetrmnl/weather-plugin'],
    ['http://www.github.com/Phyber_Apex/kuro.shiro', 'Phyber_Apex/kuro.shiro'],
  ])('reads “%s” as %s', (entered, repository) => {
    expect(githubRepositoryOf(entered)).toBe(repository)
  })

  it.each([
    '',
    'usetrmnl/weather-plugin',
    'https://gitlab.com/usetrmnl/weather-plugin',
    'https://github.com/usetrmnl',
    'https://github.com/usetrmnl/weather-plugin/tree/develop/plugins/weather',
    'https://github.com/usetrmnl/weather plugin',
  ])('reads no repository from “%s”', (entered) => {
    expect(githubRepositoryOf(entered)).toBeNull()
  })
})
