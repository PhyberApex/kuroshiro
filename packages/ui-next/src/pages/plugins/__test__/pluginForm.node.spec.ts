import type { PluginDetail, UpdatePluginInput } from 'kuroshiro-shared'
import type { PluginFormPart } from '../pluginForm'
import { describe, expect, it, vi } from 'vitest'
import { ApiRefusal } from '@/api/client'
import { buildApiError } from '@/testing/fixtures/errors'
import { buildPluginDetail } from '@/testing/fixtures/plugins'
import { changedSentence, createPluginForm, lostSentence, thingsToFix } from '../pluginForm'
import { pluginNaming } from '../pluginNaming'

const sources: PluginFormPart<{ rows: Array<{ id?: string, name: string, url: string }> }> = {
  keys: ['dataSources'],
  read: plugin => ({ rows: plugin.dataSources.map(({ id, name, url }) => ({ id, name, url: url ?? '' })) }),
  toInput: draft => ({ dataSources: draft.rows.map(row => ({ ...row, mode: 'fetch' as const })) }),
  validate: draft => draft.rows.flatMap((row, index) => row.url.startsWith('http') ? [] : [{ path: `dataSources.${index}.url`, message: 'Enter an address that starts with http:// or https://.' }]),
}

const WEATHER = buildPluginDetail({ name: 'Weather', description: null })

function formOf(plugin: PluginDetail = WEATHER) {
  const sent: UpdatePluginInput[] = []
  const send = vi.fn(async (input: UpdatePluginInput) => {
    sent.push(input)
    return { ...plugin, ...input } as PluginDetail
  })
  const form = createPluginForm(plugin, send)
  return { form, send, sent }
}

function refusal(fields: Record<string, string>) {
  return new ApiRefusal(buildApiError({ statusCode: 400, code: 'validation', fields: Object.entries(fields).map(([path, message]) => ({ path, message })) }))
}

