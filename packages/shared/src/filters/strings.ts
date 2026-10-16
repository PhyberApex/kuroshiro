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

/** A filter's keyword arguments, which liquidjs hands over as `[name, value]` pairs after the positional ones. */
function keywordArguments(rest: unknown[]): Record<string, unknown> {
  return Object.fromEntries(rest.filter((arg): arg is [string, unknown] => Array.isArray(arg) && arg.length === 2 && typeof arg[0] === 'string'))
}

/** TRMNL's `pluralize(singular, count, plural: …)`: the count, then the singular for one and the plural otherwise. */
export function pluralize(word: unknown, count: unknown = 1, ...rest: unknown[]): string {
  const singular = String(word)
  const { plural } = keywordArguments(rest)
  const inflected = plural === undefined ? pluralOf(singular) : String(plural)
  return `${count} ${Number(count) === 1 ? singular : inflected}`
}

/** TRMNL's `parse_json`: anything but a JSON string is a render error, as it is upstream. */
export function parseJson(value: unknown): unknown {
  if (typeof value !== 'string')
    throw new TypeError(`parse_json expects a JSON string, not ${value === null || value === undefined ? 'nothing' : typeof value}`)
  try {
    return JSON.parse(value)
  }
  catch (error) {
    throw new SyntaxError(`parse_json could not read the JSON: ${(error as Error).message}`)
  }
}
