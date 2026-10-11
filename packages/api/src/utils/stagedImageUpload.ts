import type { Logger } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'

export interface StagedImagePaths { originalPath: string, imagePath: string }

/** Deletes a file if it is there; a file already gone is not an error. */
export async function deleteFileIfExists(filePath: string, logger: Logger): Promise<void> {
  try {
    await fs.promises.unlink(filePath)
    logger.log(`Deleted file: ${filePath}`)
  }
  catch (err) {
    const errno = err as NodeJS.ErrnoException
    if (errno.code !== 'ENOENT')
      logger.error(`Failed to delete file: ${filePath} - ${errno.message}`)
  }
}

/**
 * Where an image is written before it replaces what is finally stored at
 * `finalOriginalPath`/`finalImagePath`, so a failed fetch or conversion
 * leaves the stored one alone (a "staged replace").
 */
export function stageUpload(finalOriginalPath: string, finalImagePath: string, logger: Logger) {
  const token = randomUUID()
  const originalPath = path.join(path.dirname(finalOriginalPath), `${token}.staging.original`)
  const imagePath = path.join(path.dirname(finalImagePath), `${token}.staging.png`)
  const discard = async (): Promise<void> => {
    await deleteFileIfExists(originalPath, logger)
    await deleteFileIfExists(imagePath, logger)
  }
  return {
    originalPath,
    imagePath,
    discard,
    /** Runs `produce` against the staged paths and moves both files over the final ones on success. */
    store: async <T>(produce: (staged: StagedImagePaths) => Promise<T>): Promise<T> => {
      try {
        const result = await produce({ originalPath, imagePath })
        await fs.promises.rename(originalPath, finalOriginalPath)
        await fs.promises.rename(imagePath, finalImagePath)
        return result
      }
      catch (err) {
        await discard()
        throw err
      }
    },
  }
}
