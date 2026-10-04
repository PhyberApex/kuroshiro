<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { listScreens } from '@/api/screens'
import Button from '@/components/Button.vue'
import EmptyState from '@/components/EmptyState.vue'
import BackLink from '@/patterns/BackLink.vue'
import { joinLoads } from '@/patterns/joinLoads'
import LoadBody from '@/patterns/LoadBody.vue'
import { useLoad } from '@/patterns/useLoad'
import { useDeviceFrame } from './deviceFrame'
import EditHtmlForm from './EditHtmlForm.vue'
import { possessive } from './screenNaming'

const route = useRoute()
const { device, name, path } = useDeviceFrame()

const screens = useLoad(() => listScreens(String(route.params.deviceId)), { key: () => route.params.deviceId })
const loaded = joinLoads({ device, screens })

const htmlScreen = computed(() => screens.data?.find(screen => screen.id === route.params.screenId && screen.kind === 'html'))
const missing = computed(() => screens.data !== undefined && !htmlScreen.value)
</script>

<template>
  <div class="edit-html">
    <BackLink v-if="!missing" :to="path">
      {{ possessive(name) }} Screens
    </BackLink>
    <LoadBody v-slot="{ data }" :load="loaded" :loading="`Loading ${possessive(name)} Screens`" :failed="`Could not load ${possessive(name)} Screens.`">
      <EditHtmlForm v-if="htmlScreen" :key="htmlScreen.id" :device="data.device" :screen="htmlScreen" />
      <EmptyState v-else title="No HTML Screen here" heading="h2" page>
        It may have been deleted, or it is a Screen of another kind, whose HTML cannot be edited.
        <template #action>
          <Button as-child>
            <RouterLink :to="path">
              {{ possessive(name) }} Screens
            </RouterLink>
          </Button>
        </template>
      </EmptyState>
    </LoadBody>
  </div>
</template>

<style scoped>
@layer components {
  .edit-html {
    margin-top: var(--space-8);
  }

  @media (max-width: 820px) {
    .edit-html {
      margin-top: var(--space-6);
    }
  }
}
</style>
