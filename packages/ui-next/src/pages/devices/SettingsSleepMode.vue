<script setup lang="ts">
import type { DeviceDetail } from 'kuroshiro-shared'
import type { RadioChoice } from '@/components/RadioRow.vue'
import { computed } from 'vue'
import RadioRow from '@/components/RadioRow.vue'
import SettingRow from '@/components/SettingRow.vue'
import Switch from '@/components/Switch.vue'
import PageSection from '@/patterns/PageSection.vue'
import { useDeviceSetting } from './deviceSetting'
import { FIRST_SLEEP_WINDOW, SETTINGS_SECTIONS, sleepWindowInput } from './deviceSettings'
import SleepWindow from './SleepWindow.vue'

type WhileAsleep = DeviceDetail['sleep']['whileAsleep']

const props = defineProps<{
  device: DeviceDetail
}>()

const sleep = computed(() => props.device.sleep)
const hasWindow = computed(() => Boolean(sleep.value.start && sleep.value.end))

const enabled = useDeviceSetting(() => sleep.value.enabled, on =>
  on === sleep.value.enabled
    ? undefined
    : { sleepModeEnabled: on, ...(on && !hasWindow.value ? sleepWindowInput(FIRST_SLEEP_WINDOW) : {}) })

function switchTo(on: boolean) {
  enabled.entered = on
  enabled.commit()
}

const whileAsleep = useDeviceSetting<WhileAsleep>(() => sleep.value.whileAsleep, chosen =>
  chosen === sleep.value.whileAsleep ? undefined : { sleepScreenEnabled: chosen === 'fallback' })

function keepOrShow(chosen: WhileAsleep | undefined) {
  whileAsleep.entered = chosen ?? 'fallback'
  whileAsleep.commit()
}

const choices = computed<RadioChoice<WhileAsleep>[]>(() => [
  { value: 'fallback', label: 'Show the sleep Fallback Screen', hint: `“Asleep until ${sleep.value.end ?? FIRST_SLEEP_WINDOW.end}”.` },
  { value: 'keep', label: 'Keep the Current Screen', hint: `Whatever ${props.device.name} showed last stays on.` },
])

const on = computed(() => enabled.entered && !props.device.isMirrored)

function switchSays() {
  if (props.device.isMirrored)
    return 'Off while Mirroring'
  return enabled.entered ? 'On' : 'Off'
}
</script>

<template>
  <PageSection :id="SETTINGS_SECTIONS.sleepMode" title="Sleep Mode" rows>
    <SettingRow label="Sleep Mode" :status="enabled.status" :reason="enabled.reason" @retry="enabled.retry">
      <template #default="{ control }">
        <Switch
          :id="control.id"
          :model-value="on"
          :disabled="device.isMirrored"
          :saving="enabled.status === 'saving'"
          :error="enabled.status === 'failed'"
          :aria-describedby="control['aria-describedby']"
          @update:model-value="switchTo"
        />
        <span :class="{ soft: device.isMirrored }">{{ switchSays() }}</span>
      </template>
      <template v-if="sleep.inWindow && sleep.end" #note>
        In its window until {{ sleep.end }}
      </template>
    </SettingRow>
    <template v-if="on">
      <SleepWindow :device="device" />
      <SettingRow class="while-asleep" label="While asleep" :status="whileAsleep.status" :reason="whileAsleep.reason" @retry="whileAsleep.retry">
        <template #default="{ labelId }">
          <RadioRow class="choices" :model-value="whileAsleep.entered" :choices="choices" :aria-labelledby="labelId" @update:model-value="keepOrShow" />
        </template>
      </SettingRow>
    </template>
  </PageSection>
</template>

<style scoped>
@layer components {
  .soft {
    color: var(--color-ink-soft);
  }

  /* The label stands beside the first choice, not in the middle of both. */
  .while-asleep {
    align-items: start;
  }

  .while-asleep :deep(.label) {
    padding-top: var(--space-3);
  }

  .choices {
    flex: 1;
    min-width: 0;
  }

  .choices :deep(.row:last-child) {
    border-bottom: 0;
  }

  @media (max-width: 820px) {
    .while-asleep :deep(.label) {
      padding-top: 0;
    }
  }
}
</style>
