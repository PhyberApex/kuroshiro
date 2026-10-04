<script setup lang="ts">
import type { StorageCheck, StorageFinding, StorageFindingGroup } from 'kuroshiro-shared'
import { computed, ref, watch } from 'vue'
import Button from '@/components/Button.vue'
import Confirmation from '@/components/Confirmation.vue'
import FindingRow from '@/components/FindingRow.vue'
import FindingRows from '@/components/FindingRows.vue'
import FindingContents from './FindingContents.vue'
import { cleanUpLabel, findingGroups, lostLines, screensLine, staysLines } from './housekeepingWording'

const props = defineProps<{
  check: StorageCheck
  cleanUp: (findingIds: string[], findings: StorageFinding[]) => Promise<void>
}>()

const groups = computed(() => findingGroups(props.check.findings))

/** Cleaning up the Screens group deletes Screens, so a check starts with every group ticked but that one. */
const tickedOnACheck = () => groups.value.map(group => group.group).filter(group => group !== 'missingImage')

const ticked = ref<StorageFindingGroup[]>(tickedOnACheck())
const open = ref<string>()
const asking = ref(false)

watch(() => props.check, () => {
  ticked.value = tickedOnACheck()
})

function tick(group: StorageFindingGroup, on: boolean) {
  ticked.value = on ? [...ticked.value, group] : ticked.value.filter(each => each !== group)
}

const tickedGroups = computed(() => groups.value.filter(group => ticked.value.includes(group.group)))
const label = computed(() => cleanUpLabel(tickedGroups.value.length))

const cleanUpTicked = () => props.cleanUp(tickedGroups.value.flatMap(group => group.findings.map(finding => finding.id)), props.check.findings)
</script>

<template>
  <div class="stored-findings">
    <FindingRows v-model:open="open">
      <FindingRow
        v-for="group in groups"
        :key="group.group"
        :value="group.group"
        :name="group.name"
        :count="group.count"
        :size="group.size"
        :ticked="ticked.includes(group.group)"
        @update:ticked="tick(group.group, $event)"
      >
        <FindingContents :group="group" />
      </FindingRow>
    </FindingRows>
    <div class="foot">
      <p class="screens-line">
        {{ screensLine(groups, ticked) }}
      </p>
      <Button variant="primary" :disabled="tickedGroups.length === 0" @click="asking = true">
        {{ label }}
      </Button>
    </div>
    <Confirmation v-model:open="asking" :title="`${label}?`" confirm-label="Clean up" :action="cleanUpTicked">
      <template #lost>
        <template v-for="line in lostLines(tickedGroups)" :key="line">
          <span class="line">{{ line }}</span>{{ ' ' }}
        </template>
      </template>
      <template #stays>
        <template v-for="line in staysLines(groups, ticked)" :key="line">
          <span class="line">{{ line }}</span>{{ ' ' }}
        </template>
      </template>
    </Confirmation>
  </div>
</template>

<style scoped>
@layer components {
  .stored-findings {
    border-top: var(--rule);
  }

  .foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3) var(--space-6);
    margin-top: var(--space-4);
  }

  .screens-line {
    max-width: var(--measure);
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
    text-wrap: pretty;
  }

  .foot .button {
    margin-left: auto;
  }

  .line {
    display: block;
  }
}
</style>
