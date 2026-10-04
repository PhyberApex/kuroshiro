<script setup lang="ts">
import type { NavItem } from '@/components/navItem'
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import PageList from '@/components/PageList.vue'
import TitleLine from '@/patterns/TitleLine.vue'
import { useNarrowWindow } from '@/patterns/useNarrowWindow'
import InstanceFoot from './InstanceFoot.vue'
import { INSTANCE_PATH, instancePagePath } from './instancePaths'

const route = useRoute()
const narrow = useNarrowWindow()

/** The pages that are built, in the order their routes stand under the frame's. */
const pages = computed<NavItem[]>(() => {
  const frame = route.matched.find(record => record.path === INSTANCE_PATH)
  return (frame?.children ?? []).flatMap(page =>
    page.meta?.instancePage ? [{ label: page.meta.instancePage, to: instancePagePath(page.path) }] : [])
})
</script>

<template>
  <TitleLine title="Instance" />
  <div class="instance-frame">
    <div class="side">
      <PageList class="list" label="Instance" :items="pages" />
      <InstanceFoot v-if="!narrow" class="foot" />
    </div>
    <div class="page">
      <RouterView />
      <InstanceFoot v-if="narrow" class="foot" />
    </div>
  </div>
</template>

<style scoped>
@layer components {
  .instance-frame {
    display: grid;
    grid-template-columns: 13.5rem minmax(0, 1fr);
    align-items: start;
    gap: var(--space-10);
    margin-top: var(--space-2);

    /* The page beside the list is narrower than a whole column, so a Setting's label takes less of it. */
    --setting-label-width: 11rem;
  }

  .side {
    position: sticky;
    top: calc(var(--bar-height) + var(--space-6));
  }

  .side .foot {
    margin-top: var(--space-8);
  }

  .page {
    min-width: 0;
  }

  @media (max-width: 820px) {
    .instance-frame {
      grid-template-columns: minmax(0, 1fr);
      gap: var(--space-5);
      margin-top: 0;
    }

    .side {
      position: static;
    }

    /* The row of pages runs from one edge of the window to the other and scrolls under both. */
    .list {
      margin-inline: calc(var(--gutter) * -1);
      padding-inline: var(--gutter);
    }

    .page .foot {
      margin-top: var(--space-12);
    }
  }
}
</style>
