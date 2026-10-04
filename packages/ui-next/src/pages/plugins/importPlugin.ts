import type { ApiErrorCode, PluginImportResult, PluginSummary } from 'kuroshiro-shared'
import type { CarriedDevice } from './addPlugin'
import type { PluginArrival } from './pluginArrival'
import type { Sentence } from '@/pages/devices/sentence'
import { recipeIdOf } from 'kuroshiro-shared'
import { nextTick, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { isRefusal } from '@/api/client'
import { NOT_A_RECIPE } from '@/api/refusalWording'
import { failureReason } from '@/components/failureReason'
import { linkTo, sentence } from '@/pages/devices/sentence'
import { useAddPluginPage } from './addPluginPage'
import { openPluginPage } from './pluginArrival'
import { pluginPath } from './pluginPaths'

/** What is wrong with a Recipe as entered, or nothing when its id can be read. */
export function recipeProblem(entered: string) {
  if (!entered.trim())
    return 'Enter a Recipe\'s address or its id.'
  return recipeIdOf(entered) ? undefined : NOT_A_RECIPE
}

/** The Plugins that came from the Recipe, as the sentence under the Recipe field; none, no sentence. */
export function importedBefore(plugins: Pick<PluginSummary, 'id' | 'name'>[]): Sentence {
  if (plugins.length === 0)
    return []
  const names = plugins.flatMap((plugin, index) => [
    ...(index === 0 ? [] : [index === plugins.length - 1 ? ' and ' : ', ']),
    linkTo(plugin.name, pluginPath(plugin.id)),
  ])
  return sentence('You already have ', ...names, ` from this Recipe. Importing makes ${plugins.length === 1 ? 'a second' : 'another'} Plugin.`)
}

/** How one way of importing words what kept it from importing. */
export interface ImportWording {
  /** The site the way downloads from, named when it does not answer: "trmnl.com". A way that downloads nothing leaves it out. */
  upstream?: string
  /** The refusals that are about what was entered: each with its sentence for this way, or `true` where the refusal's own wording stands. */
  entered: Partial<Record<ApiErrorCode, string | true>>
}

/** Why nothing was imported, by where the form says it. */
export interface ImportTrouble {
  /** Under the field: what was entered cannot be imported. */
  entered?: string
  /** As a notice with "Try again": the site did not answer. */
  unanswered?: string
  /** In the foot: anything else. */
  failure?: string
}

export function importTrouble(error: unknown, { upstream, entered }: ImportWording): ImportTrouble {
  if (isRefusal(error)) {
    const wording = entered[error.code]
    if (wording)
      return { entered: wording === true ? error.message : wording }
    if (upstream && error.code === 'upstream-unreachable')
      return { unanswered: `${upstream} did not answer.` }
  }
  return { failure: `Not imported. ${failureReason(error) ?? 'Something went wrong.'}` }
}

export function importArrival({ origin, hasTransform }: PluginImportResult, device?: CarriedDevice): PluginArrival {
  const name = origin.type === 'recipe' ? origin.name : origin.type === 'file' ? origin.fileName : origin.repository
  return { how: 'imported', origin: origin.type, name, hasTransform, device }
}

/** What the forms of the three ways of importing share: the import under way, its trouble, and the Plugin's page once it worked. */
export function useImportPlugin(wording: ImportWording) {
  const router = useRouter()
  const { device } = useAddPluginPage()
  const importing = ref(false)
  const imported = ref(false)
  const trouble = ref<ImportTrouble>({})

  /** Sends the import, handed the id of the carried Device, and opens the imported Plugin's page. */
  async function run(send: (deviceId?: string) => Promise<PluginImportResult>) {
    trouble.value = {}
    importing.value = true
    try {
      const result = await send(device.value?.id)
      imported.value = true
      await nextTick()
      await openPluginPage(router, result.plugin.id, importArrival(result, device.value))
    }
    catch (error) {
      trouble.value = importTrouble(error, wording)
    }
    finally {
      importing.value = false
    }
  }

  /** What was entered is refused before anything is sent. */
  function refuse(entered: string) {
    trouble.value = { entered }
  }

  function clear() {
    trouble.value = {}
  }

  return reactive({ importing, imported, trouble, run, refuse, clear })
}
