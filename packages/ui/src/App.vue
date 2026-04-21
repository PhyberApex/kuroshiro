<script setup lang="ts">
import type { RouteRecordNameGeneric } from 'vue-router'
import { mdiThemeLightDark } from '@mdi/js'
import { usePreferredDark } from '@vueuse/core'
import { onMounted, ref, toRaw, watch } from 'vue'
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
  const newTheme = theme.global.name.value === 'light' ? 'dark' : 'light'
  theme.global.name.value = newTheme
  updateThemeColor(newTheme)
}

const version = packageJson.version

const currentRoute = ref<RouteRecordNameGeneric>('')

const drawer = ref(false)

function updateThemeColor(themeName: string) {
  const bg = themeName === 'dark' ? '#121318' : '#fafbfc'
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta)
    meta.setAttribute('content', bg)
  const msTile = document.querySelector('meta[name="msapplication-TileColor"]')
  if (msTile)
    msTile.setAttribute('content', bg)
}

onMounted(() => {
  currentRoute.value = toRaw(route.name)
  updateThemeColor(theme.global.name.value)
})

watch(() => route.name, (name) => {
  currentRoute.value = toRaw(name)
})

watch(theme.global.name, (name) => {
  updateThemeColor(name)
}, { immediate: true })

const { isDemo } = useDemoInfo()
</script>

<template>
  <v-app>
    <v-app-bar>
      <v-app-bar-nav-icon variant="text" aria-label="Toggle navigation menu" @click.stop="drawer = !drawer" />
      <v-app-bar-title>
        Kuroshiro <small>v{{ version }}</small> <v-btn variant="text" href="https://usetrmnl.com/" target="_blank" rel="noopener" color="secondary" class="ml-2">
          TRMNL
        </v-btn>
      </v-app-bar-title>
      <v-tabs
        v-model="currentRoute"
        align-tabs="center"
        class="ml-4"
      >
        <v-tab value="overview" :to="{ name: 'overview' }">
          Overview
        </v-tab>
        <v-tab value="pluginsOverview" :to="{ name: 'pluginsOverview' }">
          Plugins
        </v-tab>
        <v-tab value="maintenance" :to="{ name: 'maintenance' }">
          Maintenance
        </v-tab>
        <v-tab value="virtualDevice" :to="{ name: 'virtualDevice' }">
          Virtual Device
        </v-tab>
        <v-tab value="htmlPreview" :to="{ name: 'htmlPreview' }">
          HTML Preview
        </v-tab>
      </v-tabs>
      <v-icon-btn :icon="mdiThemeLightDark" base-variant="flat" :rounded="true" aria-label="Toggle light/dark theme" @click="toggleTheme" />
    </v-app-bar>
    <v-navigation-drawer v-model="drawer" location="left">
      <NavigationDrawer />
    </v-navigation-drawer>
    <v-main>
      <v-banner v-if="isDemo" bg-color="warning" text="Demo mode. Data resets daily. Do not use with real hardware." />
      <RouterView v-slot="{ Component }">
        <Transition name="route" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </v-main>
  </v-app>
</template>
