import type { ScreenRead } from 'kuroshiro-shared'
import { nextTick, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { failureReason } from '@/components/failureReason'
import { useDeviceFrame } from './deviceFrame'

/**
 * What every kind's form of Add Screen does with its request: it runs it, and once the Screen exists opens the
 * Screens view with the new row opened. `added` turns true first, so the form no longer holds anything to lose.
 */
export function useAddScreen(notAdded = 'Not added.') {
  const router = useRouter()
  const { device, path } = useDeviceFrame()

  const adding = ref(false)
  const added = ref(false)
  const failure = ref<string>()

  /** `placed` takes a refusal the form shows at one of its fields and answers whether it did; any other becomes `failure`. */
  async function add(create: () => Promise<ScreenRead>, placed: (error: unknown) => boolean = () => false) {
    adding.value = true
    failure.value = undefined
    try {
      const screen = await create()
      added.value = true
      await nextTick()
      await router.push({ path: path.value, query: { screen: screen.id } })
      void device.reload()
    }
    catch (error) {
      if (!placed(error))
        failure.value = `${notAdded} ${failureReason(error) ?? 'Something went wrong.'}`
    }
    finally {
      adding.value = false
    }
  }

  return reactive({ adding, added, failure, add })
}
