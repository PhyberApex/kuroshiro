import { promises as fs } from 'node:fs'

/** When `filePath` was last written, straight off the filesystem — callers that need this already know the file exists. */
export async function fileModifiedAt(filePath: string): Promise<Date> {
  const stats = await fs.stat(filePath)
  return stats.mtime
}
