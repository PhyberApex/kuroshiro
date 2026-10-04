<script setup lang="ts">
import type { ScreenRead } from 'kuroshiro-shared'
import type { RowMenuItem } from './rowMenuItem'
import { ref } from 'vue'
import { screenArt } from '@/gallery/screenArt'
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import { buildSchedule, buildScreen } from '@/testing/fixtures/screens'
import InlineEdit from './InlineEdit.vue'
import Plate from './Plate.vue'
import RowMenu from './RowMenu.vue'
import ScreenRow from './ScreenRow.vue'
import { SCREEN_KIND_LABELS } from './screenRows'
import ScreenRows from './ScreenRows.vue'
import Switch from './Switch.vue'

const image = screenArt(800, 480)

const looks = ref<ScreenRead[]>([
  buildScreen({ id: 'calendar', name: 'Calendar', state: 'active' }),
  buildScreen({ id: 'weather', name: 'Weather', state: 'upNext', schedule: buildSchedule() }),
  buildScreen({ id: 'weekend', name: 'Weekend board', kind: 'mashup', state: 'scheduleOff', schedule: buildSchedule({ enabled: false, weekdays: [0, 6], startTime: null, endTime: null }) }),
  buildScreen({ id: 'trains', name: 'Train departures', state: 'skipping' }),
  buildScreen({ id: 'photo', name: 'Photo of the week', kind: 'file', state: 'notToday', schedule: buildSchedule({ weekdays: [0] }) }),
  buildScreen({ id: 'notes', name: 'Notes', kind: 'html', imagePath: null }),
])

const held = looks.value.slice(1, 4)
const FORCED: Record<string, 'hover' | 'focus'> = { weather: 'hover', weekend: 'focus' }
const openHeld = ref('trains')

const mirrored = looks.value.slice(0, 2).map(screen => ({ ...screen, state: null }))

const dragged = looks.value.slice(0, 4).map(screen => ({ ...screen, state: null }))

const renamed = looks.value.slice(4, 5)

const sources = [
  { id: 'forecast', name: 'forecast' },
  { id: 'pollen', name: 'pollen' },
]
function sourceActions(name: string): RowMenuItem[] {
  return [
    { label: `Fetch ${name} now`, select: () => {} },
    { label: 'Remove', select: () => {}, ruleAbove: true },
  ]
}

const hours = (screen: ScreenRead) => screen.schedule?.startTime ? `${screen.schedule.startTime}–${screen.schedule.endTime}` : 'all day'
</script>

