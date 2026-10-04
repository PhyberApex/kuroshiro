import type { DeviceLogPage, DeviceLogsQuery } from 'kuroshiro-shared'
import type { LogFilter } from './deviceLogWording'
import { DEVICE_LOG_PAGE_SIZE_MAX } from 'kuroshiro-shared'
import { computed, reactive, ref, shallowRef, watch } from 'vue'
import { listDeviceLogs } from '@/api/devices'
import { failureReason } from '@/components/failureReason'
import { useLoad } from '@/patterns/useLoad'
import { usePolling } from '@/patterns/usePolling'

/** The id of an entry's line in the page, which takes the focus when the entry is the first of an older page. */
export const entryLineId = (entryId: string) => `log-entry-${entryId}`

/** A page beyond the first that could not be loaded, as the notice words it. */
interface LogStumble {
  title: string
  reason?: string
}

function queryOf({ level, q }: LogFilter): DeviceLogsQuery {
  return {
    level: level === 'problems' ? level : undefined,
    q: q || undefined,
  }
}

/**
 * A Device Log as the Logs page shows it: the first page under a filter and a search, the
 * older pages appended to it, and the entries that arrived since, which are counted every
 * 30 seconds and only join the list when asked for.
 */
export function useDeviceLog(deviceId: () => string | undefined, filter: () => LogFilter) {
  const ask = (query: DeviceLogsQuery = {}) => listDeviceLogs(String(deviceId()), { ...queryOf(filter()), ...query })

  const first = useLoad(() => ask(), {
    key: () => deviceId() && [deviceId(), filter().level, filter().q].join('\n'),
  })
  const grown = shallowRef<DeviceLogPage>()
  const arrived = ref(0)
  const loadingOlder = ref(false)
  const loadingNew = ref(false)
  const stumble = ref<LogStumble>()

  const shown = computed(() => grown.value ?? first.data)

  // What is asked for under one first page is dropped once another has taken its place.
  let firstPages = 0
  watch(() => first.data, () => {
    firstPages += 1
    grown.value = undefined
    arrived.value = 0
    stumble.value = undefined
  }, { flush: 'sync' })

  async function loadMore<T>(title: string, busy: { value: boolean }, request: () => Promise<DeviceLogPage>, land: (page: DeviceLogPage) => T) {
    const askedUnder = firstPages
    busy.value = true
    stumble.value = undefined
    try {
      const page = await request()
      return askedUnder === firstPages ? await land(page) : undefined
    }
    catch (error) {
      if (askedUnder === firstPages)
        stumble.value = { title, reason: failureReason(error) }
      return undefined
    }
    finally {
      busy.value = false
    }
  }

  /** Appends the next page and answers the id of its first entry, which takes the focus. */
  function loadOlder() {
    const before = shown.value?.nextCursor
    if (!before)
      return Promise.resolve(undefined)
    return loadMore('Could not load older entries.', loadingOlder, () => ask({ before }), (older) => {
      const log = shown.value!
      grown.value = { ...log, entries: [...log.entries, ...older.entries], nextCursor: older.nextCursor }
      return older.entries[0]?.id
    })
  }

  /** Puts the entries that arrived since on top. More of them than one page holds start the list over. */
  function loadNew() {
    const after = shown.value?.newestCursor
    if (!after)
      return first.reload()
    return loadMore('Could not load the new entries.', loadingNew, () => ask({ after, limit: DEVICE_LOG_PAGE_SIZE_MAX }), (newer) => {
      if (newer.matching > newer.entries.length)
        return first.reload()
      const log = shown.value!
      grown.value = { ...log, entries: [...newer.entries, ...log.entries], total: newer.total, matching: log.matching + newer.matching, newestCursor: newer.newestCursor }
      arrived.value = 0
    })
  }

  let counting = false
  usePolling(() => {
    const log = shown.value
    if (!log || counting)
      return
    const askedUnder = firstPages
    counting = true
    void ask({ after: log.newestCursor ?? undefined, limit: 0 })
      .then((since) => {
        // New entries that joined the list meanwhile are no longer news.
        if (askedUnder !== firstPages || shown.value?.newestCursor !== log.newestCursor)
          return
        // An empty Device Log has nothing a new entry could push down.
        if (log.total === 0 && since.total > 0)
          void first.reload()
        else
          arrived.value = since.matching
      }, () => {})
      .finally(() => {
        counting = false
      })
  })

  return reactive({
    /** The load of the first page: its `waiting` and `failure` are the page's. */
    first,
    /** Everything loaded so far as one page, or nothing before the first answer. */
    shown,
    /** How many entries that match arrived since the list was loaded. */
    arrived,
    loadingOlder,
    loadingNew,
    stumble,
    loadOlder,
    loadNew,
    reload: () => first.reload(),
  })
}
