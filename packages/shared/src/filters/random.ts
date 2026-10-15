import type { Context } from 'liquidjs'

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'
const suffixes = new WeakMap<Context, Map<string, string>>()

/** `append_random`: one suffix per input per render, kept on the render's own context so parallel renders never share one. */
export function appendRandom(context: Context, value: unknown): string {
  const text = String(value)
  const known = suffixes.get(context) ?? new Map<string, string>()
  suffixes.set(context, known)
  let suffix = known.get(text)
  if (suffix === undefined) {
    suffix = Array.from({ length: 4 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('')
    known.set(text, suffix)
  }
  return `${text}${suffix}`
}

/** `random_number`: an integer, both bounds included; one argument is the maximum, none is 0..100. */
export function randomNumber(_value: unknown, first?: unknown, second?: unknown): number {
  const [min, max] = second === undefined ? [0, first === undefined ? 100 : Number(first)] : [Number(first), Number(second)]
  const low = Math.ceil(Math.min(min, max))
  const high = Math.floor(Math.max(min, max))
  return low + Math.floor(Math.random() * (high - low + 1))
}
