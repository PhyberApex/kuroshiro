const IRREGULAR: Record<string, string> = {
  calf: 'calves',
  child: 'children',
  echo: 'echoes',
  foot: 'feet',
  goose: 'geese',
  half: 'halves',
  hero: 'heroes',
  knife: 'knives',
  leaf: 'leaves',
  life: 'lives',
  loaf: 'loaves',
  man: 'men',
  mouse: 'mice',
  octopus: 'octopi',
  ox: 'oxen',
  person: 'people',
  potato: 'potatoes',
  shelf: 'shelves',
  thief: 'thieves',
  tomato: 'tomatoes',
  tooth: 'teeth',
  wife: 'wives',
  wolf: 'wolves',
  woman: 'women',
}
const UNCOUNTABLE = new Set(['equipment', 'fish', 'information', 'money', 'rice', 'series', 'sheep', 'species'])

function pluralOf(word: string): string {
  const lower = word.toLowerCase()
  if (UNCOUNTABLE.has(lower))
    return word
  const irregular = IRREGULAR[lower]
  if (irregular)
    return word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase() ? `${irregular[0].toUpperCase()}${irregular.slice(1)}` : irregular
  if (/[^aeiou]y$/i.test(word))
    return `${word.slice(0, -1)}ies`
  if (/(?:[sxz]|ch|sh)$/i.test(word))
    return `${word}es`
  return `${word}s`
}

/** TRMNL's `pluralize`: the count, then the word inflected for it. */
export function pluralize(word: unknown, count: unknown = 1): string {
  const text = String(word)
  return `${count} ${Number(count) === 1 ? text : pluralOf(text)}`
}

export function parseJson(value: unknown): unknown {
  if (typeof value !== 'string')
    return value
  try {
    return JSON.parse(value)
  }
  catch {
    return value
  }
}
