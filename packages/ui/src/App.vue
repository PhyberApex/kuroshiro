<script setup lang="ts">
import type { RouteRecordNameGeneric } from 'vue-router'
import { mdiThemeLightDark } from '@mdi/js'
import { usePreferredDark } from '@vueuse/core'
import { onMounted, ref, toRaw } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { useTheme } from 'vuetify'

import NavigationDrawer from '@/components/NavigationDrawer.vue'
import { useDemoInfo } from '@/composeables/useDemoInfo.ts'
import packageJson from '../../../package.json'

const isDark = usePreferredDark()

const theme = useTheme()

onMounted(() => {
  theme.global.name.value = isDark.value ? 'dark' : 'light'
})

const route = useRoute()

function toggleTheme() {
  let newTheme = 'light'
  if (theme.global.name.value === 'light')
    newTheme = 'dark'
  theme.global.name.value = newTheme
}

const version = packageJson.version

const currentRoute = ref<RouteRecordNameGeneric>('')

const drawer = ref(false)

onMounted(() => {
  currentRoute.value = toRaw(route.name)
})

const { isDemo } = useDemoInfo()
</script>

<template>
  <v-app>
    <v-app-bar>
      <v-app-bar-nav-icon variant="text" @click.stop="drawer = !drawer" />
      <v-app-bar-title>Kuroshiro <small>v{{ version }}</small><span class="ml-4">—<v-btn variant="text" href="https://usetrmnl.com/" target="_blank" rel="noopener" color="secondary">TRMNL</v-btn> server implementation</span></v-app-bar-title>
      <v-tabs
        v-model="currentRoute"
        align-tabs="center"
        class="ml-4"
      />
      <v-icon-btn :icon="mdiThemeLightDark" base-variant="flat" :rounded="true" @click="toggleTheme" />
    </v-app-bar>
    <v-navigation-drawer v-model="drawer" location="left">
      <NavigationDrawer />
    </v-navigation-drawer>
    <v-main>
      <v-banner v-if="isDemo" bg-color="warning" text="This is a demo. Data will be reset daily! Please do not use this with your actual hardware!" />
      <RouterView />
    </v-main>
  </v-app>
</template>
