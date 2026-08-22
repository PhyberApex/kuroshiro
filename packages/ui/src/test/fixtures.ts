import type { RenderTarget } from '@/utils/screenShell'

/**
 * The one documented boundary cast for the cross-package screen-shell golden fixture
 * (`test/fixtures/screen-shell.fixture.ts`), which is deliberately typed with only the
 * fields the shared renderer reads rather than a full `DeviceModel`/`Palette`.
 */
export function asRenderTarget(fixture: { model: object, palette: object }): RenderTarget {
  return fixture as unknown as RenderTarget
}
