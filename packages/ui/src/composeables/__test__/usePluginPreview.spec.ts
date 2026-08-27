import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePluginPreview } from '../usePluginPreview'

describe('usePluginPreview', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('starts with the preview dialog closed and no output', () => {
    const preview = usePluginPreview({
      dataSources: () => [],
      liquidMarkup: () => '',
    })

    expect(preview.showPreview.value).toBe(false)
    expect(preview.previewHtml.value).toBe('')
    expect(preview.previewError.value).toBe('')
    expect(preview.previewTab.value).toBe('rendered')
  })

  it('does nothing when there are no data sources', async () => {
    const preview = usePluginPreview({
      dataSources: () => [],
      liquidMarkup: () => '<div>{{ data.title }}</div>',
    })

    await preview.previewPlugin()

    expect(fetch).not.toHaveBeenCalled()
  })

  it('still posts an empty template when there are data sources (matches the original per-view guards)', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ html: '', data: null }),
    } as Response)

    const preview = usePluginPreview({
      dataSources: () => [{ name: 'source-1', mode: 'literal', literalValue: 'x' }],
      liquidMarkup: () => '',
    })

    await preview.previewPlugin()

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
    expect(body.template).toBe('')
  })

  it('posts the mapped sources and template, then shows the rendered result', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ html: '<p>hi</p>', data: { title: 'hi' } }),
    } as Response)

    const preview = usePluginPreview({
      dataSources: () => [{ name: 'source-1', mode: 'fetch', url: 'https://example.com', method: 'GET' }],
      liquidMarkup: () => '<div>{{ data.title }}</div>',
    })

    await preview.previewPlugin()

    expect(fetch).toHaveBeenCalledWith('/api/plugins/preview', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }))
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
    expect(body).toEqual({
      sources: [{ name: 'source-1', mode: 'fetch', url: 'https://example.com', method: 'GET', headers: undefined, body: undefined, transformJs: undefined, literalValue: undefined }],
      template: '<div>{{ data.title }}</div>',
    })

    expect(preview.previewHtml.value).toBe('<p>hi</p>')
    expect(preview.previewData.value).toEqual({ title: 'hi' })
    expect(preview.previewError.value).toBe('')
    expect(preview.showPreview.value).toBe(true)
    expect(preview.previewLoading.value).toBe(false)
  })

  it('includes fieldValues in the payload when provided', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ html: '', data: null }),
    } as Response)

    const preview = usePluginPreview({
      dataSources: () => [{ name: 'source-1', mode: 'literal', literalValue: 'x' }],
      liquidMarkup: () => '<div></div>',
      fieldValues: () => ({ apiKey: 'secret' }),
    })

    await preview.previewPlugin()

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
    expect(body.fieldValues).toEqual({ apiKey: 'secret' })
  })

  it('surfaces a friendly message for a 403 response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({}),
      text: async () => '',
    } as Response)

    const preview = usePluginPreview({
      dataSources: () => [{ name: 'source-1', mode: 'fetch', url: 'https://example.com' }],
      liquidMarkup: () => '<div></div>',
    })

    await preview.previewPlugin()

    expect(preview.previewError.value).toContain('403')
    expect(preview.showPreview.value).toBe(false)
    expect(preview.previewLoading.value).toBe(false)
  })

  it('surfaces the fetch failure message when the request throws', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network down'))

    const preview = usePluginPreview({
      dataSources: () => [{ name: 'source-1', mode: 'fetch', url: 'https://example.com' }],
      liquidMarkup: () => '<div></div>',
    })

    await preview.previewPlugin()

    expect(preview.previewError.value).toBe('network down')
  })
})