<template>
  <SpecimenRow title="Looks">
    <Specimen caption="Active Screen · Up next · Schedule off · Skipping · passed over (Not today) · no state, never rendered" wide>
      <ScreenRows class="stretch" :items="looks" sortable @reorder="ids => looks = ids.map(id => looks.find(screen => screen.id === id)!)">
        <template #default="{ item }">
          <ScreenRow :value="item.id" :name="item.name" :kind="SCREEN_KIND_LABELS[item.kind]" :state="item.state">
            <template #thumbnail="{ active, passedOver }">
              <Plate :name="item.name" :src="item.imagePath && image" size="row" :sealed="active" :passed-over="passedOver" lazy />
            </template>
            <template #schedule>
              <template v-if="item.schedule">
                <Switch :model-value="item.schedule.enabled" :aria-label="`Schedule of ${item.name}`" />
                <span class="summary" :class="{ off: !item.schedule.enabled }">{{ hours(item) }}</span>
              </template>
              <span v-else class="summary">Always shown</span>
            </template>
            <p class="why">
              What {{ item.name }} is and why it is or is not showing.
            </p>
          </ScreenRow>
        </template>
      </ScreenRows>
    </Specimen>
    <Specimen caption="hover · focus · open" wide>
      <ScreenRows v-model:open="openHeld" class="stretch" :items="held" sortable>
        <template #default="{ item }">
          <ScreenRow :value="item.id" :name="item.name" :kind="SCREEN_KIND_LABELS[item.kind]" :state="item.state" :force="FORCED[item.id]">
            <template #thumbnail="{ passedOver }">
              <Plate :name="item.name" :src="image" size="row" :passed-over="passedOver" lazy />
            </template>
            <p class="why">
              Skipping: this Screen's own content asked to be left out of Rotation for now. It returns by itself when the content changes.
            </p>
          </ScreenRow>
        </template>
      </ScreenRows>
    </Specimen>
    <Specimen caption="a qualifier beside the Screen State · a mirrored Device: no state, the names passed over" wide>
      <ScreenRows class="stretch" :items="mirrored" sortable>
        <template #default="{ item, order }">
          <ScreenRow :value="item.id" :name="item.name" :kind="SCREEN_KIND_LABELS[item.kind]" :state="order === 1 ? 'active' : null" :passed-over="order === 2">
            <template #thumbnail="{ active }">
              <Plate :name="item.name" :src="image" size="row" :sealed="active" lazy />
            </template>
            <template v-if="order === 1" #state>
              <span>Active Screen <span class="qualifier">· holding image</span></span>
            </template>
          </ScreenRow>
        </template>
      </ScreenRows>
    </Specimen>
  </SpecimenRow>
  <SpecimenRow title="Reordering">
    <Specimen caption="lifted by its grip, with the line where it will land: after Train departures" wide>
      <ScreenRows class="stretch" :items="dragged" sortable :force="{ lifted: 'weather', dropAfter: 'trains' }">
        <template #default="{ item }">
          <ScreenRow :value="item.id" :name="item.name" :kind="SCREEN_KIND_LABELS[item.kind]">
            <template #thumbnail>
              <Plate :name="item.name" :src="image" size="row" lazy />
            </template>
          </ScreenRow>
        </template>
      </ScreenRows>
    </Specimen>
    <Specimen caption="lifted by keyboard; the line before Calendar is where a pointer would land it" wide>
      <ScreenRows class="stretch" :items="dragged" sortable :force="{ lifted: 'weekend', by: 'keyboard', dropBefore: 'calendar' }">
        <template #default="{ item }">
          <ScreenRow :value="item.id" :name="item.name" :kind="SCREEN_KIND_LABELS[item.kind]">
            <template #thumbnail>
              <Plate :name="item.name" :src="image" size="row" lazy />
            </template>
          </ScreenRow>
        </template>
      </ScreenRows>
    </Specimen>
  </SpecimenRow>
  <SpecimenRow title="Renaming">
    <Specimen caption="the Inline edit in the place of the name and the kind" wide>
      <ScreenRows class="stretch" :items="renamed" sortable>
        <template #default="{ item }">
          <ScreenRow :value="item.id" :name="item.name" :kind="SCREEN_KIND_LABELS[item.kind]" :state="item.state" renaming>
            <template #thumbnail="{ passedOver }">
              <Plate :name="item.name" :src="image" size="row" :passed-over="passedOver" lazy />
            </template>
            <template #rename>
              <InlineEdit editing :value="item.name" :label="`Name of ${item.name}`" />
            </template>
            <template #schedule>
              <span class="summary">{{ hours(item) }}</span>
            </template>
          </ScreenRow>
        </template>
      </ScreenRows>
    </Specimen>
  </SpecimenRow>
  <SpecimenRow title="A list without images or an Order">
    <Specimen caption="the same row, with a control of its own that does not open it" wide>
      <ScreenRows class="stretch" :items="sources">
        <template #default="{ item }">
          <ScreenRow :value="item.id" :name="item.name" kind="Polling every 15 min">
            <template #schedule>
              <RowMenu :label="`More actions for ${item.name}`" :items="sourceActions(item.name)" />
            </template>
            <p class="why">
              https://api.example.com/{{ item.name }}
            </p>
          </ScreenRow>
        </template>
      </ScreenRows>
    </Specimen>
  </SpecimenRow>
</template>

<style scoped>
@layer components {
  .stretch {
    justify-self: stretch;
    min-width: 0;
  }

  .summary {
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }

  .summary.off {
    text-decoration: line-through;
  }

  .qualifier {
    color: var(--color-ink-soft);
    font-weight: var(--weight-regular);
  }

  .why {
    max-width: var(--measure);
    color: var(--color-ink-soft);
  }
}
</style>
