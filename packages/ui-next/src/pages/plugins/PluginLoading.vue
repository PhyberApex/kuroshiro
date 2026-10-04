<script setup lang="ts">
import EditorBench from '@/components/EditorBench.vue'
import Plate from '@/components/Plate.vue'
import PluginSection from './PluginSection.vue'
</script>

<template>
  <div class="plugin-loading" aria-hidden="true">
    <PluginSection title="Template">
      <EditorBench>
        <template #editor>
          <div class="editor" />
        </template>
        <template #plate>
          <Plate name="The preview" :width="800" :height="480" rendering />
        </template>
      </EditorBench>
    </PluginSection>
  </div>
</template>

<style scoped>
@layer components {
  .editor {
    height: 19rem;
    border-radius: var(--radius-inner);
    background: var(--color-wash);
  }
}
</style>
