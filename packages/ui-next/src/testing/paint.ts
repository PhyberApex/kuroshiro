function nextFrame() {
  return new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
}

/**
 * Resolves once a change made just now is laid out and painted. Two frames, because under
 * reduced motion every property still transitions for 0.01 ms and reads its old value in
 * the frame the change was made.
 */
export async function settled() {
  await nextFrame()
  await nextFrame()
}
