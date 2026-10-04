<script setup lang="ts">
import type { DeviceStanding } from './pluginDevices'
import { nextTick, useTemplateRef } from 'vue'
import { RouterLink } from 'vue-router'
import Button from '@/components/Button.vue'
import Icon from '@/components/Icon.vue'
import { devicePath } from '@/pages/devices/devicePaths'
import PlaceRow from './PlaceRow.vue'
import { assignedStanding, notAssignedSentence } from './pluginDevices'
import { usePluginPage } from './pluginPage'
import PluginUnassign from './PluginUnassign.vue'
import { useAssignToDevice } from './useAssignToDevice'

const props = defineProps<DeviceStanding>()

const assigning = useAssignToDevice(() => props.device.id)

const { reload } = usePluginPage()

/** The Unassign button had the focus and goes with the assignment: "Assign to {Device}" takes its place and the focus. */
const assignButton = useTemplateRef<{ $el: HTMLElement }>('assignButton')
async function showUnassigned() {
  await reload()
  await nextTick()
  assignButton.value?.$el.focus()
}
</script>

<template>
  <PlaceRow>
    <template #name>
      <RouterLink class="device" :to="devicePath(device.id)">
        {{ device.name }}
      </RouterLink>
    </template>
    <template #standing>
      <span class="said" :class="{ failed: assigning.failure }" role="status">
        <template v-if="assignment">
          Assigned · <b class="place">{{ assignedStanding(assignment) }}</b>
        </template>
        <template v-else-if="assigning.failure">
          <Icon name="problem" class="mark" />{{ notAssignedSentence(assigning.failure.reason) }}
        </template>
        <template v-else>
          Not assigned
        </template>
      </span>
      <Button v-if="!assignment && assigning.failure" variant="quiet" @click="assigning.assign">
        Try again
      </Button>
    </template>
    <template #act>
      <PluginUnassign v-if="assignment" :device="device" @unassigned="showUnassigned" />
      <Button v-else ref="assignButton" :loading="assigning.running" @click="assigning.assign">
        Assign to {{ device.name }}
      </Button>
    </template>
  </PlaceRow>
</template>

<style scoped>
@layer components {
  .device {
    text-underline-offset: 3px;
  }

  .said {
    display: inline;
  }

  .place,
  .failed {
    color: var(--color-ink);
    font-weight: var(--weight-medium);
  }

  .mark {
    width: var(--space-3);
    height: var(--space-3);
    margin-right: var(--space-2);
    vertical-align: -0.0625rem;
  }

  .said + .button {
    margin-left: var(--space-3);
  }

  @media (pointer: coarse) {
    .device {
      display: inline-flex;
      align-items: center;
      min-height: var(--hit-target);
    }
  }
}
</style>
