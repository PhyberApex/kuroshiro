<script setup lang="ts" generic="T extends { key: string }">
import { VBtn, VCard, VCardText, VCardTitle, VCheckbox, VDivider, VList, VListItem } from 'vuetify/components'

defineProps<{
  title: string
  items: T[]
}>()

const selected = defineModel<string[]>('selected', { required: true })

function selectAll(items: T[]) {
  selected.value = items.map(item => item.key)
}
</script>

<template>
  <VCard v-if="items.length > 0" elevation="1" class="mb-4">
    <VCardTitle class="d-flex align-center justify-space-between flex-wrap ga-2">
      {{ title }}
      <VBtn size="small" variant="text" @click="selectAll(items)">
        Select All
      </VBtn>
    </VCardTitle>
    <VDivider />
    <VCardText>
      <VList>
        <VListItem v-for="item in items" :key="item.key">
          <template #prepend>
            <VCheckbox v-model="selected" :value="item.key" hide-details />
          </template>
          <slot :item="item" />
        </VListItem>
      </VList>
    </VCardText>
  </VCard>
</template>
