<script setup lang="ts">
import Button from '@/components/Button.vue'
import LoadingLine from '@/patterns/LoadingLine.vue'
import TitleLine from '@/patterns/TitleLine.vue'
import WashBar from '@/patterns/WashBar.vue'
</script>

<template>
  <TitleLine title="Plugins">
    <template #actions>
      <Button>Build a Plugin</Button>
      <Button variant="primary">
        Import a Recipe
      </Button>
    </template>
  </TitleLine>
  <LoadingLine>Loading Plugins</LoadingLine>
  <ul class="rows">
    <li v-for="width in ['11rem', '8rem', '14rem']" :key="width" class="row">
      <WashBar :width="width" />
      <WashBar width="60%" />
    </li>
  </ul>
</template>

<style scoped>
@layer components {
  .rows {
    margin-top: var(--space-4);
    border-top: var(--rule-heavy);
  }

  .rows .row {
    display: grid;
    gap: var(--space-3);
    padding-block: var(--space-4);
    border-bottom: var(--rule);
  }
}
</style>
