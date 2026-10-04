import type { RadioChoice } from '@/components/RadioRow.vue'

/** How an External link Screen gets its image: fetched once and kept (`fetchManual`), or at each of its turns. */
export type FetchChoice = 'keep' | 'everyPoll'

export const FETCH_CHOICES: RadioChoice<FetchChoice>[] = [
  { value: 'keep', label: 'Fetch once and keep', hint: 'Kuroshiro keeps the converted image until you refresh it.' },
  { value: 'everyPoll', label: 'Fetch on every poll', hint: 'Kuroshiro downloads and converts it each time this Screen\'s turn comes.' },
]

export const fetchChoiceOf = (fetchManual: boolean): FetchChoice => fetchManual ? 'keep' : 'everyPoll'

export const NOT_A_WEB_ADDRESS = 'Enter an address that starts with http:// or https://.'
