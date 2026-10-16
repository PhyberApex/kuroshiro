import { toInteger } from './numbers.ts'

const randomBelow = (bound: number) => Math.floor(Math.random() * bound)

/** TRMNL's `append_random`: the input and two random bytes as lowercase hex, fresh on every call. */
export function appendRandom(value: unknown): string {
  return `${value ?? ''}${randomBelow(0x10000).toString(16).padStart(4, '0')}`
}

/** TRMNL's `random_number`: the input is ignored; no bound is 0..100, one is 0..n, two are sorted; all inclusive integers. */
export function randomNumber(_value: unknown, min?: unknown, max?: unknown): number {
  const [lower, upper] = randomBounds(min, max)
  return lower + randomBelow(upper - lower + 1)
}

function randomBounds(min: unknown, max: unknown): [number, number] {
  if (min === undefined || min === null || min === false)
    return [0, 100]
  const lower = toInteger(min)
  if (max === undefined || max === null || max === false)
    return [0, lower]
  const upper = toInteger(max)
  return lower <= upper ? [lower, upper] : [upper, lower]
}
