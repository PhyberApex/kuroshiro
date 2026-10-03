<script setup lang="ts">
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import CopyValue from './CopyValue.vue'
import NumberedSteps from './NumberedSteps.vue'
</script>

<template>
  <SpecimenRow>
    <Specimen caption="default: steps of text, and one holding a control" wide>
      <NumberedSteps class="steps">
        <li>Hold the button on the back of the Device for five seconds, until it shows its setup screen.</li>
        <li>Join the Wi-Fi network the Device opens and choose your own network on the page that appears.</li>
        <li>
          <p>Enter this as the server:</p>
          <CopyValue class="address" value="http://kuroshiro.lan:3000" />
        </li>
        <li>The Device appears here at its first poll.</li>
      </NumberedSteps>
    </Specimen>
  </SpecimenRow>
</template>

<style scoped>
@layer components {
  .steps {
    justify-self: stretch;
  }

  .address {
    margin-top: var(--space-2);
  }
}
</style>
