import type { PluginDataSource } from '@/types/plugin'
import type { RenderTarget } from '@/utils/screenShell'
import { ref } from 'vue'
import { errorMessage } from '@/utils/errorMessage'
import { DEFAULT_MODEL, DEFAULT_PALETTE } from '@/utils/renderTarget'

export interface UsePluginPreviewOptions {
  dataSources: () => Partial<PluginDataSource>[] | undefined
  liquidMarkup: () => string | undefined
  fieldValues?: () => Record<string, string>
}

/** Shared preview state and the `/api/plugins/preview` call used by both the create and edit plugin views. */
export function usePluginPreview(options: UsePluginPreviewOptions) {
  const previewLoading = ref(false)
  const previewHtml = ref('')
  const previewTarget = ref<RenderTarget>({ model: DEFAULT_MODEL, palette: DEFAULT_PALETTE })
  const previewData = ref<Record<string, unknown> | null>(null)
  const previewError = ref('')
  const showPreview = ref(false)
  const previewTab = ref('rendered')

  async function previewPlugin() {
    const sources = options.dataSources() || []
    const template = options.liquidMarkup()
    if (sources.length === 0 || !template)
      return

    previewLoading.value = true
    try {
      const res = await fetch('/api/plugins/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sources: sources.map(source => ({
            name: source.name,
            mode: source.mode,
            url: source.url,
            method: source.method,
            headers: source.headers,
            body: source.body,
            transformJs: source.transformJs,
            literalValue: source.literalValue,
          })),
          template,
          ...(options.fieldValues ? { fieldValues: options.fieldValues() } : {}),
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        const errorMsg = errorData.message || await res.text() || 'Unknown error'

        if (res.status === 403) {
          throw new Error('API returned 403 (authentication required). The data source may require API keys or authentication headers.')
        }
        else if (res.status === 404) {
          throw new Error('API endpoint not found (404). Check the data source URL.')
        }
        else if (res.status >= 500) {
          throw new Error(`API server error (${res.status}). The data source may be unavailable.`)
        }
        else {
          throw new Error(`Preview failed: ${errorMsg}`)
        }
      }

      const result = await res.json()
      previewHtml.value = result.html
      previewData.value = result.data
      previewError.value = ''
      showPreview.value = true
    }
    catch (err) {
      console.error('Preview error:', err)
      previewError.value = errorMessage(err, 'Failed to generate preview. Check console for details.')
    }
    finally {
      previewLoading.value = false
    }
  }

  return {
    previewLoading,
    previewHtml,
    previewTarget,
    previewData,
    previewError,
    showPreview,
    previewTab,
    previewPlugin,
  }
}
