const KILOBYTE = 1024
const MEGABYTE = 1024 * KILOBYTE

/** A size as the admin reads it: "640 KB", "10 MB", "12.4 MB". */
export function formatBytes(bytes: number) {
  const kilobytes = Math.max(1, Math.round(bytes / KILOBYTE))
  return kilobytes < KILOBYTE
    ? `${kilobytes} KB`
    : `${Number((bytes / MEGABYTE).toFixed(1))} MB`
}

/** `['.png', '.jpg']` read aloud: "PNG or JPG". */
export function formatNames(accept: string[]) {
  return new Intl.ListFormat('en-GB', { type: 'disjunction' }).format(accept.map(ending => ending.replace(/^\./, '').toUpperCase()))
}

export interface FileRules {
  /** The file name endings that are taken, each with its dot. */
  accept: string[]
  maxBytes: number
  /** The accepted types as the admin reads them. */
  formats: string
}

/** Why a file is refused, or nothing when it is taken. The type is read off the file's name: the type a browser reports depends on the machine. */
export function refusalOf(file: Pick<File, 'name' | 'size'>, { accept, maxBytes, formats }: FileRules) {
  const name = file.name.toLowerCase()
  if (!accept.some(ending => name.endsWith(ending.toLowerCase())))
    return `${file.name} is not a ${formats} file.`
  if (file.size > maxBytes)
    return `${file.name} is ${formatBytes(file.size)}. The largest file allowed is ${formatBytes(maxBytes)}.`
  return undefined
}
