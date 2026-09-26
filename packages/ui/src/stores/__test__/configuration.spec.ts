import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { jsonResponse, stubFetch } from '../../test/fetch'
import { useConfigurationStore } from '../configuration'

describe('configuration store', () => {
  let mockFetch: ReturnType<typeof stubFetch>

  beforeEach(() => {
    setActivePinia(createPinia())
    mockFetch = stubFetch()
  })

  it('importArchive posts the file as multipart form data and stores the summary', async () => {
    const summary = { created: { devices: 1 }, updated: {}, warnings: [] }
    let capturedBody: FormData | undefined
    let capturedUrl: string | undefined
    mockFetch.mockImplementation(async (url, init) => {
      capturedUrl = url as string
      capturedBody = init?.body as FormData
      return jsonResponse(summary)
    })

    const store = useConfigurationStore()
    const file = new File(['zip-bytes'], 'kuroshiro-config.zip')
    const result = await store.importArchive(file)

    expect(result).toBe(true)
    expect(capturedUrl).toBe('/api/config/import')
    expect(capturedBody?.get('file')).toBe(file)
    expect(store.importSummary).toEqual(summary)
    expect(store.error).toBeNull()
    expect(store.importing).toBe(false)
  })

  it('importArchive records the server error message and returns false on failure', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ message: 'Archive schemaVersion is 2, but this Kuroshiro instance expects schemaVersion 1' }, false))

    const store = useConfigurationStore()
    const file = new File(['zip-bytes'], 'kuroshiro-config.zip')
    const result = await store.importArchive(file)

    expect(result).toBe(false)
    expect(store.error).toBe('Archive schemaVersion is 2, but this Kuroshiro instance expects schemaVersion 1')
    expect(store.importSummary).toBeNull()
    expect(store.importing).toBe(false)
  })

  it('reset clears the error and summary', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ message: 'boom' }, false))
    const store = useConfigurationStore()
    await store.importArchive(new File(['x'], 'a.zip'))
    expect(store.error).not.toBeNull()

    store.reset()

    expect(store.error).toBeNull()
    expect(store.importSummary).toBeNull()
  })
})
