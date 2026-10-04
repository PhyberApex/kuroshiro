import type { PreviewInput, PreviewOutcome } from './templatePreview'
import { onScopeDispose, shallowRef, watch } from 'vue'

/** How long the typing has to pause before the Template is drawn again. */
const DRAWN_AFTER_MS = 300

/** How long the typing has to pause before a problem is shown, so that a tag that is half typed is not called one. */
const PROBLEM_AFTER_MS = 700

type ShownProblem = Extract<PreviewOutcome, { problem: unknown }>

/** What decides a drawing: the Template as typed and, compared as text, what it is drawn with and for. */
export interface PreviewSource extends PreviewInput {
  render: (input: PreviewInput) => Promise<PreviewOutcome>
}

/**
 * The preview's drawing as the form stands: the Template is drawn 300 ms after the last keystroke and at once when
 * anything else changes. A problem is shown 700 ms after the last keystroke and leaves with the first drawing that works;
 * the document of the last one that worked stays.
 */
export function useTemplatePreview(source: () => PreviewSource | undefined) {
  const document = shallowRef<string | null>(null)
  const problem = shallowRef<ShownProblem | null>(null)

  let found: ShownProblem | null = null
  let typing = false
  let latestDraw = 0
  let drawTimer: ReturnType<typeof setTimeout> | undefined
  let problemTimer: ReturnType<typeof setTimeout> | undefined

  async function draw() {
    const { render, ...input } = source() ?? {}
    if (!render)
      return
    const mine = ++latestDraw
    const outcome = await render(input as PreviewInput)
    if (mine !== latestDraw)
      return
    if ('document' in outcome) {
      document.value = outcome.document
      found = null
      problem.value = null
    }
    else {
      found = outcome
      if (!typing)
        problem.value = outcome
    }
  }

  function stopTimers() {
    clearTimeout(drawTimer)
    clearTimeout(problemTimer)
  }

  function drawOnceTypingPauses() {
    typing = true
    stopTimers()
    drawTimer = setTimeout(draw, DRAWN_AFTER_MS)
    problemTimer = setTimeout(() => {
      typing = false
      problem.value = found
    }, PROBLEM_AFTER_MS)
  }

  function drawAtOnce(another: boolean) {
    typing = false
    stopTimers()
    // The problem of the Template that leaves names a line of that one.
    if (another)
      problem.value = null
    void draw()
  }

  const drawnWith = (now: PreviewSource | undefined) => now && JSON.stringify([now.size, now.context, now.target])

  watch(source, (now, before) => {
    if (!now)
      return
    if (before && drawnWith(now) === drawnWith(before)) {
      if (now.markup !== before.markup)
        drawOnceTypingPauses()
    }
    else {
      drawAtOnce(now.size !== before?.size)
    }
  }, { immediate: true })

  onScopeDispose(stopTimers)

  return { document, problem }
}
