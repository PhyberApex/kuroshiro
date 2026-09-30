import type { PluginDataSource } from '../../plugins/entities/plugin-data-source.entity.js'
import type { AlertRule } from './alert-rule.js'

export const dataSourceFetchFailingRule: AlertRule = {
  kind: 'data-source-fetch-failing',
  alertRelations: { dataSource: { plugin: true } },
  subjects: all => all.dataSources,
  subjectId: subject => (subject as PluginDataSource).id,
  subjectFromAlert: alert => alert.dataSource ?? undefined,
  toAlertSubject: subject => ({ dataSource: subject as PluginDataSource }),

  evaluate(subject, context, hasActiveAlert) {
    const source = subject as PluginDataSource
    // A literal-mode source never carries a streak (ADR-0025) — if it still
    // has an active Alert (e.g. it was switched from fetch mode), that Alert
    // resolves rather than being left dangling. Details are still populated
    // (streak 0) so resolving doesn't blank out the Alert's last-recorded
    // details with an empty object.
    if (source.mode === 'literal')
      return { active: false, details: { streak: 0, lastError: null } }

    const active = hasActiveAlert ? source.fetchFailureStreak > 0 : source.fetchFailureStreak >= context.fetchFailureThreshold
    return { active, details: { streak: source.fetchFailureStreak, lastError: source.lastFetchError ?? null } }
  },

  openedNotification(subject, details) {
    const source = subject as PluginDataSource
    return {
      title: `Kuroshiro: ${source.plugin.name} / ${source.name} fetch failing`,
      body: `${details.streak} consecutive failed scheduled fetches. Last error: ${details.lastError ?? 'unknown'}.`,
      type: 'failure',
    }
  },

  resolvedNotification(subject) {
    const source = subject as PluginDataSource
    return {
      title: `Kuroshiro: ${source.plugin.name} / ${source.name} fetch recovered`,
      body: `The last scheduled fetch for ${source.plugin.name} / ${source.name} succeeded.`,
      type: 'success',
    }
  },
}
