import type { UpdateDeviceInput } from 'kuroshiro-shared'
import type { Ref } from 'vue'
import { computed, reactive, ref, shallowRef, toRef, watch } from 'vue'
import { updateDevice } from '@/api/devices'
import { useSaveAsChanged } from '@/components/useSaveAsChanged'
import { useDevices } from '@/reads/sharedReads'
import { useDeviceFrame } from './deviceFrame'

/**
 * A write to the Device of the frame, with the state of save as changed for the row that made it.
 * `send` writes only the fields it is given; once the server has them the Device is read again, so every
 * row follows, and the Devices too after a rename, for the bar.
 */
export function useDeviceWrite() {
  const { device } = useDeviceFrame()
  const devices = useDevices()
  const input = shallowRef<UpdateDeviceInput>({})

  const save = useSaveAsChanged(async (sent: UpdateDeviceInput) => {
    if (!device.data)
      throw new Error('The Device has not loaded.')
    await updateDevice(device.data.id, sent)
    await Promise.all([device.reload(), 'name' in sent ? devices.reload() : undefined])
  }, input)

  return reactive({
    status: toRef(save, 'status'),
    reason: toRef(save, 'reason'),
    retry: save.retry,
    /** A save is under way or has failed: what was entered is not replaced by what the server has. */
    unsettled: computed(() => save.status === 'saving' || save.status === 'failed'),
    send(next: UpdateDeviceInput) {
      input.value = next
      save.commit()
    },
  })
}

/**
 * One setting of the Device as its row edits it. `entered` is what the control holds: it follows `saved`,
 * the value on the Device, except while a save of it is under way or has failed. `commit` sends what `toInput`
 * makes of it, and nothing when that is `undefined`: a value that did not change, or one that is not valid.
 * A control whose server form may differ from what was typed (a trimmed name) puts that form into `entered` before it commits.
 */
export function useDeviceSetting<T>(saved: () => T, toInput: (entered: T) => UpdateDeviceInput | undefined) {
  const write = useDeviceWrite()
  const entered = ref(saved()) as Ref<T>

  // Compared as written out, so a value that is an object follows only when it differs, not whenever the Device was read again.
  watch(() => JSON.stringify(saved()), () => {
    if (!write.unsettled)
      entered.value = saved()
  })

  function commit() {
    const input = toInput(entered.value)
    if (input)
      write.send(input)
  }

  return reactive({
    entered,
    status: toRef(write, 'status'),
    reason: toRef(write, 'reason'),
    saving: computed(() => write.status === 'saving'),
    retry: write.retry,
    commit,
    /** For a control that saves on change (a select, a switch, a radio row): holds the chosen value and commits it. */
    choose(chosen: T) {
      entered.value = chosen
      commit()
    },
  })
}
