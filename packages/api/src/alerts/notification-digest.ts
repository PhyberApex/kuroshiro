import type { AlertKind } from 'kuroshiro-shared'
import type { NotificationContent } from './rules/alert-rule.js'
import { ALERT_KIND_LABELS } from 'kuroshiro-shared'

/**
 * One Alert event still needing an announcement, carrying the owning Rule's
 * own per-subject wording (`notification`) rather than inventing new
 * per-entry copy — see ADR-0022's digest addendum.
 */
export interface DigestEntry {
  alertId: string
  kind: AlertKind
  phase: 'opened' | 'resolved'
  notification: NotificationContent
}

const SEVERITY_RANK: Record<NotificationContent['type'], number> = {
  failure: 2,
  warning: 1,
  success: 0,
}

function mostSevere(entries: DigestEntry[]): NotificationContent['type'] {
  return entries.reduce<NotificationContent['type']>(
    (worst, entry) => (SEVERITY_RANK[entry.notification.type] > SEVERITY_RANK[worst] ? entry.notification.type : worst),
    'success',
  )
}

/** Entries of one phase, headed by their Alert Rule's label and listing each entry's existing per-subject body line underneath. */
function groupedByKind(entries: DigestEntry[]): string {
  const byKind = new Map<AlertKind, DigestEntry[]>()
  for (const entry of entries)
    byKind.set(entry.kind, [...(byKind.get(entry.kind) ?? []), entry])

  return [...byKind.entries()]
    .map(([kind, group]) => `${ALERT_KIND_LABELS[kind]}:\n${group.map(entry => `- ${entry.notification.body}`).join('\n')}`)
    .join('\n\n')
}

/**
 * Builds the Sweep's single digest Notification out of every Alert event
 * still needing an announcement — `undefined` when there is nothing to
 * announce, so the caller sends zero Notifications. Opens are listed before
 * resolves; within each half, entries group by Alert Rule then by subject.
 */
export function buildDigest(entries: DigestEntry[]): NotificationContent | undefined {
  if (entries.length === 0)
    return undefined

  const opened = entries.filter(entry => entry.phase === 'opened')
  const resolved = entries.filter(entry => entry.phase === 'resolved')

  const sections = [
    opened.length > 0 ? `Opened:\n${groupedByKind(opened)}` : undefined,
    resolved.length > 0 ? `Resolved:\n${groupedByKind(resolved)}` : undefined,
  ].filter((section): section is string => section !== undefined)

  return {
    title: `Kuroshiro: ${opened.length} opened, ${resolved.length} resolved`,
    body: sections.join('\n\n'),
    type: mostSevere(entries),
  }
}
