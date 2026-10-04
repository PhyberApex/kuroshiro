<script setup lang="ts">
import { ref } from 'vue'
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import Button from './Button.vue'
import LineShownOnce from './LineShownOnce.vue'

const shownAgain = ref(0)
</script>

<template>
  <SpecimenRow>
    <Specimen caption="shown" wide>
      <LineShownOnce class="stretch">
        Created. It shows its name until you write its template.
      </LineShownOnce>
    </Specimen>
    <Specimen caption="shown; “Dismiss” takes it away" wide>
      <div class="stretch stack">
        <LineShownOnce :key="shownAgain">
          Imported from the Recipe Weather. It is not on a Device yet. It brings a transform: JavaScript that runs on this server at every fetch. Read it under Data Sources.
        </LineShownOnce>
        <Button variant="quiet" @click="shownAgain += 1">
          Show the line again
        </Button>
      </div>
    </Specimen>
  </SpecimenRow>
</template>

<style scoped>
@layer components {
  .stretch {
    justify-self: stretch;
  }

  .stack {
    display: grid;
    justify-items: start;
    gap: var(--space-2);
  }

  .stack > :first-child {
    justify-self: stretch;
  }
}
</style>
