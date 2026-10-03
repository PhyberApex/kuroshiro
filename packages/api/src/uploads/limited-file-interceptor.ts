import type { CallHandler, ExecutionContext, NestInterceptor, Type } from '@nestjs/common'
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface.js'
import type { Observable } from 'rxjs'
import { Injectable, PayloadTooLargeException } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiException } from '../errors/api.exception.js'

export function uploadTooLarge(limitBytes: number): ApiException {
  return new ApiException(413, 'upload-too-large', `The upload is larger than ${limitBytes} bytes.`, { limitBytes })
}

/** A `FileInterceptor` that refuses a file over `limitBytes` with 413 `upload-too-large` and the limit in `details`. */
export function LimitedFileInterceptor(fieldName: string, limitBytes: number, options: MulterOptions = {}): Type<NestInterceptor> {
  const FileUpload = FileInterceptor(fieldName, { ...options, limits: { ...options.limits, fileSize: limitBytes } })

  @Injectable()
  class LimitedFileUpload extends FileUpload {
    async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
      try {
        return await super.intercept(context, next)
      }
      catch (error) {
        throw error instanceof PayloadTooLargeException ? uploadTooLarge(limitBytes) : error
      }
    }
  }
  return LimitedFileUpload
}
