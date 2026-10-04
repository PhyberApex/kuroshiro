<script setup lang="ts">
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { provide, shallowReactive } from 'vue'
import { createMemoryHistory, createRouter, routeLocationKey, routerKey, START_LOCATION } from 'vue-router'

const props = defineProps<{
  /** The path the stage's router is at, which decides the link shown as current. */
  at: string
}>()

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/:anywhere(.*)*', component: { render: () => null } }],
})
router.replace(props.at)

/*
A router is normally installed on the app. The gallery has none, and a link pressed in a
specimen must not leave the gallery, so the stage hands its own router to what is inside it,
the way `router.install` does.
*/
const currentRoute = Object.defineProperties({}, Object.fromEntries(
  Object.keys(START_LOCATION).map(key => [key, {
    enumerable: true,
    get: () => router.currentRoute.value[key as keyof RouteLocationNormalizedLoaded],
  }]),
)) as RouteLocationNormalizedLoaded

provide(routerKey, router)
provide(routeLocationKey, shallowReactive(currentRoute))
</script>

<template>
  <slot />
</template>
