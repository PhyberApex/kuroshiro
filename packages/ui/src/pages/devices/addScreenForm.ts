import type { ScreenRead } from 'kuroshiro-shared'
import { nextTick, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { fieldErrorsOf } from '@/api/client'
import { failureReason } from '@/components/failureReason'
import { useDeviceFrame } from './deviceFrame'

/**
 * What every kind's form of Add Screen does with its request. `fields` are the fields the form shows a problem at:
 * one the browser found keeps the request from being sent, and one the server names is shown there too.
 * Any other refusal becomes `failure`. Once the Screen exists the Screens view opens with the new row opened;
 * `added` turns true first, so the form no longer holds anything to lose.
 */
export function useAddScreen<Field extends string = never>(fields: readonly Field[] = [], notAdded = 'Not added.') {
  type Problems = Partial<Record<Field, string>>

  const router = useRouter()
  const { device, path } = useDeviceFrame()

  const running = ref(false)
  const added = ref(false)
  const failure = ref<string>()
  const problems = ref<Problems>({})

  const hasAny = (found: Problems) => fields.some(field => found[field])

  /** `refusedAt` words a refusal that is about one field, by that field: an address that gave no image. */
  async function create(request: () => Promise<ScreenRead>, found: Problems = {}, refusedAt: (error: unknown) => Problems = () => ({})) {
    problems.value = found
    failure.value = undefined
    if (hasAny(found))
      return
    running.value = true
    const screen = await request().catch((error: unknown) => {
      const named = fieldErrorsOf(error)
      problems.value = { ...Object.fromEntries(fields.map(field => [field, named[field]])), ...refusedAt(error) } as Problems
      if (!hasAny(problems.value))
        failure.value = `${notAdded} ${failureReason(error) ?? 'Something went wrong.'}`
    })
    if (screen) {
      added.value = true
      await nextTick()
      await router.push({ path: path.value, query: { screen: screen.id } })
      void device.reload()
    }
    running.value = false
  }

  return reactive({ running, added, failure, problems, create })
}