describe('the Plugin page\'s one form', () => {
  describe('what differs', () => {
    it('is unchanged until a part\'s draft differs from what is saved, and names the changed keys in the page\'s order', () => {
      const { form } = formOf()
      const name = form.register(pluginNaming)
      const data = form.register(sources)
      expect(form.changed).toBe(false)

      name.draft.name = 'Forecast'
      data.draft.rows[0]!.url = 'https://example.com/forecast'

      expect(form.changed).toBe(true)
      expect(form.changedKeys).toEqual(['dataSources', 'name'])
      expect(form.changes).toEqual({
        name: 'Forecast',
        dataSources: [{ id: WEATHER.dataSources[0]!.id, name: 'forecast', url: 'https://example.com/forecast', mode: 'fetch' }],
      })
    })

    it('does not count a draft that maps to the same input, such as a space after the name', () => {
      const { form } = formOf()
      const name = form.register(pluginNaming)

      name.draft.name = 'Weather '

      expect(form.changed).toBe(false)
    })

    it('holds the whole unsaved state, changed or not, for the preview', () => {
      const { form } = formOf()
      const name = form.register(pluginNaming)
      form.register(sources)

      name.draft.description = 'Rain or shine'

      expect(form.unsaved).toMatchObject({ name: 'Weather', description: 'Rain or shine', dataSources: [{ name: 'forecast' }] })
    })

    it('puts every draft back on discard', () => {
      const { form } = formOf()
      const name = form.register(pluginNaming)

      name.draft.name = 'Forecast'
      form.discard()

      expect(name.draft.name).toBe('Weather')
      expect(form.changed).toBe(false)
    })

    it('refuses a second part that owns a key another part owns', () => {
      const { form } = formOf()
      form.register(pluginNaming)

      expect(() => form.register(pluginNaming)).toThrow('name')
    })
  })

  describe('saving', () => {
    it('sends only the keys that changed and nothing when nothing did', async () => {
      const { form, sent } = formOf()
      const name = form.register(pluginNaming)
      form.register(sources)

      await form.save()
      expect(sent).toEqual([])

      name.draft.name = 'Forecast'
      await form.save()

      expect(sent).toEqual([{ name: 'Forecast' }])
    })

    it('replaces what is saved with the answer, so the form is unchanged and the drafts read the answer', async () => {
      const { form, send } = formOf()
      const name = form.register(pluginNaming)
      send.mockImplementationOnce(async () => ({ ...WEATHER, name: 'Forecast (as stored)' }))

      name.draft.name = 'Forecast'
      const answer = await form.save()

      expect(answer?.name).toBe('Forecast (as stored)')
      expect(form.plugin.name).toBe('Forecast (as stored)')
      expect(name.draft.name).toBe('Forecast (as stored)')
      expect(form.changed).toBe(false)
    })

    it('keeps what was typed into a part while its save was under way', async () => {
      const { form, send } = formOf()
      const name = form.register(pluginNaming)
      let answer!: (plugin: PluginDetail) => void
      send.mockImplementationOnce(() => new Promise<PluginDetail>(resolve => (answer = resolve)))

      name.draft.name = 'Forecast'
      const saving = form.save()
      expect(form.saving).toBe(true)
      name.draft.name = 'Forecast, hourly'
      answer({ ...WEATHER, name: 'Forecast' })
      await saving

      expect(name.draft.name).toBe('Forecast, hourly')
      expect(form.changes).toEqual({ name: 'Forecast, hourly' })
    })

    it('keeps everything entered when the save is refused, says why, and forgets the reason once the form is edited', async () => {
      const { form, send } = formOf()
      const name = form.register(pluginNaming)
      send.mockRejectedValueOnce(new Error('Kuroshiro\'s server is not answering.'))

      name.draft.name = 'Forecast'
      expect(await form.save()).toBeUndefined()

      expect(name.draft.name).toBe('Forecast')
      expect(form.failure).toBe('Kuroshiro\'s server is not answering.')
      expect(form.saving).toBe(false)

      name.draft.name = 'Forecast, hourly'
      expect(form.failure).toBeUndefined()
    })
  })

  describe('problems', () => {
    it('sends nothing while a part is invalid, and counts the problems only once a save was tried', async () => {
      const { form, sent } = formOf()
      const name = form.register(pluginNaming)
      const data = form.register(sources)

      name.draft.name = ''
      data.draft.rows[0]!.url = 'ftp://example.com'
      expect(form.problems).toEqual([])
      expect(name.errors).toEqual({})

      await form.save()

      expect(sent).toEqual([])
      expect(form.problems.map(problem => problem.path)).toEqual(['name', 'dataSources.0.url'])
      expect(name.errors).toEqual({ name: 'A Plugin needs a name.' })
      expect(data.errors).toEqual({ 'dataSources.0.url': 'Enter an address that starts with http:// or https://.' })
    })

    it('drops a problem as soon as its field is put right', async () => {
      const { form } = formOf()
      const name = form.register(pluginNaming)

      name.draft.name = ''
      await form.save()
      name.draft.name = 'Forecast'

      expect(form.problems).toEqual([])
      expect(name.errors).toEqual({})
    })

    it('hands a validation refusal\'s field errors to the part that owns the path, until that part is edited', async () => {
      const { form, send } = formOf()
      const name = form.register(pluginNaming)
      const data = form.register(sources)
      send.mockRejectedValueOnce(refusal({ 'dataSources.0.url': 'url must be a URL address' }))

      data.draft.rows[0]!.url = 'https://nowhere'
      await form.save()

      expect(data.errors).toEqual({ 'dataSources.0.url': 'url must be a URL address' })
      expect(name.errors).toEqual({})
      expect(form.problems).toEqual([{ path: 'dataSources.0.url', message: 'url must be a URL address' }])
      expect(form.failure).toBeUndefined()

      name.draft.name = 'Forecast'
      expect(data.errors).toEqual({ 'dataSources.0.url': 'url must be a URL address' })

      data.draft.rows[0]!.url = 'https://example.com'
      expect(data.errors).toEqual({})
    })

    it('says "Not saved" for a validation refusal whose paths no part owns', async () => {
      const { form, send } = formOf()
      const name = form.register(pluginNaming)
      send.mockRejectedValueOnce(refusal({ 'templates.0.liquidMarkup': 'too long' }))

      name.draft.name = 'Forecast'
      await form.save()

      expect(form.problems).toEqual([])
      expect(form.failure).toBe('Some of what was sent is not valid.')
    })

    it('has the part that owns the first problem open it, and answers its path', async () => {
      const { form } = formOf()
      const revealName = vi.fn()
      const revealSource = vi.fn()
      form.register(pluginNaming, revealName)
      const data = form.register(sources, revealSource)

      data.draft.rows[0]!.url = ''
      await form.save()

      expect(await form.showFirst()).toBe('dataSources.0.url')
      expect(revealSource).toHaveBeenCalledWith('dataSources.0.url')
      expect(revealName).not.toHaveBeenCalled()
    })

    it('lets a part validate against the whole unsaved state', async () => {
      const { form } = formOf()
      const name = form.register(pluginNaming)
      form.register<{ keynames: string[] }>({
        keys: ['fields'],
        read: () => ({ keynames: ['forecast'] }),
        toInput: draft => ({ fields: draft.keynames.map(keyname => ({ keyname, name: keyname })) }),
        validate: (draft, { unsaved }) => draft.keynames
          .filter(keyname => unsaved.dataSources?.some(source => source.name === keyname))
          .map((keyname, index) => ({ path: `fields.${index}.keyname`, message: `${keyname} is already the name of a Data Source.` })),
      })
      form.register(sources)

      name.draft.name = 'Forecast'
      await form.save()

      expect(form.problems).toEqual([{ path: 'fields.0.keyname', message: 'forecast is already the name of a Data Source.' }])
    })
  })

  describe('a re-read of the Plugin', () => {
    it('follows the server in a part that is unchanged', () => {
      const { form } = formOf()
      const name = form.register(pluginNaming)

      form.refresh({ ...WEATHER, name: 'Weather, renamed elsewhere' })

      expect(name.draft.name).toBe('Weather, renamed elsewhere')
      expect(form.changed).toBe(false)
    })

    it('never touches a part that holds unsaved changes', () => {
      const { form } = formOf()
      const name = form.register(pluginNaming)
      const data = form.register(sources)

      name.draft.name = 'Forecast'
      form.refresh({ ...WEATHER, name: 'Weather, renamed elsewhere', dataSources: [{ ...WEATHER.dataSources[0]!, url: 'https://example.com/changed-elsewhere' }] })

      expect(name.draft.name).toBe('Forecast')
      expect(form.changes).toEqual({ name: 'Forecast' })
      expect(data.draft.rows[0]!.url).toBe('https://example.com/changed-elsewhere')
    })

    it('leaves what was entered where the server says nothing new, even when it would send the same as what is saved', () => {
      const { form } = formOf()
      const name = form.register(pluginNaming)

      name.draft.name = 'Weather '
      form.refresh({ ...WEATHER, dataSources: [{ ...WEATHER.dataSources[0]!, fetchFailureStreak: 3 }] })

      expect(form.changed).toBe(false)
      expect(name.draft.name).toBe('Weather ')
    })

    it('puts a discarded part back to what the server said last, not to what it held before', () => {
      const { form } = formOf()
      const name = form.register(pluginNaming)

      name.draft.name = 'Forecast'
      form.refresh({ ...WEATHER, name: 'Weather, renamed elsewhere' })
      form.discard()

      expect(name.draft.name).toBe('Weather, renamed elsewhere')
      expect(form.changed).toBe(false)
    })

    it('keeps the same draft object when what was read is the same, so nothing renders again', () => {
      const { form } = formOf()
      const data = form.register(sources)
      const before = data.draft

      form.refresh({ ...WEATHER, dataSources: [{ ...WEATHER.dataSources[0]!, fetchFailureStreak: 3 }] })

      expect(data.draft).toBe(before)
    })
  })

  describe('a part that leaves the page', () => {
    it('takes its changes and problems with it', () => {
      const { form } = formOf()
      const name = form.register(pluginNaming)

      name.draft.name = 'Forecast'
      name.remove()

      expect(form.changed).toBe(false)
      expect(form.unsaved).toEqual({})
    })
  })
})

describe('the save bar\'s wording', () => {
  it('names what changed in the page\'s order', () => {
    expect(changedSentence(['name'], { previewed: false })).toBe('to the name.')
    expect(changedSentence(['name', 'description'], { previewed: false })).toBe('to the name and description.')
    expect(changedSentence(['templates', 'dataSources', 'fieldValues'], { previewed: true })).toBe('to the template, Data Sources and Field Values. The preview already shows them.')
    expect(changedSentence(['refreshInterval', 'fields'], { previewed: true })).toBe('to the refresh interval and Plugin Fields. The preview already shows them.')
  })

  it('does not speak of a preview for a change the preview does not draw', () => {
    expect(changedSentence(['description'], { previewed: true })).toBe('to the description.')
  })

  it('names what leaving loses', () => {
    expect(lostSentence('Weather', ['templates', 'dataSources'])).toBe('Your changes to Weather\'s template and Data Sources.')
  })

  it('counts the things to fix', () => {
    expect(thingsToFix(1)).toBe('1 thing to fix before this can be saved.')
    expect(thingsToFix(3)).toBe('3 things to fix before this can be saved.')
  })
})
