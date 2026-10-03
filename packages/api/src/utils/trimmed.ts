import type { TransformFnParams } from 'class-transformer'

/** For `@Transform(trimmed)`: trims a string, so `@IsNotEmpty()` refuses one that is only whitespace. */
export function trimmed({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value
}
