import { Buffer } from 'node:buffer'

const CENTRAL_HEADER_SIGNATURE = Buffer.from('PK\x01\x02', 'latin1')
const CENTRAL_HEADER_LENGTH = 46
const UNCOMPRESSED_SIZE_OFFSET = 24
const NAME_LENGTH_OFFSET = 28

/**
 * A copy of `zip` whose central directory declares `bytes` as the inflated size of `entryName`, as an
 * entry that tells the truth about a huge size does, without the test having to build that much data.
 */
export function declaringSize(zip: Buffer, entryName: string, bytes: number): Buffer {
  const copy = Buffer.from(zip)
  for (let at = copy.indexOf(CENTRAL_HEADER_SIGNATURE); at >= 0; at = copy.indexOf(CENTRAL_HEADER_SIGNATURE, at + 1)) {
    const nameStart = at + CENTRAL_HEADER_LENGTH
    if (copy.toString('utf8', nameStart, nameStart + copy.readUInt16LE(at + NAME_LENGTH_OFFSET)) === entryName) {
      copy.writeUInt32LE(bytes, at + UNCOMPRESSED_SIZE_OFFSET)
      return copy
    }
  }
  throw new Error(`${entryName} is not in the zip`)
}
