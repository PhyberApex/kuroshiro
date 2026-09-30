import { describe, expect, it } from 'vitest'
import { makePluginDataSource } from '../../../test/fixtures.js'
import { dataSourceFetchFailingRule } from '../data-source-fetch-failing.rule.js'

const NOW = new Date('2026-01-01T12:00:00.000Z')
const context = { now: NOW, lowBatteryPercent: 20, offlineMultiplier: 3, fetchFailureThreshold: 3 }

describe('dataSourceFetchFailingRule', () => {
  it('opens once the streak reaches the threshold', () => {
    const source = makePluginDataSource({ fetchFailureStreak: 3 })
    const evaluation = dataSourceFetchFailingRule.evaluate(source, context, false)
    expect(evaluation.skip).toBeFalsy()
    expect(evaluation.active).toBe(true)
    expect(evaluation.details).toEqual({ streak: 3, lastError: null })
  })

  it('does not open one short of the threshold', () => {
    const source = makePluginDataSource({ fetchFailureStreak: 2 })
    expect(dataSourceFetchFailingRule.evaluate(source, context, false).active).toBe(false)
  })

  it('keeps an active alert while the streak is nonzero, below the open threshold', () => {
    const source = makePluginDataSource({ fetchFailureStreak: 1 })
    expect(dataSourceFetchFailingRule.evaluate(source, context, true).active).toBe(true)
  })

  it('resolves an active alert only once the streak drops to zero', () => {
    const source = makePluginDataSource({ fetchFailureStreak: 0 })
    expect(dataSourceFetchFailingRule.evaluate(source, context, true).active).toBe(false)
  })

  it('is never active for a literal-mode source, even with a stale streak', () => {
    const source = makePluginDataSource({ mode: 'literal', fetchFailureStreak: 5 })
    expect(dataSourceFetchFailingRule.evaluate(source, context, false).active).toBe(false)
  })

  it('resolves a stale active alert once its source is switched to literal mode, without blanking its details', () => {
    const source = makePluginDataSource({ mode: 'literal', fetchFailureStreak: 0 })
    const evaluation = dataSourceFetchFailingRule.evaluate(source, context, true)
    expect(evaluation.active).toBe(false)
    expect(evaluation.details).toEqual({ streak: 0, lastError: null })
  })

  it('carries the streak and last error in details', () => {
    const source = makePluginDataSource({ fetchFailureStreak: 4, lastFetchError: 'HTTP error! status: 500' })
    expect(dataSourceFetchFailingRule.evaluate(source, context, false).details).toEqual({ streak: 4, lastError: 'HTTP error! status: 500' })
  })

  it('builds the opened and resolved notification content, naming the Plugin and Data Source but never the URL', () => {
    const source = makePluginDataSource({
      name: 'Weather API',
      url: 'https://api.example.com/weather?key=super-secret',
      plugin: { id: 'plugin-1', name: 'Weather Dashboard' } as never,
    })
    const details = { streak: 3, lastError: 'HTTP error! status: 500' }

    const opened = dataSourceFetchFailingRule.openedNotification(source, details)
    expect(opened).toEqual({
      title: 'Kuroshiro: Weather Dashboard / Weather API fetch failing',
      body: '3 consecutive failed scheduled fetches. Last error: HTTP error! status: 500.',
      type: 'failure',
    })
    expect(opened.title).not.toContain('example.com')
    expect(opened.body).not.toContain('example.com')

    const resolved = dataSourceFetchFailingRule.resolvedNotification(source, details)
    expect(resolved).toEqual({
      title: 'Kuroshiro: Weather Dashboard / Weather API fetch recovered',
      body: 'The last scheduled fetch for Weather Dashboard / Weather API succeeded.',
      type: 'success',
    })
    expect(resolved.title).not.toContain('example.com')
    expect(resolved.body).not.toContain('example.com')
  })

  it('subjectId reads the Data Source id', () => {
    const source = makePluginDataSource({ id: 'ds-42' })
    expect(dataSourceFetchFailingRule.subjectId(source)).toBe('ds-42')
  })

  it('toAlertSubject attaches the Data Source as the alert subject', () => {
    const source = makePluginDataSource({ id: 'ds-42' })
    expect(dataSourceFetchFailingRule.toAlertSubject(source)).toEqual({ dataSource: source })
  })

  it('subjectFromAlert reads the dataSource relation back, undefined when missing', () => {
    const source = makePluginDataSource({ id: 'ds-42' })
    expect(dataSourceFetchFailingRule.subjectFromAlert({ dataSource: source } as never)).toBe(source)
    expect(dataSourceFetchFailingRule.subjectFromAlert({ dataSource: null } as never)).toBeUndefined()
    expect(dataSourceFetchFailingRule.subjectFromAlert({} as never)).toBeUndefined()
  })

  it('subjects selects only the dataSources bucket', () => {
    const dataSources = [makePluginDataSource()]
    expect(dataSourceFetchFailingRule.subjects({ devices: [{} as never], dataSources })).toBe(dataSources)
  })
})
