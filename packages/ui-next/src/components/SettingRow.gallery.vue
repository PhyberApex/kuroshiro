<script setup lang="ts">
import type { Weekday } from './WeekdayToggle.vue'
import { ref } from 'vue'
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import Button from './Button.vue'
import NumberInput from './NumberInput.vue'
import SettingRow from './SettingRow.vue'
import Switch from './Switch.vue'
import TextInput from './TextInput.vue'
import WeekdayToggle from './WeekdayToggle.vue'

const name = ref('Kitchen')
const rate = ref(15)
const tooFast = ref(0)
const sleepMode = ref(true)
const days = ref<Weekday[]>([1, 2, 3, 4, 5])
const batteryLow = ref(20)
const missedPolls = ref(4)
const streak = ref(3)
const keptDays = ref(14)
const outOfRange = ref(0)
</script>

<template>
  <SpecimenRow>
    <Specimen caption="default, saving, saved, invalid, not saved, a group of controls" wide>
      <div class="rows">
        <SettingRow v-slot="{ control }" label="Name">
          <TextInput v-model="name" v-bind="control" prose />
        </SettingRow>
        <SettingRow label="Sleep Mode" status="saving">
          <template #default="{ control }">
            <Switch :id="control.id" v-model="sleepMode" :aria-describedby="control['aria-describedby']" saving>
              On
            </Switch>
          </template>
          <template #note>
            In its window until 06:00
          </template>
        </SettingRow>
        <SettingRow label="Refresh rate" status="saved">
          <template #default="{ control }">
            every <NumberInput v-model="rate" v-bind="control" :min="1" /> minutes
          </template>
          <template #note>
            How often Kitchen polls, and so how often Rotation moves on.
          </template>
        </SettingRow>
        <SettingRow label="Refresh rate" error="Enter between 1 minute and 24 hours.">
          <template #default="{ control }">
            every <NumberInput v-model="tooFast" v-bind="control" :min="1" /> minutes
          </template>
          <template #note>
            How often Kitchen polls, and so how often Rotation moves on.
          </template>
        </SettingRow>
        <SettingRow v-slot="{ control }" label="Name" status="failed" reason="Kuroshiro's server is not answering.">
          <TextInput v-model="name" v-bind="control" prose />
        </SettingRow>
        <SettingRow v-slot="{ labelId }" label="Days">
          <WeekdayToggle v-model="days" :aria-labelledby="labelId" />
        </SettingRow>
      </div>
    </Specimen>
  </SpecimenRow>
  <SpecimenRow title="With its source">
    <Specimen caption="default, from the environment, set here, saved, invalid, not saved" wide>
      <div class="rows">
        <SettingRow label="Battery low">
          <template #default="{ control }">
            below <NumberInput v-model="batteryLow" v-bind="control" :min="1" :max="100" /> %
          </template>
          <template #source>
            Built-in default
          </template>
          <template #note>
            Fires when a Device's battery is below 20 %, and resolves once it is back at 25 %.
          </template>
        </SettingRow>
        <SettingRow label="Device Log entries">
          <template #default="{ control }">
            kept for <NumberInput v-model="keptDays" v-bind="control" :min="0" /> days
          </template>
          <template #source>
            From <code class="variable">KUROSHIRO_DEVICE_LOG_RETENTION_DAYS</code>
          </template>
          <template #note>
            0 keeps them until you clear a Device's Logs.
          </template>
        </SettingRow>
        <SettingRow label="Offline">
          <template #default="{ control }">
            after <NumberInput v-model="missedPolls" v-bind="control" :min="2" /> missed polls
          </template>
          <template #source>
            Set here ·
            <Button variant="quiet">
              Reset to 3
            </Button>
          </template>
          <template #note>
            Fires when a Device has not polled for 4 times its refresh rate.
          </template>
        </SettingRow>
        <SettingRow label="Fetch Failure Streak" status="saved">
          <template #default="{ control }">
            of <NumberInput v-model="streak" v-bind="control" :min="1" /> failed fetches
          </template>
          <template #source>
            Built-in default
          </template>
          <template #note>
            An Alert fires when the streak reaches 3.
          </template>
        </SettingRow>
        <SettingRow label="Battery low" error="Enter a whole number from 1 to 100.">
          <template #default="{ control }">
            below <NumberInput v-model="outOfRange" v-bind="control" :min="1" :max="100" /> %
          </template>
          <template #source>
            Built-in default
          </template>
        </SettingRow>
        <SettingRow label="Offline" status="failed" reason="Kuroshiro's server is not answering.">
          <template #default="{ control }">
            after <NumberInput v-model="missedPolls" v-bind="control" :min="2" /> missed polls
          </template>
          <template #source>
            Built-in default
          </template>
          <template #note>
            Fires when a Device has not polled for 4 times its refresh rate.
          </template>
        </SettingRow>
      </div>
    </Specimen>
  </SpecimenRow>
</template>

<style scoped>
@layer components {
  .rows {
    justify-self: stretch;
  }

  .variable {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
  }
}
</style>
