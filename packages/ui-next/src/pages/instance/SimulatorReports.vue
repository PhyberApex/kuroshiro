<script setup lang="ts">
import Field from '@/components/Field.vue'
import TextInput from '@/components/TextInput.vue'
import TuckedSection from '@/components/TuckedSection.vue'
import { useSimulator } from './deviceSimulator'
import { REPORT_INPUTS } from './simulatorWording'

const simulator = useSimulator()
</script>

<template>
  <TuckedSection title="What it reports" heading="h3">
    <p class="about">
      <template v-if="simulator.listed">
        Filled with what {{ simulator.listed.name }} last reported, so a poll leaves its facts as they are. Change one to see what the server does with it.
      </template>
      <template v-else>
        What the simulated Device tells the server about itself.
      </template>
    </p>
    <div class="reports">
      <Field v-for="input in REPORT_INPUTS" :key="input.key" v-slot="{ control }" :label="input.label">
        <TextInput v-model="simulator.report[input.key]" v-bind="control" :aria-describedby="`${control.id}-header`" wide autocomplete="off" spellcheck="false" />
        <span :id="`${control.id}-header`" class="header">{{ input.header }}</span>
      </Field>
    </div>
  </TuckedSection>
</template>

<style scoped>
@layer components {
  .about {
    max-width: var(--measure);
    color: var(--color-ink-soft);
  }

  .reports {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
    gap: var(--space-4);
    margin-top: var(--space-4);
  }

  .reports > * {
    grid-template-columns: minmax(0, 1fr);
    min-width: 0;
  }

  .header {
    display: block;
    margin-top: var(--space-1);
    color: var(--color-ink-soft);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
  }
}
</style>
