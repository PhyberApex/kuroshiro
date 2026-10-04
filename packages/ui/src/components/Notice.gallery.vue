<script setup lang="ts">
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import Notice from './Notice.vue'
</script>

<template>
  <SpecimenRow>
    <Specimen caption="a failed request, with the reason and an action" wide>
      <Notice
        class="stretch"
        title="Kitchen's Logs could not be loaded."
        reason="The Instance did not answer. What you changed before is saved."
        action="Try again"
      />
    </Specimen>
    <Specimen caption="without a reason" wide>
      <Notice class="stretch" title="Could not load Kitchen's Settings." action="Try again" />
    </Specimen>
    <Specimen caption="without an action" wide>
      <Notice class="stretch" title="Kuroshiro's server is not answering." reason="Trying again every 10 seconds." />
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
