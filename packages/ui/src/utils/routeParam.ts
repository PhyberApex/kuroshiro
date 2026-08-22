type RouteParamLike = string | null | undefined | Array<string | null>

export function routeParam(value: RouteParamLike): string | undefined {
  const first = Array.isArray(value) ? value[0] : value
  return first ?? undefined
}
