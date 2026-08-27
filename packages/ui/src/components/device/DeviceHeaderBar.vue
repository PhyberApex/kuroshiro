<script setup lang="ts">
import { mdiCircle, mdiContentSave, mdiDelete, mdiPencil } from '@mdi/js'
import { ref } from 'vue'
import { VBtn, VIcon, VTextField } from 'vuetify/components'

defineProps<{
  online: boolean
  valid: boolean
}>()

defineEmits<{
  save: []
  delete: []
}>()

const name = defineModel<string>('name', { required: true })

const nameEditing = ref(false)
</script>

<template>
  <div v-if="!nameEditing">
    <span data-test-id="device-name">{{ name }}</span>
    <v-icon-btn :icon="mdiPencil" size="x-small" class="ml-2" aria-label="Edit device name" variant="text" @click="nameEditing = true" />
    <VIcon :icon="mdiCircle" :color="online ? 'success' : 'error'" size="x-small" class="ml-2" />
  </div>
  <div v-else>
    <VTextField v-model="name" variant="underlined" density="compact" autofocus :hide-details="true" min-width="200" @blur="nameEditing = false" />
  </div>
  <div>
    <VBtn color="success" variant="tonal" :prepend-icon="mdiContentSave" class="mr-5" :disabled="!valid" @click="$emit('save')">
      Update
    </VBtn>
    <VBtn color="error" variant="tonal" :prepend-icon="mdiDelete" data-test-id="delete-device-btn" @click="$emit('delete')">
      Delete
    </VBtn>
  </div>
</template>
