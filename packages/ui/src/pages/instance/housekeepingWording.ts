import type { CleanupResult, MissingImageFinding, RetentionAges, RetentionRunResult, StorageCheck, StorageFinding, StorageFindingGroup } from 'kuroshiro-shared'
import { formatBytes } from '@/components/fileRules'
import { SCREEN_KIND_LABELS } from '@/components/screenRows'
import { screenName } from '@/pages/devices/screenNaming'
import { listed } from '@/patterns/listed'
import { deviceLogEntriesNote, resolvedAlertsNote } from './instanceSettingWording'

type Noun = readonly [one: string, several: string]

const FILE: Noun = ['file', 'files']
const FOLDER: Noun = ['folder', 'folders']
const SCREEN: Noun = ['Screen', 'Screens']
const DAY: Noun = ['day', 'days']
const RESOLVED_ALERT: Noun = ['resolved Alert', 'resolved Alerts']
const DEVICE_LOG_ENTRY: Noun = ['Device Log entry', 'Device Log entries']

const NUMBER = new Intl.NumberFormat('en-GB')

const counted = (count: number, [one, several]: Noun) => `${NUMBER.format(count)} ${count === 1 ? one : several}`

/** The groups in the order the page lists them, each with its name and what it counts. */
const GROUPS: { group: StorageFindingGroup, name: string, noun: Noun }[] = [
  { group: 'unusedImage', name: 'Images no Screen uses', noun: FILE },
  { group: 'deletedDeviceFolder', name: 'Folders of deleted Devices', noun: FOLDER },
  { group: 'tempFile', name: 'Temporary files older than a day', noun: FILE },
  { group: 'oldUpload', name: 'Old uploads', noun: FILE },
  { group: 'oldFallbackRender', name: 'Stale Fallback Screen renders', noun: FILE },
  { group: 'missingImage', name: 'Screens whose image is missing', noun: SCREEN },
]

export interface FindingGroup {
  group: StorageFindingGroup
  name: string
  findings: StorageFinding[]
  /** "6 files", "1 folder", "1 Screen". */
  count: string
  /** What the group takes on disk. Screens take nothing: their image is gone. */
  size: string | undefined
}

const isScreen = (finding: StorageFinding): finding is MissingImageFinding => finding.group === 'missingImage'

const bytesOf = (findings: StorageFinding[]) => findings.reduce((sum, finding) => sum + (isScreen(finding) ? 0 : finding.bytes), 0)

/** The findings by group, in the page's order. A group without a finding is left out. */
export function findingGroups(findings: StorageFinding[]): FindingGroup[] {
  return GROUPS.flatMap(({ group, name, noun }) => {
    const held = findings.filter(finding => finding.group === group)
    return held.length === 0
      ? []
      : [{ group, name, findings: held, count: counted(held.length, noun), size: group === 'missingImage' ? undefined : formatBytes(bytesOf(held)) }]
  })
}

export function screenImagesSentence({ files, bytes }: StorageCheck['screenImages']) {
  return files === 0 ? 'No Screen image is stored yet.' : `Screen images take ${formatBytes(bytes)} in ${counted(files, FILE)}.`
}

const screenOnDevice = ({ screen }: MissingImageFinding) => `The Screen “${screenName(screen.name)}” on ${screen.deviceName}`

function screensSentence(screens: MissingImageFinding[]) {
  const [only] = screens
  return screens.length === 1 && only
    ? `${screenOnDevice(only)} and its Schedule. Its image is already gone, so ${only.screen.deviceName} shows the error Fallback Screen at its turn today.`
    : `${counted(screens.length, SCREEN)} and their Schedules. Their images are already gone, so their Devices show the error Fallback Screen at their turn today.`
}

/** What an opened group holds, as the sentence above its list. */
export function openedSentence({ group, findings }: FindingGroup) {
  const one = findings.length === 1
  const count = NUMBER.format(findings.length)
  switch (group) {
    case 'unusedImage':
      return one ? '1 image file left behind by a Screen that was deleted or replaced.' : `${count} image files left behind by Screens that were deleted or replaced.`
    case 'deletedDeviceFolder':
      return one ? 'The image folder of a Device that is no longer registered.' : `The image folders of ${count} Devices that are no longer registered.`
    case 'tempFile':
      return one ? '1 leftover of a render that did not finish.' : `${count} leftovers of renders that did not finish.`
    case 'oldUpload':
      return one ? '1 file an earlier version of Kuroshiro left in the uploads folder. Nothing reads it.' : `${count} files an earlier version of Kuroshiro left in the uploads folder. Nothing reads them.`
    case 'oldFallbackRender':
      return one ? 'Fallback Screen drawn for an older look, or for a Device Model and Palette no Device uses.' : `${count} Fallback Screens drawn for an older look, or for a Device Model and Palette no Device uses.`
    case 'missingImage':
      return screensSentence(findings.filter(isScreen))
  }
}

const withArticle = (word: string) => `${/^[aeiou]/i.test(word) ? 'an' : 'a'} ${word}`

/** One line of an opened group: a path below the storage folder in mono with its size, or a Screen with its kind, its Device and its Order. */
export function findingLine(finding: StorageFinding): { what: string, detail: string, path: boolean } {
  switch (finding.group) {
    case 'missingImage': {
      const { name, kind, deviceName, order } = finding.screen
      return { what: `${screenName(name)}, ${withArticle(SCREEN_KIND_LABELS[kind])} Screen on ${deviceName}`, detail: `Order ${order}`, path: false }
    }
    case 'deletedDeviceFolder':
      return { what: finding.path, detail: `${formatBytes(finding.bytes)} · ${counted(finding.files, FILE)}`, path: true }
    default:
      return { what: finding.path, detail: formatBytes(finding.bytes), path: true }
  }
}

