import { reactive, ref } from 'vue'
import { isRefusal } from '@/api/client'
import { assignPlugin } from '@/api/screens'
import { failureReason } from '@/components/failureReason'
import { usePluginPage } from './pluginPage'

/**
 * "Assign to {Device}", which acts at once. It stays busy until the Plugin has been read again, so the row
 * turns to "Assigned" without passing through "Not assigned". A Plugin the server already has there counts as assigned.
 */
export function useAssignToDevice(deviceId: () => string) {
  const { plugin, reload } = usePluginPage()
  const running = ref(false)
  /** Why the last assign failed: a sentence, or nothing when the failure gave none. */
  const failure = ref<{ reason?: string }>()

  async function assign() {
    running.value = true
    failure.value = undefined
    try {
      await assignPlugin(plugin.value.id, { deviceId: deviceId() }).catch((error: unknown) => {
        if (!isRefusal(error, 'plugin-already-assigned'))
          throw error
      })
      await reload()
    }
    catch (error) {
      failure.value = { reason: failureReason(error) }
    }
    finally {
      running.value = false
    }
  }

  return reactive({ running, failure, assign })
}
