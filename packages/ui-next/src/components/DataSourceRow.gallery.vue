<script setup lang="ts">
import { ref } from 'vue'
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import Button from './Button.vue'
import DataSourceRow from './DataSourceRow.vue'
import DataSourceRows from './DataSourceRows.vue'

const open = ref('pollen')
</script>

<template>
  <SpecimenRow>
    <Specimen caption="default · hover · focus · open · removed" wide>
      <DataSourceRows v-model:open="open" class="stretch">
        <DataSourceRow value="forecast" name="forecast" what="GET api.open-meteo.com/v1/forecast?latitude={{ latitude }}&longitude={{ longitude }}&hourly=temperature_2m">
          <template #health>
            Fetched 5 min ago
          </template>
        </DataSourceRow>
        <DataSourceRow value="air" name="air_quality" what="GET air-quality-api.open-meteo.com/v1/air-quality" force="hover">
          <template #health>
            Not fetched yet
          </template>
        </DataSourceRow>
        <DataSourceRow value="holidays" name="holidays" what="literal · a fixed value" force="focus" />
        <DataSourceRow value="pollen" name="pollen" what="POST pollen.test/today">
          <template #health>
            Fetched 5 min ago
          </template>
          <p class="inside">
            The Data Source's form at the left and the story of its fetches at the right.
          </p>
        </DataSourceRow>
        <DataSourceRow value="tides" name="tides" what="GET tides.test/v2/station/4411" removed>
          <template #health>
            Removed when you save ·
            <Button variant="quiet">
              Put back
            </Button>
          </template>
        </DataSourceRow>
      </DataSourceRows>
    </Specimen>
  </SpecimenRow>
</template>

<style scoped>
@layer components {
  .stretch {
    justify-self: stretch;
  }

  .inside {
    max-width: var(--measure);
    color: var(--color-ink-soft);
  }
}
</style>
