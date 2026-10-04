<script setup lang="ts">
import type { AddScreenKind } from './addScreen'
import { computed, useId } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import RadioRow from '@/components/RadioRow.vue'
import BackLink from '@/patterns/BackLink.vue'
import ChoiceBesideForm from '@/patterns/ChoiceBesideForm.vue'
import LoadBody from '@/patterns/LoadBody.vue'
import { useInstanceFacts } from '@/reads/sharedReads'
import { offeredKinds } from './addScreen'
import { ADD_SCREEN_KINDS } from './addScreenKinds'
import { useDeviceFrame } from './deviceFrame'
import { possessive } from './screenNaming'

const route = useRoute()
const router = useRouter()
const facts = useInstanceFacts()
const { device, name, path } = useDeviceFrame()

const headingId = useId()

const kinds = computed(() => offeredKinds(ADD_SCREEN_KINDS, facts.data?.demoMode ?? false))
/** The kind the address names when it can be chosen, and the first kind otherwise. */
const chosen = computed(() => {
  const named = kinds.value.find(kind => kind.value === route.query.kind && !kind.disabled)
  return ADD_SCREEN_KINDS.find(entry => entry.kind === named?.value) ?? ADD_SCREEN_KINDS[0]!
})

function choose(kind?: AddScreenKind) {
  if (kind)
    void router.replace({ query: { ...route.query, kind } })
}
</script>

<template>
  <section class="add-screen" :aria-labelledby="headingId">
    <BackLink :to="path">
      {{ possessive(name) }} Screens
    </BackLink>
    <h2 :id="headingId" class="heading">
      Add Screen
    </h2>
    <ChoiceBesideForm>
      <template #choice>
        <RadioRow :model-value="chosen.kind" :choices="kinds" aria-label="Kind of Screen" @update:model-value="choose" />
      </template>
      <LoadBody v-slot="{ data }" :load="device" :loading="`Loading ${name}`" :failed="`Could not load ${name}.`">
        <component :is="chosen.form" :key="chosen.kind" :device="data" />
      </LoadBody>
    </ChoiceBesideForm>
  </section>
</template>

<style scoped>
@layer components {
  .add-screen {
    margin-top: var(--space-8);
  }

  .heading {
    margin-top: var(--space-4);
    padding-bottom: var(--space-2);
    font-stretch: var(--width-title);
    font-weight: var(--weight-title);
    font-size: var(--title-sm);
    line-height: var(--leading-title);
  }

  @media (max-width: 820px) {
    .add-screen {
      margin-top: var(--space-6);
    }
  }
}
</style>
