import type { RouteLocationRaw } from 'vue-router'

export interface Fact {
  /** The row's name: "Battery". It is also what tells two facts apart. */
  label: string
  /** What there is to say. A fact without a value is left out. */
  value: string | null | undefined
  /** While an Alert fires on this fact, the label that takes the row's place: "Alert: battery low". The row turns red. */
  alert?: string
  /** For something that happens at the Device's next poll: the value stands beside the loading mark. */
  pending?: boolean
  /** Makes the value a link to where the fact is settled. */
  to?: RouteLocationRaw
}
