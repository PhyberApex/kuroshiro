/** Work run one at a time per key: each `run` waits until the key's earlier work has settled. Keys run independently. */
export class OneAtATime {
  private readonly locks = new Map<string, Promise<unknown>>()

  /** `work` run once the key's earlier work has settled; without a key it runs straight away. */
  async run<T>(key: string | undefined, work: () => Promise<T>): Promise<T> {
    if (!key)
      return work()
    const current = (this.locks.get(key) ?? Promise.resolve()).then(work)
    const settled = current.catch(() => {})
    this.locks.set(key, settled)
    try {
      return await current
    }
    finally {
      if (this.locks.get(key) === settled)
        this.locks.delete(key)
    }
  }
}
