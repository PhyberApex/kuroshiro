import type { DeviceDetail, DeviceSummary } from 'kuroshiro-shared'
import type { ComputedRef, InjectionKey } from 'vue'
import type { Report } from './simulatorWording'
import type { DeviceCall, DisplayAnswer } from '@/api/deviceCalls'
import { computed, inject, provide, reactive, ref, watch } from 'vue'
import { callSetup, pollDisplay } from '@/api/deviceCalls'
import { getDevice } from '@/api/devices'
import { listScreens } from '@/api/screens'
import { failureReason } from '@/components/failureReason'
import { useLoad } from '@/patterns/useLoad'
import { useDevices } from '@/reads/sharedReads'
import { NEW_DEVICE_REPORT, reportHeaders, reportOf, sensorsHeader, showsOf } from './simulatorWording'

/** The entry of "Poll as" that is no Device. */
export const NOT_REGISTERED = 'not-registered'

type Call = 'poll' | 'setup'

export type SimulatorOutcome
  = | { kind: 'none' }
    | { kind: 'registered', friendlyId: string }
    /** Setup answered a Device that was registered already: the chosen one, or the one the MAC address entered belongs to. */
    | { kind: 'known', deviceName: string, chosen: boolean }
    | { kind: 'polled', answer: DisplayAnswer, shows: string, firmwareVersion: string | null }
    | { kind: 'refused', call: Call, reason: string }
    | { kind: 'unanswered', call: Call, reason: string }

/** What setup answered a Device that is not registered, which its poll is made with. */
interface SetUpDevice {
  mac: string
  apiKey: string
  friendlyId: string
}

/** The Device to poll as: the one the address names, otherwise the first by name, otherwise one that is not registered. */
export function firstChoice(devices: DeviceSummary[], named: unknown) {
  return devices.find(device => device.id === named)?.id ?? devices[0]?.id ?? NOT_REGISTERED
}

/**
 * The Device Simulator's state: which Device it plays, what that Device reports, and what the last
 * call came back with. A poll or setup is made with the Device's own MAC address and API key, read
 * from the Device just before the call, and the Devices are read again after it.
 */
function useDeviceSimulator(initialChoice: string) {
  const devices = useDevices()
  const choice = ref(initialChoice)
  const registered = computed(() => choice.value === NOT_REGISTERED ? undefined : choice.value)
  const detail = useLoad(() => registered.value ? getDevice(registered.value) : Promise.resolve(undefined), { key: () => registered.value, fresh: true })
  const device: ComputedRef<DeviceDetail | undefined> = computed(() => detail.data?.id === registered.value ? detail.data : undefined)
  const listed = computed(() => devices.data?.find(each => each.id === registered.value))

  const mac = ref('')
  const setUp = ref<SetUpDevice>()
  const report = ref<Report>({ ...NEW_DEVICE_REPORT })
  const outcome = ref<SimulatorOutcome>({ kind: 'none' })
  const calling = ref<Call>()

  watch(choice, () => {
    outcome.value = { kind: 'none' }
    if (!registered.value)
      report.value = { ...NEW_DEVICE_REPORT }
  })
  watch(() => device.value?.id, (id) => {
    if (id)
      report.value = reportOf(device.value!)
  }, { immediate: true })

  const canPoll = computed(() => registered.value ? Boolean(device.value) : setUp.value?.mac === mac.value.trim())

  async function settled<T>(call: Call, made: () => Promise<DeviceCall<T>>, then: (answer: T) => Promise<SimulatorOutcome>) {
    calling.value = call
    try {
      const came = await made()
      outcome.value = 'refused' in came ? { kind: 'refused', call, reason: came.refused } : await then(came.answered)
    }
    catch (error) {
      outcome.value = { kind: 'unanswered', call, reason: failureReason(error) ?? 'Something went wrong.' }
    }
    finally {
      calling.value = undefined
    }
  }

  async function whatItShows(deviceId: string | undefined) {
    if (!deviceId)
      return 'A Device that is no longer registered'
    const [after, screens] = await Promise.all([getDevice(deviceId), listScreens(deviceId)])
    return showsOf(after, screens)
  }

  async function polled(answer: DisplayAnswer, deviceId: string | undefined, firmwareVersion: string | null): Promise<SimulatorOutcome> {
    const shows = await whatItShows(deviceId)
    void detail.reload()
    void devices.reload()
    return { kind: 'polled', answer, shows, firmwareVersion }
  }

  async function poll() {
    const headers = reportHeaders(report.value)
    if (registered.value) {
      const deviceId = registered.value
      await settled('poll', async () => {
        const playing = await getDevice(deviceId)
        const sensors = sensorsHeader(playing.sensors)
        return pollDisplay({ ...headers, ...sensors ? { Sensors: sensors } : {}, 'ID': playing.mac, 'Access-Token': playing.apikey })
      }, answer => polled(answer, deviceId, device.value?.targetFirmware?.version ?? null))
      return
    }
    const playing = setUp.value!
    await settled('poll', () => pollDisplay({ ...headers, 'ID': playing.mac, 'Access-Token': playing.apiKey }), async (answer) => {
      await devices.reload()
      return polled(answer, devices.data?.find(each => each.friendlyId === playing.friendlyId)?.id, null)
    })
  }

  async function setupAsDevice(deviceId: string) {
    await settled('setup', async () => callSetup({ ID: (await getDevice(deviceId)).mac }), async () => {
      void devices.reload()
      return { kind: 'known', deviceName: listed.value?.name ?? 'the Device', chosen: true }
    })
  }

  async function setupNew() {
    const entered = mac.value.trim()
    const known = new Map(devices.data?.map(each => [each.friendlyId, each.name]))
    const { firmwareVersion, model } = report.value
    const identity = Object.fromEntries([['FW-Version', firmwareVersion.trim()], ['Model', model.trim()]].filter(([, value]) => value !== ''))
    await settled('setup', () => callSetup({ ...identity, ID: entered }), async (answer) => {
      setUp.value = { mac: entered, apiKey: answer.api_key, friendlyId: answer.friendly_id }
      void devices.reload()
      const name = known.get(answer.friendly_id)
      return name === undefined
        ? { kind: 'registered', friendlyId: answer.friendly_id }
        : { kind: 'known', deviceName: name, chosen: false }
    })
  }

  function setup() {
    return registered.value ? setupAsDevice(registered.value) : setupNew()
  }

  return reactive({ choice, registered, device, detail, listed, mac, report, outcome, calling, canPoll, poll, setup })
}

type DeviceSimulator = ReturnType<typeof useDeviceSimulator>

const simulatorKey: InjectionKey<DeviceSimulator> = Symbol('device simulator')

/** Starts the simulator for the page and hands it to the parts of the page under it. */
export function provideDeviceSimulator(initialChoice: string) {
  const simulator = useDeviceSimulator(initialChoice)
  provide(simulatorKey, simulator)
  return simulator
}

/** The simulator of the page a part stands in. */
export function useSimulator() {
  const simulator = inject(simulatorKey)
  if (!simulator)
    throw new Error('A part of the Device Simulator stands outside SimulatorBench, which provides the simulator.')
  return simulator
}
