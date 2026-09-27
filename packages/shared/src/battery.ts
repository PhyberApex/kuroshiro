/**
 * Linear 3.0V (0%) to 4.2V (100%) mapping, clamped at both ends.
 * `undefined` for a missing or unparsable voltage — callers decide how to
 * render or evaluate that (ADR-0020: the UI and the Alert Sweep must agree).
 */
export function batteryPercentFromVoltage(voltage: string | undefined): number | undefined {
  if (!voltage)
    return undefined
  const parsed = Number.parseFloat(voltage)
  if (Number.isNaN(parsed))
    return undefined
  if (parsed >= 4.2)
    return 100
  if (parsed <= 3.0)
    return 0
  return Math.round((parsed - 3.0) / 0.012)
}
