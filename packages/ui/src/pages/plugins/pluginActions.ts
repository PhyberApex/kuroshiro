import { onScopeDispose, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { duplicatePlugin, exportPlugin } from '@/api/plugins'
import { failureReason } from '@/components/failureReason'
import { openPluginPage } from './pluginArrival'

interface NamedPlugin {
  id: string
  name: string
}

/** "Duplicate": makes the copy and opens its page, which says what it is a copy of. */
export function useDuplicatePlugin() {
  const router = useRouter()
  const duplicating = ref<NamedPlugin>()
  const failure = ref<{ plugin: NamedPlugin, reason: string }>()

  async function duplicate(plugin: NamedPlugin) {
    if (duplicating.value)
      return
    duplicating.value = plugin
    failure.value = undefined
    try {
      const copy = await duplicatePlugin(plugin.id)
      await openPluginPage(router, copy.id, { how: 'duplicated', source: plugin.name })
    }
    catch (error) {
      failure.value = { plugin, reason: failureReason(error) ?? 'That did not work.' }
    }
    finally {
      duplicating.value = undefined
    }
  }

  return reactive({ duplicating, failure, duplicate })
}

const EXPORTED_FOR_MS = 2000

/**
 * "Export": fetches the file and has the browser save it, naming the Plugin as `exporting`
 * while that runs and as `exported` for the 2 seconds its control reads "Exported" afterwards.
 * A refusal leaves `failure` instead, with the reason to show beside "Try again".
 */
export function useExportPlugin() {
  const exporting = ref<NamedPlugin>()
  const exported = ref<NamedPlugin>()
  const failure = ref<{ plugin: NamedPlugin, reason: string }>()
  let forgetting: ReturnType<typeof setTimeout> | undefined

  async function download(plugin: NamedPlugin) {
    if (exporting.value)
      return
    exporting.value = plugin
    failure.value = undefined
    try {
      await exportPlugin(plugin.id)
      exported.value = plugin
      clearTimeout(forgetting)
      forgetting = setTimeout(() => (exported.value = undefined), EXPORTED_FOR_MS)
    }
    catch (error) {
      failure.value = { plugin, reason: failureReason(error) ?? 'That did not work.' }
    }
    finally {
      exporting.value = undefined
    }
  }

  onScopeDispose(() => clearTimeout(forgetting))

  return reactive({ exporting, exported, failure, download })
}
