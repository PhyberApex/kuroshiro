<script setup lang="ts">
import Button from '@/components/Button.vue'
import RouteStage from '@/gallery/RouteStage.vue'
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import TitleLine from './TitleLine.vue'
</script>

<template>
  <SpecimenRow>
    <Specimen caption="a title" wide>
      <TitleLine class="line" title="Instance" />
    </Specimen>
    <Specimen caption="with the page's actions" wide>
      <TitleLine class="line" title="Plugins">
        <template #actions>
          <Button>Build a Plugin</Button>
          <Button variant="primary">
            Import a Recipe
          </Button>
        </template>
      </TitleLine>
    </Specimen>
    <Specimen caption="with a link back" wide>
      <RouteStage at="/plugins/weather">
        <TitleLine class="line" title="Weather" :back="{ label: 'All Plugins', to: '/plugins' }" />
      </RouteStage>
    </Specimen>
  </SpecimenRow>
</template>

<style scoped>
@layer components {
  .line {
    width: 100%;
  }
}
</style>
