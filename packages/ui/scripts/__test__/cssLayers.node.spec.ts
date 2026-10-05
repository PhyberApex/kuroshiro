import { describe, expect, it } from 'vitest'
import { layerOrderProblem } from '../cssLayers.ts'

const STYLESHEET = '<link rel="stylesheet" crossorigin href="./assets/index-abc.css">'
const ORDER = '<style>@layer reset, base, components;</style>'

const page = (head: string) => `<!doctype html><html><head><meta charset="UTF-8">${head}</head><body></body></html>`

describe('the cascade layers of the built page', () => {
  it('accepts a page that declares the layer order before any stylesheet', () => {
    expect(layerOrderProblem(page(`${ORDER}${STYLESHEET}`))).toBeNull()
  })

  it('refuses a page that declares no layer order', () => {
    expect(layerOrderProblem(page(STYLESHEET))).toMatch(/does not declare/)
  })

  it('refuses a page whose first stylesheet comes before the layer order', () => {
    expect(layerOrderProblem(page(`${STYLESHEET}${ORDER}`))).toMatch(/before the layer order/)
  })

  it('refuses a layer order that does not put the components last', () => {
    expect(layerOrderProblem(page(`<style>@layer components, reset, base;</style>${STYLESHEET}`))).toMatch(/reset, base, components/)
  })
})
