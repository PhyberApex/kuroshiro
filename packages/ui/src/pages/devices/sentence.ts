/** One run of a sentence: plain words, a name in bold, a value in mono, or a link. */
export interface SentencePart {
  text: string
  strong?: boolean
  mono?: boolean
  to?: string
}

export type Sentence = SentencePart[]

export const strong = (text: string): SentencePart => ({ text, strong: true })
export const mono = (text: string): SentencePart => ({ text, mono: true })
export const linkTo = (text: string, to: string): SentencePart => ({ text, to })

/** A sentence from its runs; a plain string is words. */
export function sentence(...parts: (string | SentencePart)[]): Sentence {
  return parts.map(part => typeof part === 'string' ? { text: part } : part)
}
