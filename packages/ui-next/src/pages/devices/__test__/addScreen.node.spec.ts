import { describe, expect, it } from 'vitest'
import { buildPluginSummary } from '@/testing/fixtures/plugins'
import { nameFromFile, offeredKinds, pluginChoices, pluginsCalled, preselected } from '../addScreen'
import { screenNameProblem } from '../screenNaming'

const KITCHEN = { id: 'kitchen', name: 'Kitchen' }

const KINDS = [
  { kind: 'plugin' as const, label: 'Plugin', hint: 'One of your Plugins, rendered for this Device' },
  { kind: 'file' as const, label: 'File', hint: 'An image you upload' },
]

describe('the kinds Add Screen offers', () => {
  it('offers every kind with its line', () => {
    expect(offeredKinds(KINDS, false)).toEqual([
      { value: 'plugin', label: 'Plugin', hint: 'One of your Plugins, rendered for this Device', disabled: false },
      { value: 'file', label: 'File', hint: 'An image you upload', disabled: false },
    ])
  })

  it('disables the File kind in demo mode and says why', () => {
    expect(offeredKinds(KINDS, true)[1]).toEqual({ value: 'file', label: 'File', hint: 'Not available in the demo.', disabled: true })
  })
})

describe('a Plugin as a choice of Add Screen', () => {
  it('reads its Plugin Kind', () => {
    const plugins = [buildPluginSummary({ id: 'weather', name: 'Weather', kind: 'Poll', devices: [] }), buildPluginSummary({ id: 'doorbell', name: 'Doorbell', kind: 'Webhook', devices: [] })]

    expect(pluginChoices(plugins, KITCHEN)).toEqual([
      { value: 'weather', label: 'Weather', hint: 'Poll Plugin', disabled: false },
      { value: 'doorbell', label: 'Doorbell', hint: 'Webhook Plugin', disabled: false },
    ])
  })

  it('is disabled when it is already on the Device, and not when it is on another', () => {
    const plugins = [
      buildPluginSummary({ id: 'weather', name: 'Weather', devices: [{ id: 'hallway', name: 'Hallway' }, KITCHEN] }),
      buildPluginSummary({ id: 'calendar', name: 'Calendar', devices: [{ id: 'hallway', name: 'Hallway' }] }),
    ]

    expect(pluginChoices(plugins, KITCHEN)).toEqual([
      { value: 'weather', label: 'Weather', hint: 'Already on Kitchen', disabled: true },
      { value: 'calendar', label: 'Calendar', hint: 'Poll Plugin', disabled: false },
    ])
  })

  it('notes an empty required Plugin Field and can still be chosen', () => {
    const [choice] = pluginChoices([buildPluginSummary({ id: 'trains', name: 'Trains', devices: [], needsValues: true })], KITCHEN)

    expect(choice).toEqual({ value: 'trains', label: 'Trains', hint: 'Poll Plugin · a required Plugin Field is empty', disabled: false })
  })
})

describe('finding a Plugin', () => {
  const plugins = [buildPluginSummary({ name: 'Weather' }), buildPluginSummary({ name: 'Bin day' })]

  it.each([
    ['', ['Weather', 'Bin day']],
    ['  ', ['Weather', 'Bin day']],
    ['WEA', ['Weather']],
    [' day ', ['Bin day']],
    ['tides', []],
  ])('“%s” finds %j', (query, names) => {
    expect(pluginsCalled(plugins, query).map(plugin => plugin.name)).toEqual(names)
  })
})

describe('the Plugin chosen before the admin chooses', () => {
  const choices = [
    { value: 'weather', label: 'Weather', disabled: true },
    { value: 'calendar', label: 'Calendar', disabled: false },
    { value: 'trains', label: 'Trains', disabled: false },
  ]

  it('is the first one that is not on the Device yet', () => {
    expect(preselected(choices, undefined)).toBe('calendar')
  })

  it('is the one the admin picked, while it is still offered', () => {
    expect(preselected(choices, 'trains')).toBe('trains')
    expect(preselected(choices.slice(0, 2), 'trains')).toBe('calendar')
  })

  it('is none when every Plugin is on the Device', () => {
    expect(preselected(choices.slice(0, 1), undefined)).toBeUndefined()
  })
})

describe('a Screen\'s name', () => {
  it.each([
    ['harbour.png', 'harbour'],
    ['Alps in March.final.JPEG', 'Alps in March.final'],
    ['.hidden', '.hidden'],
    ['scan', 'scan'],
  ])('of the file %s is %s', (fileName, name) => {
    expect(nameFromFile(fileName)).toBe(name)
  })

  it('is required', () => {
    expect(screenNameProblem('  ')).toBe('A Screen needs a name.')
    expect(screenNameProblem('Tide table')).toBeUndefined()
  })
})
