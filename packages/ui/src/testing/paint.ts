function nextFrame() {
  return new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
}

/**
 * A colour inherited from an element with a transition of its own starts a second transition
 * on the child when the parent's ends, so the last of them can end frames after the change.
 */
async function transitionsEnded(): Promise<void> {
  const running = document.getAnimations().filter(animation => animation instanceof CSSTransition)
  if (running.length === 0)
    return
  await Promise.allSettled(running.map(transition => transition.finished))
  await nextFrame()
  return transitionsEnded()
}

/**
 * Resolves once a change made just now is laid out and painted. Two frames, because under
 * reduced motion every property still transitions for 0.01 ms and reads its old value in
 * the frame the change was made; then for as long as a transition is still running.
 */
export async function settled() {
  await nextFrame()
  await nextFrame()
  await transitionsEnded()
}

function hasHorizontalScroller() {
  return Array.from(document.querySelectorAll('*')).some(el => el.scrollWidth > el.clientWidth)
}

/**
 * Resolves once no element's scroll position moves between two frames in a row, up to ten
 * frames. A nav row that scrolls a current link into view (`PageList`) does it from a
 * `ResizeObserver`, which reacts to a viewport resize on its own schedule: on a loaded CI
 * runner its callback can still be pending a few frames after a resize, so comparing right
 * away catches a read from before the callback ran rather than after — indistinguishable
 * from "already settled". Where the page holds nothing that overflows sideways (most shots),
 * there is nothing a callback could still be correcting, so that read is trusted at once, as
 * before. Where it does, a short unconditional wait first gives a late callback room to run
 * before the first reading is taken, so "no change since entry" means the scroll already
 * landed rather than that the observer has not fired yet.
 */
export async function scrollSettled() {
  const positions = () => Array.from(document.querySelectorAll('*'), el => el.scrollLeft).join(',')
  if (hasHorizontalScroller()) {
    for (let i = 0; i < 6; i++)
      await nextFrame()
  }
  let last = positions()
  for (let i = 0; i < 10; i++) {
    await nextFrame()
    const next = positions()
    if (next === last)
      return
    last = next
  }
}
