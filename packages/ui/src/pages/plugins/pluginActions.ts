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

/** "Export": starts the download, and names the Plugin as `exported` for the 2 seconds its control reads "Exported". */
export function useExportPlugin() {
  const exported = ref<NamedPlugin>()
  let forgetting: ReturnType<typeof setTimeout> | undefined

  function download(plugin: NamedPlugin) {
    exportPlugin(plugin.id)
    exported.value = plugin
    clearTimeout(forgetting)
    forgetting = setTimeout(() => (exported.value = undefined), EXPORTED_FOR_MS)
  }

  onScopeDispose(() => clearTimeout(forgetting))

  return reactive({ exported, download })
}
