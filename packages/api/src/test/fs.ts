/** The one documented boundary cast: `Express.Multer.File` carries a dozen disk-storage/stream fields no spec in this codebase reads — only the ones a test provides are populated. */
export function makeMulterFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'upload.bin',
    encoding: '7bit',
    mimetype: 'application/octet-stream',
    size: 0,
    ...overrides,
  } as Express.Multer.File
}
