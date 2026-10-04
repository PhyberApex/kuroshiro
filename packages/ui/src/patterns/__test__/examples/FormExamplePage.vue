<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import TitleLine from '../../TitleLine.vue'
import UnsavedChanges from '../../UnsavedChanges.vue'

const html = ref('')
</script>

<template>
  <TitleLine title="Edit HTML" />
  <label>HTML <input v-model="html"></label>
  <RouterLink to="/elsewhere">
    Elsewhere
  </RouterLink>
  <UnsavedChanges :when="html !== ''">
    <template #lost>
      Your changes to Greeting's HTML.
    </template>
  </UnsavedChanges>
</template>
