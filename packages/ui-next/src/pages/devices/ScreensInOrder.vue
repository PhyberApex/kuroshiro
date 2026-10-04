<script setup lang="ts">
import type { DeviceDetail, ScreenRead } from 'kuroshiro-shared'
import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { imageUrl } from '@/api/client'
import { reorderScreens } from '@/api/screens'
import Button from '@/components/Button.vue'
import EmptyState from '@/components/EmptyState.vue'
import Plate from '@/components/Plate.vue'
import SaveState from '@/components/SaveState.vue'
import ScreenRow from '@/components/ScreenRow.vue'
import { isPassedOver, movedBy, SCREEN_KIND_LABELS } from '@/components/screenRows'
import ScreenRows from '@/components/ScreenRows.vue'
import { useSaveAsChanged } from '@/components/useSaveAsChanged'
import { useDeviceFrame } from './deviceFrame'
import { addScreenPath, deviceSettingsPath } from './devicePaths'
import OpenedScreen from './OpenedScreen.vue'
import ScheduleSummary from './ScheduleSummary.vue'
import { possessive, screenName } from './screenNaming'
import ScreenRemoval from './ScreenRemoval.vue'
import ScreenRename from './ScreenRename.vue'
import ScreenSource from './ScreenSource.vue'
import { screenStateWords } from './screenWording'
import { linkTo, sentence } from './sentence'
import SentenceLine from './SentenceLine.vue'

const props = defineProps<{
  device: DeviceDetail
  /** The Device's Screens in Order, as the server has them. */
  screens: ScreenRead[]
  /** Reads the Screens again, after the Order has changed. */
  reload: () => Promise<void>
}>()

/** From this many Screens on the heading counts them, and an opened row can jump to the top and to the end of the Order. */
const MANY_SCREENS = 9

const route = useRoute()
const router = useRouter()

/** The Order the admin put the rows in, until the server's answer holds it. */
const entered = ref<string[]>()

function inEnteredOrder(screens: ScreenRead[], ids: string[] | undefined) {
  if (!ids)
    return screens
  const byId = new Map(screens.map(screen => [screen.id, screen]))
  return [...ids.flatMap(id => byId.get(id) ?? []), ...screens.filter(screen => !ids.includes(screen.id))]
}

const isMany = computed(() => props.screens.length >= MANY_SCREENS)

const rows = computed(() => inEnteredOrder(props.screens, entered.value).map(screen => ({
  ...screen,
  name: screenName(screen.name),
  savedName: screen.name,
  stateWords: screenStateWords(screen, props.device),
})))

const orderSave = useSaveAsChanged(async (ids) => {
  if (!ids)
    return
  await reorderScreens(props.device.id, { screenIds: ids })
  await props.reload()
  if (entered.value === ids)
    entered.value = undefined
}, entered)

// A save that failed puts the rows back where the server has them.
watch(() => orderSave.status, (status) => {
  if (status === 'failed')
    entered.value = undefined
})

function reorder(ids: string[]) {
  entered.value = ids
  orderSave.commit()
}

function move(id: string, by: number) {
  reorder(movedBy(rows.value.map(screen => screen.id), id, by))
}

const open = computed({
  get: () => typeof route.query.screen === 'string' ? route.query.screen : undefined,
  set: id => void router.replace({ query: { ...route.query, screen: id || undefined } }),
})

/** The Screen whose name is being edited in its row. */
const renaming = ref<string>()

watch(open, () => {
  renaming.value = undefined
})

function setRenaming(screenId: string, isRenaming: boolean) {
  renaming.value = isRenaming ? screenId : undefined
}

/** The Screens changed since their image was rendered, each with when that image was rendered. */
const outdatedImages = ref<Record<string, string | null>>({})

function awaitRendering(screen: ScreenRead) {
  outdatedImages.value = { ...outdatedImages.value, [screen.id]: screen.renderedAt }
}

const isOutdated = (screen: ScreenRead) => screen.id in outdatedImages.value && outdatedImages.value[screen.id] === screen.renderedAt

const frame = useDeviceFrame()
const heading = useTemplateRef('heading')

/** The Device counts its Screens, so it is read again too. The removed row held the focus, which the heading takes. */
async function showWithout() {
  await Promise.all([props.reload(), frame.device.reload()])
  await nextTick()
  heading.value?.focus()
}

const rowId = (screenId: string) => `screen-${screenId}`

onMounted(() => {
  if (open.value)
    document.getElementById(rowId(open.value))?.scrollIntoView()
})

