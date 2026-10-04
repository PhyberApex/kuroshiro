import { describe, expect, it } from 'vitest'
import { buildPluginPlace, buildPluginSummary } from '@/testing/fixtures/plugins'
import { countLine, hasProblem, kindAndOrigin, matchingPlugins, noMatchSentence, pluginRowState, whereItShows } from '../pluginRows'

const device = (name: string) => ({ id: name.toLowerCase(), name })

describe('a row of the Plugins list', () => {
  it('names the Plugin Kind, and says when the Plugin came from a Recipe', () => {
    expect(kindAndOrigin(buildPluginSummary())).toBe('Poll Plugin')
    expect(kindAndOrigin(buildPluginSummary({ kind: 'Webhook', webhookPayloadStored: true }))).toBe('Webhook Plugin')
    expect(kindAndOrigin(buildPluginSummary({ sourceRecipeId: '41120' }))).toBe('Poll Plugin · from a Recipe')
  })

  it('names up to two Devices and counts them from three', () => {
    expect(whereItShows(buildPluginSummary({ devices: [device('Kitchen')] }))).toBe('On Kitchen')
    expect(whereItShows(buildPluginSummary({ devices: [device('Kitchen'), device('Hallway')] }))).toBe('On Kitchen and Hallway')
    expect(whereItShows(buildPluginSummary({ devices: [device('Kitchen'), device('Hallway'), device('Study')] }))).toBe('On 3 Devices')
  })

  it('names the Device of a Mashup only for a Plugin on no Device', () => {
    const mashups = [buildPluginPlace({ deviceName: 'Study' })]

    expect(whereItShows(buildPluginSummary({ devices: [], mashups }))).toBe('In a Mashup on Study')
    expect(whereItShows(buildPluginSummary({ devices: [device('Kitchen')], mashups }))).toBe('On Kitchen')
    expect(whereItShows(buildPluginSummary({ devices: [] }))).toBe('Not on a Device')
  })

  it('has no state when nothing is wrong', () => {
    expect(pluginRowState(buildPluginSummary())).toBeUndefined()
    expect(pluginRowState(buildPluginSummary({ kind: 'Webhook', webhookPayloadStored: true }))).toBeUndefined()
  })

  it('reads the first state that applies: the Alert, the Fetch Failure Streak, the empty Plugin Field, the empty Webhook Payload', () => {
    const everything = { fetchAlertFiring: true, worstFetchFailureStreak: 4, needsValues: true, webhookPayloadStored: false }

    expect(pluginRowState(buildPluginSummary(everything))).toEqual({ kind: 'alert', text: 'Alert: a Data Source keeps failing' })
    expect(pluginRowState(buildPluginSummary({ ...everything, fetchAlertFiring: false }))).toEqual({ kind: 'problem', text: '4 fetches failed in a row' })
    expect(pluginRowState(buildPluginSummary({ ...everything, fetchAlertFiring: false, worstFetchFailureStreak: 1 }))).toEqual({ kind: 'problem', text: 'The last fetch failed' })
    expect(pluginRowState(buildPluginSummary({ ...everything, fetchAlertFiring: false, worstFetchFailureStreak: 0 }))).toEqual({ kind: 'problem', text: 'A required Plugin Field is empty' })
    expect(pluginRowState(buildPluginSummary({ webhookPayloadStored: false }))).toEqual({ kind: 'note', text: 'Nothing received yet' })
  })

  it('counts the first four states as a problem, and "Nothing received yet" not', () => {
    expect(hasProblem(buildPluginSummary({ fetchAlertFiring: true }))).toBe(true)
    expect(hasProblem(buildPluginSummary({ worstFetchFailureStreak: 1 }))).toBe(true)
    expect(hasProblem(buildPluginSummary({ worstFetchFailureStreak: 2 }))).toBe(true)
    expect(hasProblem(buildPluginSummary({ needsValues: true }))).toBe(true)
    expect(hasProblem(buildPluginSummary({ kind: 'Webhook', webhookPayloadStored: false }))).toBe(false)
    expect(hasProblem(buildPluginSummary())).toBe(false)
  })
})

describe('finding Plugins in the list', () => {
  const plugins = [
    buildPluginSummary({ id: 'bins', name: 'Bin day', worstFetchFailureStreak: 1 }),
    buildPluginSummary({ id: 'moon', name: 'Moon phase' }),
    buildPluginSummary({ id: 'pollen', name: 'Pollen count', needsValues: true }),
  ]
  const ids = (found: typeof plugins) => found.map(plugin => plugin.id)

  it('searches the name whatever its case, and keeps the order', () => {
    expect(ids(matchingPlugins(plugins, { query: 'O', problemsOnly: false }))).toEqual(['moon', 'pollen'])
    expect(ids(matchingPlugins(plugins, { query: '  day ', problemsOnly: false }))).toEqual(['bins'])
    expect(ids(matchingPlugins(plugins, { query: '', problemsOnly: false }))).toEqual(['bins', 'moon', 'pollen'])
  })

  it('keeps only those with a problem when asked, together with the search', () => {
    expect(ids(matchingPlugins(plugins, { query: '', problemsOnly: true }))).toEqual(['bins', 'pollen'])
    expect(ids(matchingPlugins(plugins, { query: 'o', problemsOnly: true }))).toEqual(['pollen'])
  })

  it('counts every Plugin, and those with a problem when there are any', () => {
    expect(countLine({ total: 10, shown: 10, withProblem: 3, query: '', problemsOnly: false })).toBe('10 Plugins, by name · 3 with a problem')
    expect(countLine({ total: 4, shown: 4, withProblem: 0, query: '', problemsOnly: false })).toBe('4 Plugins, by name')
    expect(countLine({ total: 1, shown: 1, withProblem: 0, query: '', problemsOnly: false })).toBe('1 Plugin, by name')
  })

  it('counts what is shown of all once a search or the filter is on', () => {
    expect(countLine({ total: 10, shown: 2, withProblem: 3, query: 'o', problemsOnly: false })).toBe('2 of 10 Plugins · 3 with a problem')
    expect(countLine({ total: 10, shown: 3, withProblem: 3, query: '', problemsOnly: true })).toBe('3 of 10 Plugins')
  })

  it('says what nothing matches, each half only when it applies', () => {
    expect(noMatchSentence({ query: 'tide', problemsOnly: false })).toBe('No Plugin is called “tide”.')
    expect(noMatchSentence({ query: 'tide', problemsOnly: true })).toBe('No Plugin is called “tide” among those with a problem.')
    expect(noMatchSentence({ query: '', problemsOnly: true })).toBe('No Plugin has a problem.')
  })
})
