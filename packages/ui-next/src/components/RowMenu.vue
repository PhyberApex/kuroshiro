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
import { RouterLink } from 'vue-router'
import IconButton from './IconButton.vue'
import { OPTION_LIST_GAP, OPTION_LIST_LAYER } from './selectOption'
import SelectOptions from './SelectOptions.vue'

defineOptions({ inheritAttrs: false })

defineProps<{
  /** The name of the button that opens the menu: "More actions for Weather". */
  label: string
  /** Actions (`select`) and links (`to`), in the order they are listed. */
  items: RowMenuItem[]
  disabled?: boolean
}>()

// Also what a disabled link is drawn as: an item that leads nowhere, so a press cannot follow it.
function runAction(item: RowMenuItem) {
  if ('select' in item)
    item.select()
}
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger as-child :disabled="disabled">
      <IconButton v-bind="$attrs" icon="more" :label="label" :disabled="disabled" />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        align="end"
        :side-offset="OPTION_LIST_GAP"
        :collision-padding="8"
        :style="OPTION_LIST_LAYER"
      >
        <SelectOptions prose>
          <template v-for="item in items" :key="item.label">
            <DropdownMenuSeparator v-if="item.ruleAbove" class="rule" />
            <DropdownMenuItem v-if="'to' in item && !item.disabled" as-child>
              <RouterLink class="option" :to="item.to">
                {{ item.label }}
              </RouterLink>
            </DropdownMenuItem>
            <DropdownMenuItem v-else class="option" :disabled="item.disabled" @select="runAction(item)">
              {{ item.label }}
            </DropdownMenuItem>
          </template>
        </SelectOptions>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
