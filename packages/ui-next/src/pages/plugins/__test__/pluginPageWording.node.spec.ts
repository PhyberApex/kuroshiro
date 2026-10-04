import type { PluginArrival } from '../pluginArrival'
import { describe, expect, it } from 'vitest'
import { buildPluginDetail } from '@/testing/fixtures/plugins'
import { actionsParagraph, arrivalLine, fetchInterval, savedLine } from '../pluginPageWording'

const KITCHEN = { id: 'kitchen', name: 'Kitchen' }

describe('the Plugin page\'s wording', () => {
  it('says whole hours as hours and anything else as minutes', () => {
    expect(fetchInterval(1)).toBe('every minute')
    expect(fetchInterval(15)).toBe('every 15 minutes')
    expect(fetchInterval(60)).toBe('every hour')
    expect(fetchInterval(120)).toBe('every 2 hours')
    expect(fetchInterval(90)).toBe('every 90 minutes')
  })

  it.each<[PluginArrival, string]>([
    [{ how: 'created' }, 'Created. It shows its name until you write its template. It is not on a Device yet.'],
    [{ how: 'created', device: KITCHEN }, 'Created. It shows its name until you write its template. Assigned to Kitchen.'],
    [{ how: 'duplicated', source: 'Weather' }, 'A copy of Weather. It is not on a Device yet.'],
    [{ how: 'imported', origin: 'recipe', name: 'Tide table', hasTransform: false }, 'Imported from the Recipe Tide table. It is not on a Device yet.'],
    [{ how: 'imported', origin: 'file', name: 'tides.trmnlp.zip', hasTransform: false, device: KITCHEN }, 'Imported from tides.trmnlp.zip. Assigned to Kitchen.'],
    [{ how: 'imported', origin: 'github', name: 'usetrmnl/tides', hasTransform: true }, 'Imported from usetrmnl/tides. It is not on a Device yet. It brings a transform: JavaScript that runs on this server at every fetch. Read it under Data Sources.'],
    [{ how: 'applied', updateItems: 3, recipe: 'Tide table' }, 'Applied 3 Update Items from the Recipe Tide table.'],
    [{ how: 'applied', updateItems: 1, recipe: 'Tide table' }, 'Applied 1 Update Item from the Recipe Tide table.'],
    [{ how: 'skipped', updateItems: 2, recipe: 'Tide table' }, 'Skipped 2 Update Items from the Recipe Tide table.'],
  ])('words the arrival %j', (arrival, text) => {
    expect(arrivalLine(arrival).text).toBe(text)
  })

  it('links back to the Screens of the Device the Plugin was assigned to on the way', () => {
    expect(arrivalLine({ how: 'created', device: KITCHEN }).back).toEqual({ label: 'Back to Kitchen\'s Screens', to: '/devices/kitchen' })
    expect(arrivalLine({ how: 'created' }).back).toBeUndefined()
  })

  it('says after a save which Devices the Plugin is rendered again for, and only the time for a Plugin on none', () => {
    const at = new Date(2026, 9, 3, 7, 46)
    expect(savedLine(at, buildPluginDetail()).text).toBe('Saved at 07:46. Fetching and rendering again for Kitchen.')
    expect(savedLine(at, buildPluginDetail({ assignments: [] })).text).toBe('Saved at 07:46.')
  })

  it('words the paragraph over duplicate, export and delete for a Poll-kind and a Webhook-kind Plugin', () => {
    expect(actionsParagraph(buildPluginDetail())).toBe('A duplicate is a second Plugin with the same template, Data Sources, Plugin Fields and Field Values, on no Device. An export is a .zip with the template, the Data Sources as written, headers included, and the Plugin Fields, without Field Values. Deleting removes Weather from this Instance and from Kitchen.')
    expect(actionsParagraph(buildPluginDetail({ kind: 'Webhook', assignments: [] }))).toBe('A duplicate is a second Plugin with the same template, Merge Strategy, Plugin Fields and Field Values, on no Device, with its own Webhook URL. An export is a .zip with the template and the Plugin Fields, without Field Values. Deleting removes Weather from this Instance.')
  })
})