const screensOf = (groups: FindingGroup[]) => groups.flatMap(group => group.findings.filter(isScreen))

/** The line under the rows, about the one group whose clean-up deletes Screens. An Instance without such a Screen has no line. */
export function screensLine(groups: FindingGroup[], ticked: StorageFindingGroup[]) {
  const screens = screensOf(groups)
  if (screens.length === 0)
    return ''
  return ticked.includes('missingImage')
    ? `Cleaning up deletes ${counted(screens.length, SCREEN)}.`
    : 'A Screen whose image is missing is left alone unless you tick it.'
}

export const cleanUpLabel = (groups: number) => `Clean up ${groups} ${groups === 1 ? 'group' : 'groups'}`

/** What a clean-up of these groups loses, one sentence per group of files and one per Screen. */
export function lostLines(ticked: FindingGroup[]) {
  return ticked.flatMap(group => group.group === 'missingImage'
    ? group.findings.filter(isScreen).map(screen => `${screenOnDevice(screen)} and its Schedule.`)
    : [`${group.name}: ${group.count}, ${group.size}.`])
}

/** What a clean-up leaves, the Screens whose image is missing among it while their group is not ticked. */
export function staysLines(groups: FindingGroup[], ticked: StorageFindingGroup[]) {
  const leftAlone = ticked.includes('missingImage') ? [] : screensOf(groups)
  return [
    'Every Screen that has its image, and every Device.',
    ...leftAlone.map(({ screen }) => `The Screen “${screenName(screen.name)}”, at whose turn ${screen.deviceName} shows the error Fallback Screen.`),
  ]
}

/** What a clean-up removed, or nothing when it removed nothing. */
export function cleanedSentence({ files, folders, screens, bytes }: CleanupResult['removed']) {
  const removed = [[files, FILE], [folders, FOLDER], [screens, SCREEN]] as const
  const parts = removed.filter(([count]) => count > 0).map(([count, noun]) => counted(count, noun))
  if (parts.length === 0)
    return undefined
  return `Removed ${listed(parts)}${bytes > 0 ? `, ${formatBytes(bytes)}` : ''}.`
}

function whatItIs(finding: StorageFinding | undefined) {
  if (!finding)
    return undefined
  return isScreen(finding) ? screenOnDevice(finding) : finding.path
}

/** The notice about what the server could not remove: each by its path or its Screen, as the check that was cleaned up listed it. */
export function notRemoved(failed: CleanupResult['failed'], findings: StorageFinding[]) {
  if (failed.length === 0)
    return undefined
  const reasons = failed.map(({ findingId, reason }) => {
    const what = whatItIs(findings.find(finding => finding.id === findingId))
    return what ? `${what}: ${reason}` : reason
  })
  return { title: `${NUMBER.format(failed.length)} could not be removed.`, reasons }
}

function olderThan(noun: Noun, count: number | undefined, days: number) {
  return `${count === undefined ? noun[1] : counted(count, noun)} older than ${counted(days, DAY)}`
}

export const retentionIsOff = (ages: RetentionAges) => ages.alertRetentionDays === 0 && ages.deviceLogRetentionDays === 0

export function retentionSentence(ages: RetentionAges) {
  if (retentionIsOff(ages))
    return 'Retention is off: both ages are 0.'
  const deleted = [
    ...(ages.alertRetentionDays > 0 ? [olderThan(RESOLVED_ALERT, undefined, ages.alertRetentionDays)] : []),
    ...(ages.deviceLogRetentionDays > 0 ? [olderThan(DEVICE_LOG_ENTRY, undefined, ages.deviceLogRetentionDays)] : []),
  ]
  const kept = [
    ...(ages.alertRetentionDays === 0 ? [resolvedAlertsNote(0)] : []),
    ...(ages.deviceLogRetentionDays === 0 ? [deviceLogEntriesNote(0)] : []),
  ]
  return [`Every day at 04:00, server time, Retention deletes ${listed(deleted)}.`, ...kept].join(' ')
}

/** What a Retention Run removed, for a sentence that says which run. */
export function prunedCounts({ alertsPruned, deviceLogsPruned }: RetentionRunResult) {
  return `${counted(alertsPruned, RESOLVED_ALERT)} and ${counted(deviceLogsPruned, DEVICE_LOG_ENTRY)}`
}

export const nothingOldEnough = ({ alertsPruned, deviceLogsPruned }: RetentionRunResult) => alertsPruned + deviceLogsPruned === 0

/** What a Retention Run would lose, from what a dry run counted. A half whose age is 0 is not part of a run and is not named. */
export function retentionLost(ages: RetentionAges, { alertsPruned, deviceLogsPruned }: RetentionRunResult) {
  const halves = [
    { on: ages.alertRetentionDays > 0, count: alertsPruned, days: ages.alertRetentionDays, noun: RESOLVED_ALERT, none: 'No resolved Alert is old enough.' },
    { on: ages.deviceLogRetentionDays > 0, count: deviceLogsPruned, days: ages.deviceLogRetentionDays, noun: DEVICE_LOG_ENTRY, none: 'No Device Log entry is old enough.' },
  ].filter(half => half.on)
  const lost = halves.filter(half => half.count > 0).map(half => olderThan(half.noun, half.count, half.days))
  return [`${listed(lost)}.`, ...halves.filter(half => half.count === 0).map(half => half.none)].join(' ')
}
