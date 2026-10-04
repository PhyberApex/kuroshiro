<script setup lang="ts">
import type { RowMenuItem } from './rowMenuItem'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'reka-ui'
import { useId } from 'vue'
import { RouterLink } from 'vue-router'
import IconButton from './IconButton.vue'
import { OPTION_LIST_GAP, OPTION_LIST_LAYER } from './selectOption'
import SelectOptions from './SelectOptions.vue'

defineOptions({ inheritAttrs: false })

defineProps<{
  /** The name of the button that opens the menu: "More actions for Weather". With a button of its own in `#trigger`, that button's words name it. */
  label: string
  /** Actions (`select`) and links (`to`), in the order they are listed. */
  items: RowMenuItem[]
  disabled?: boolean
}>()

defineSlots<{
  /** One button in place of the more icon, for a menu that is opened by its words: "Add a template". */
  trigger?: () => unknown
}>()

const hintIdPrefix = useId()
const hintId = (item: RowMenuItem, index: number) => item.hint ? `${hintIdPrefix}-hint-${index}` : undefined

let afterClose: (() => void) | undefined

// Also what a disabled link is drawn as: an item that leads nowhere, so a press cannot follow it.
function runAction(item: RowMenuItem) {
  if (!('select' in item))
    return
  afterClose = item.afterClose
  item.select()
}

function leaveFocusToAction(event: Event) {
  if (!afterClose)
    return
  event.preventDefault()
  afterClose()
  afterClose = undefined
}
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger as-child :disabled="disabled">
      <slot name="trigger">
        <IconButton v-bind="$attrs" icon="more" :label="label" :disabled="disabled" />
      </slot>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        align="end"
        :side-offset="OPTION_LIST_GAP"
        :collision-padding="8"
        :style="OPTION_LIST_LAYER"
        @close-auto-focus="leaveFocusToAction"
      >
        <SelectOptions prose>
          <template v-for="(item, index) in items" :key="item.label">
            <DropdownMenuSeparator v-if="item.ruleAbove" class="rule" />
            <DropdownMenuItem v-if="'to' in item && !item.disabled" as-child>
              <RouterLink class="option" :to="item.to">
                {{ item.label }}
              </RouterLink>
            </DropdownMenuItem>
            <DropdownMenuItem
              v-else
              class="option"
              :disabled="item.disabled"
              :aria-label="item.hint ? item.label : undefined"
              :aria-describedby="hintId(item, index)"
              @select="runAction(item)"
            >
              {{ item.label }}
              <span v-if="item.hint" :id="hintId(item, index)" class="hint">{{ item.hint }}</span>
            </DropdownMenuItem>
          </template>
        </SelectOptions>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
