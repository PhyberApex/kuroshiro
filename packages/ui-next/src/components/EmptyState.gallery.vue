<script setup lang="ts">
import { RouterLink } from 'vue-router'
import RouteStage from '@/gallery/RouteStage.vue'
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import Button from './Button.vue'
import EmptyState from './EmptyState.vue'
</script>

<template>
  <SpecimenRow>
    <Specimen caption="with an action" wide>
      <EmptyState class="stretch" title="No Screens yet" heading="h3">
        A Screen is one thing Kitchen can show: a Plugin, a Mashup, a link, a file or your own HTML. Kitchen shows the welcome screen until you add one.
        <template #action>
          <Button variant="primary">
            Add Screen
          </Button>
        </template>
      </EmptyState>
    </Specimen>
    <Specimen caption="without an action" wide>
      <EmptyState class="stretch" title="No Device Log entries yet" heading="h3">
        Kitchen sends an entry when something goes wrong on its side. They appear here after its next poll.
      </EmptyState>
    </Specimen>
  </SpecimenRow>

  <SpecimenRow title="Whole page">
    <Specimen caption="a record that does not exist, with one link back" wide>
      <RouteStage at="/devices/42">
        <EmptyState class="stretch" page title="No Device here" heading="h3">
          It may have been deleted.
          <template #action>
            <Button as-child>
              <RouterLink to="/">
                All Devices
              </RouterLink>
            </Button>
          </template>
        </EmptyState>
      </RouteStage>
    </Specimen>
  </SpecimenRow>
</template>

<style scoped>
@layer components {
  .stretch {
    justify-self: stretch;
  }
}
</style>
