import type { MashupLayout, MashupSlotRead, RenderSignal, ScheduleRead, ScreenRead, TemplateSize } from 'kuroshiro-shared'
import type { MashupConfiguration } from '../mashup/entities/mashup-configuration.entity.js'
import type { ScreenStateRead } from '../schedule/rotation.js'
import type { Schedule } from '../schedule/schedule.entity.js'
import type { Screen } from './screens.entity.js'
import { MASHUP_LAYOUTS } from 'kuroshiro-shared'
import { toImagePath, toIsoString } from '../utils/readModel.js'

export interface ScreenFacts {
  deviceId: string
  state: ScreenStateRead
  renderSignal: RenderSignal | null
  /** Whether the Screen's rendered image is on disk. */
  isRendered: boolean
  requiredFieldEmpty: boolean
  fetchAlertFiring: boolean
}

const STORED_SIZE_PREFIX = 'view--'
const CLOCK_TIME_LENGTH = 'HH:MM'.length

function toClockTimeOrNull(time: string | null | undefined): string | null {
  return time ? time.slice(0, CLOCK_TIME_LENGTH) : null
}

function toScheduleRead(schedule: Schedule): ScheduleRead {
  return {
    id: schedule.id,
    enabled: schedule.enabled,
    weekdays: schedule.weekdays ?? null,
    startTime: toClockTimeOrNull(schedule.startTime),
    endTime: toClockTimeOrNull(schedule.endTime),
    startDate: schedule.startDate ?? null,
    endDate: schedule.endDate ?? null,
  }
}

function toMashupLayoutOrNull(stored: string): MashupLayout | null {
  return MASHUP_LAYOUTS.find(layout => layout.id === stored)?.id ?? null
}

function toMashupRead(configuration: MashupConfiguration | undefined): ScreenRead['mashup'] {
  const layout = configuration && toMashupLayoutOrNull(configuration.layout)
  if (!configuration || !layout)
    return null
  const slots: MashupSlotRead[] = [...configuration.slots ?? []]
    .sort((a, b) => a.order - b.order)
    .map(slot => ({
      position: slot.position,
      size: slot.size.replace(STORED_SIZE_PREFIX, '') as TemplateSize,
      pluginId: slot.plugin.id,
      pluginName: slot.plugin.name,
    }))
  return { layout, slots }
}

function toPluginReference(screen: Screen, facts: ScreenFacts): ScreenRead['plugin'] {
  const { plugin } = screen
  return plugin
    ? { id: plugin.id, name: plugin.name, kind: plugin.kind, requiredFieldEmpty: facts.requiredFieldEmpty, fetchAlertFiring: facts.fetchAlertFiring }
    : null
}

function toFileRead(screen: Screen): ScreenRead['file'] {
  return {
    originalName: screen.fileOriginalName ?? null,
    width: screen.fileWidth ?? null,
    height: screen.fileHeight ?? null,
    bytes: screen.fileBytes ?? null,
    uploadedAt: toIsoString(screen.generatedAt),
  }
}

export function toScreenRead(screen: Screen, facts: ScreenFacts): ScreenRead {
  const kind = screen.type
  return {
    id: screen.id,
    deviceId: facts.deviceId,
    kind,
    name: (kind === 'plugin' ? screen.plugin?.name : screen.filename) ?? '',
    order: screen.order,
    state: facts.state.state,
    stateCause: facts.state.stateCause,
    renderSignal: facts.renderSignal,
    imagePath: facts.isRendered ? toImagePath(`/screens/devices/${facts.deviceId}/${screen.id}.png`, screen.generatedAt) : null,
    renderedAt: facts.isRendered ? toIsoString(screen.generatedAt) : null,
    schedule: screen.schedule ? toScheduleRead(screen.schedule) : null,
    plugin: kind === 'plugin' ? toPluginReference(screen, facts) : null,
    mashup: kind === 'mashup' ? toMashupRead(screen.mashupConfiguration) : null,
    external: kind === 'external' ? { url: screen.externalLink ?? '', fetchManual: screen.fetchManual } : null,
    file: kind === 'file' ? toFileRead(screen) : null,
    html: kind === 'html' ? screen.html ?? '' : null,
  }
}
