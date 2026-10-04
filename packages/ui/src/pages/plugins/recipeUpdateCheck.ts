import type { RecipeUpdatePreview } from 'kuroshiro-shared'
import { computed, reactive, ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import { isRefusal } from '@/api/client'
import { applyRecipeUpdate, checkRecipeUpdate } from '@/api/plugins'
import { failureReason } from '@/components/failureReason'
import { openPluginPage } from './pluginArrival'
import { checkedByDefault, checkFailure, updateItemId } from './recipeUpdate'

type CheckState
  = | { step: 'running' }
    | { step: 'failed', reason?: string }
    | { step: 'notFromRecipe' }
    | { step: 'checked', preview: RecipeUpdatePreview }

/**
 * The Recipe Update Check of one Plugin: `run()` downloads and compares, `checked` holds which Update Items are
 * ticked, and `apply()` and `skipAll()` send them and open the Plugin's page. When the Recipe moved in between,
 * the check runs again and `changedAgain` says so.
 */
export function useRecipeUpdateCheck(plugin: () => { id: string, name: string }) {
  const router = useRouter()
  const state = shallowRef<CheckState>({ step: 'running' })
  const checked = ref<Record<string, boolean>>({})
  const changedAgain = ref(false)
  const sending = ref<'apply' | 'skip'>()
  /** Why the last apply or skip was not done: a sentence, or nothing when the failure gave none. */
  const notSent = ref<{ reason?: string }>()

  const preview = computed(() => state.value.step === 'checked' ? state.value.preview : undefined)
  const chosen = computed(() => preview.value?.items.filter(item => checked.value[updateItemId(item)]) ?? [])

  async function run() {
    state.value = { step: 'running' }
    try {
      const answer = await checkRecipeUpdate(plugin().id)
      checked.value = checkedByDefault(answer.items)
      state.value = { step: 'checked', preview: answer }
    }
    catch (error) {
      state.value = isRefusal(error, 'plugin-not-from-recipe')
        ? { step: 'notFromRecipe' }
        : { step: 'failed', reason: checkFailure(error, plugin().name) }
    }
  }

  async function send(how: 'apply' | 'skip') {
    const { contentHash, items, recipe } = preview.value!
    const apply = how === 'apply' ? chosen.value.map(({ itemType, key }) => ({ itemType, key })) : []
    sending.value = how
    notSent.value = undefined
    try {
      await applyRecipeUpdate(plugin().id, { contentHash, apply })
      await openPluginPage(router, plugin().id, how === 'apply'
        ? { how: 'applied', updateItems: apply.length, recipe: recipe.name }
        : { how: 'skipped', updateItems: items.length, recipe: recipe.name })
    }
    catch (error) {
      if (isRefusal(error, 'recipe-changed')) {
        changedAgain.value = true
        await run()
      }
      else {
        notSent.value = { reason: failureReason(error) }
      }
    }
    finally {
      sending.value = undefined
    }
  }

  return reactive({
    state,
    checked,
    chosen,
    changedAgain,
    sending,
    notSent,
    run,
    apply: () => send('apply'),
    skipAll: () => send('skip'),
  })
}
