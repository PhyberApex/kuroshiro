<script setup lang="ts">
import type { PluginFormPart } from '../../pluginForm'
import { ref } from 'vue'
import Field from '@/components/Field.vue'
import NumberInput from '@/components/NumberInput.vue'
import PageSection from '@/patterns/PageSection.vue'
import { fieldId, usePluginFormPart, usePluginPage } from '../../pluginPage'

const fetching: PluginFormPart<{ minutes: number | null }> = {
  keys: ['refreshInterval'],
  read: plugin => ({ minutes: plugin.refreshInterval }),
  toInput: draft => ({ refreshInterval: draft.minutes ?? undefined }),
  validate: draft => draft.minutes !== null && draft.minutes >= 1 && draft.minutes <= 1440
    ? []
    : [{ path: 'refreshInterval', message: 'Enter between 1 minute and 24 hours.' }],
}

const { plugin } = usePluginPage()
const open = ref(false)
const part = usePluginFormPart(fetching, () => (open.value = true))
</script>

<template>
  <PageSection id="data" title="Stand-in">
    <p>Its Fetch Failure Streak is {{ plugin.dataSources[0]?.fetchFailureStreak }}.</p>
    <button type="button" @click="open = !open">
      Fetch
    </button>
    <Field v-if="open" :id="fieldId('refreshInterval')" v-slot="{ control }" label="Minutes between fetches" :error="part.errors.refreshInterval">
      <NumberInput v-model="part.draft.minutes" v-bind="control" />
    </Field>
  </PageSection>
</template>