const pausedNote = computed(() => sentence(
  'Rotation is paused while Mirroring is on. These Screens are kept and can still be edited; they return when you switch Mirroring off in ',
  linkTo('Settings', deviceSettingsPath(props.device.id)),
  '.',
))
</script>

<template>
  <EmptyState v-if="screens.length === 0" class="no-screens" :title="`Add ${possessive(device.name)} first Screen`">
    A Screen is one thing the Device shows: a Plugin, a Mashup, an image from a link or a file, or HTML you write. With more than one, {{ device.name }} steps through them in Order, one per poll.
    <template #action>
      <Button as-child variant="primary">
        <RouterLink :to="addScreenPath(device.id)">
          Add Screen
        </RouterLink>
      </Button>
    </template>
  </EmptyState>
  <section v-else class="screens-in-order" aria-labelledby="screens-in-order-heading">
    <div class="heading-line">
      <h2 ref="heading" class="heading" tabindex="-1">
        <span id="screens-in-order-heading">Screens in Order</span> <span v-if="isMany" class="count">{{ screens.length }}</span>
      </h2>
      <SaveState :status="orderSave.status" :reason="orderSave.reason" @retry="orderSave.retry" />
    </div>
    <SentenceLine v-if="device.isMirrored" class="paused" :sentence="pausedNote" />
    <ScreenRows v-model:open="open" :items="rows" sortable @reorder="reorder">
      <template #default="{ item }">
        <ScreenRow
          :id="rowId(item.id)"
          class="row"
          :value="item.id"
          :name="item.name"
          :kind="SCREEN_KIND_LABELS[item.kind]"
          :state="item.state"
          :passed-over="device.isMirrored || undefined"
          :renaming="renaming === item.id"
        >
          <template v-if="item.kind !== 'plugin'" #rename>
            <ScreenRename :screen-id="item.id" :name="item.savedName" :reload="reload" :editing="renaming === item.id" @update:editing="isRenaming => setRenaming(item.id, isRenaming)" />
          </template>
          <template #thumbnail>
            <Plate
              :name="`${item.name}, as last rendered`"
              :src="item.imagePath && imageUrl(item.imagePath)"
              size="row"
              :width="device.deviceModel?.width"
              :height="device.deviceModel?.height"
              :passed-over="isPassedOver(item.state)"
              lazy
            />
          </template>
          <template #schedule>
            <ScheduleSummary :schedule="item.schedule" />
          </template>
          <template #state>
            <span>{{ item.stateWords.words }}<span v-if="item.stateWords.qualifier" class="qualifier"> · {{ item.stateWords.qualifier }}</span></span>
          </template>
          <OpenedScreen :screen="item" :screens="rows" :device="device" :jumps="isMany" :rendering="isOutdated(item)" @move="by => move(item.id, by)">
            <template #source>
              <ScreenSource :screen="item" :device="device" :reload="reload" @rerendering="awaitRendering(item)" />
            </template>
            <template v-if="item.kind !== 'plugin'" #actionsBefore>
              <Button variant="quiet" :disabled="renaming === item.id" @click="setRenaming(item.id, true)">
                Rename
              </Button>
            </template>
            <template #actionsAfter>
              <ScreenRemoval :screen="item" :device="device" @removed="showWithout" />
            </template>
          </OpenedScreen>
        </ScreenRow>
      </template>
    </ScreenRows>
  </section>
</template>

<style scoped>
@layer components {
  .no-screens,
  .screens-in-order {
    margin-top: var(--space-10);
  }

  .heading-line {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-2) var(--space-4);
    padding-bottom: var(--space-2);
    border-bottom: var(--rule-heavy);
  }

  .heading {
    font-stretch: var(--width-title);
    font-weight: var(--weight-title);
    font-size: var(--title-sm);
    line-height: var(--leading-title);
  }

  .count {
    margin-left: var(--space-1);
    color: var(--color-ink-soft);
    font-family: var(--font-mono);
    font-stretch: 100%;
    font-weight: var(--weight-regular);
    font-size: var(--text-sm);
  }

  .screens-in-order .paused {
    padding: var(--space-3) 0;
    border-bottom: var(--rule);
    color: var(--color-ink);
  }

  /* A row the address names is scrolled to, and stops below the bar. */
  .screens-in-order .row {
    scroll-margin-top: calc(var(--bar-height) + var(--space-4));
  }

  .qualifier {
    color: var(--color-ink-soft);
    font-weight: var(--weight-regular);
  }
}
</style>
