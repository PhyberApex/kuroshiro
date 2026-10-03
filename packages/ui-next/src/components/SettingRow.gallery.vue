<script setup lang="ts">
import type { Weekday } from './WeekdayToggle.vue'
import { ref } from 'vue'
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
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
</template>

<style scoped>
@layer components {
  .rows {
    justify-self: stretch;
  }
}
</style>
