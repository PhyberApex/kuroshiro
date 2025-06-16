<script setup lang="ts">
import type { CurrentScreen } from '@/types'
import { computed } from 'vue'
import { formatDate } from '@/utils/formatDate'

const props = defineProps<{ screen: CurrentScreen }>()

const screen = computed(() => props.screen)
</script>

<template>
  <v-card class="mb-6" elevation="1">
    <v-card-title>Current Screen</v-card-title>
    <v-divider />
    <v-card-text>
      <v-img :src="screen.image_url" data-test-id="screen-image" />
      <div class="mt-5 text-subtitle-1" data-test-id="screen-rendered-date">
        Generated {{ formatDate(screen.rendered_at) }}
      </div>
    </v-card-text>
  </v-card>
</template>
