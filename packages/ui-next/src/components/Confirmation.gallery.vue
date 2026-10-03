<script setup lang="ts">
import { ref } from 'vue'
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import Button from './Button.vue'
import Confirmation from './Confirmation.vue'

// An open confirmation hides the rest of the page from assistive technology and holds the focus, so it is shown closed here; Confirmation.shots.ts holds its open states.
const deleting = ref(false)
const clearing = ref(false)

const SERVER_DELAY_MS = 900
const afterAWhile = () => new Promise(resolve => setTimeout(resolve, SERVER_DELAY_MS))

async function refuse() {
  await afterAWhile()
  throw new Error('Kuroshiro\'s server is not answering.')
}
</script>

<template>
  <SpecimenRow>
    <Specimen caption="closed; press it to open the confirmation on the scrim">
      <Button @click="deleting = true">
        Delete Screen
      </Button>
      <Confirmation
        v-model:open="deleting"
        title="Delete Weekend board?"
        confirm-label="Delete Screen"
        safe-label="Keep Screen"
        :action="afterAWhile"
      >
        <template #lost>
          The Screen leaves Kitchen's Rotation and its Schedule is lost.
        </template>
        <template #stays>
          The Plugins in its slots stay in your library.
        </template>
      </Confirmation>
    </Specimen>
    <Specimen caption="closed; its action fails, so it stays open and says why">
      <Button @click="clearing = true">
        Clear Logs
      </Button>
      <Confirmation
        v-model:open="clearing"
        title="Clear Kitchen's Logs?"
        confirm-label="Clear Logs"
        :action="refuse"
      >
        <template #lost>
          All 214 entries of Kitchen's Device Log.
        </template>
        <template #stays>
          Nothing else changes. New entries arrive with the next poll.
        </template>
      </Confirmation>
    </Specimen>
  </SpecimenRow>
</template>
