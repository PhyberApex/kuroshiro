<script setup lang="ts">
import type { InstanceSettingValue, SettingKey } from 'kuroshiro-shared'
import { SETTING_BOUNDS, SETTING_ENV_VARS } from 'kuroshiro-shared'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { updateInstanceSettings } from '@/api/instance'
import Button from '@/components/Button.vue'
import NumberInput from '@/components/NumberInput.vue'
import SettingRow from '@/components/SettingRow.vue'
import { useSaveAsChanged } from '@/components/useSaveAsChanged'
import { SETTING_RANGE_MESSAGES } from './instanceSettingWording'

const props = defineProps<{
  settingKey: SettingKey
  /** The Setting as the Instance Settings were loaded. The row follows its own saves from there. */
  setting: InstanceSettingValue
  label: string
  /** The words of the sentence the field stands in: "below" before it and "%" after it. */
  before: string
  after: string
}>()

defineSlots<{
  /** What the value does, in a sentence that uses the value in force. */
  note: (props: { value: number }) => unknown
}>()

const bounds = SETTING_BOUNDS[props.settingKey]
const field = useTemplateRef('field')

const inForce = ref(props.setting)
const entered = ref<number | null>(props.setting.value)
/** What the next save sends: a number overrides, `null` clears the override. */
const override = ref<number | null>(props.setting.override)
const leftOutOfRange = ref(false)

watch(() => props.setting, (setting) => {
  inForce.value = setting
  entered.value = setting.value
})

function inRange(value: number | null): value is number {
  return value !== null && Number.isInteger(value) && value >= bounds.min && (bounds.max === undefined || value <= bounds.max)
}

const rangeMessage = computed(() =>
  leftOutOfRange.value && !inRange(entered.value) ? SETTING_RANGE_MESSAGES[props.settingKey] : undefined)

const save = useSaveAsChanged(async (sent: number | null) => {
  const shown = sent ?? inForce.value.fallbackValue
  const answer = await updateInstanceSettings({ [props.settingKey]: sent } as Partial<Record<SettingKey, number | null>>)
  inForce.value = answer[props.settingKey]
  if (entered.value === shown)
    entered.value = inForce.value.value
}, override)

function saveEntered() {
  leftOutOfRange.value = !inRange(entered.value)
  if (leftOutOfRange.value)
    return
  // Entering a number overrides, so the value already in force is not sent again as an override of itself.
  if (entered.value === inForce.value.value && save.status !== 'failed')
    return
  override.value = entered.value
  save.commit()
}

async function resetToFallback() {
  leftOutOfRange.value = false
  entered.value = inForce.value.fallbackValue
  override.value = null
  save.commit()
  // The button leaves with the override. The field takes the focus once it holds the fallback, so leaving it saves nothing.
  await nextTick()
  field.value?.$el.querySelector('input')?.focus()
}
</script>

<template>
  <SettingRow :label="label" :status="save.status" :reason="save.reason" :error="rangeMessage" @retry="save.retry">
    <template #default="{ control }">
      {{ before }}
      <NumberInput
        ref="field"
        v-model="entered"
        v-bind="control"
        class="number"
        inputmode="numeric"
        :min="bounds.min"
        :max="bounds.max"
        @commit="saveEntered"
      />
      {{ after }}
    </template>
    <template #source>
      <template v-if="inForce.override !== null">
        Set here ·
        <Button variant="quiet" @click="resetToFallback">
          Reset to {{ inForce.fallbackValue }}
        </Button>
      </template>
      <template v-else-if="inForce.fallbackSource === 'env'">
        From <code class="variable">{{ SETTING_ENV_VARS[settingKey] }}</code>
      </template>
      <template v-else>
        Built-in default
      </template>
    </template>
    <template v-if="!rangeMessage" #note>
      <slot name="note" :value="inForce.value" />
    </template>
  </SettingRow>
</template>

<style scoped>
@layer components {
  :deep(.number) {
    width: 4.5rem;
  }

  .variable {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
  }
}
</style>
