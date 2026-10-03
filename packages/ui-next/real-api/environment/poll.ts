import { setTimeout as sleep } from 'node:timers/promises'

/** Asks `ready` every half second until it says yes; answers whether it did within `attempts`. */
export async function becomesReady(ready: () => Promise<boolean> | boolean, attempts: number): Promise<boolean> {
  if (await ready())
    return true
  if (attempts <= 1)
    return false
  await sleep(500)
  return becomesReady(ready, attempts - 1)
}
