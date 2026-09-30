import { describe, expect, it } from 'vitest'
import { renderPrometheusText } from '../prometheus-format.js'

describe('renderPrometheusText', () => {
  it('renders HELP and TYPE lines followed by one line per sample', () => {
    const text = renderPrometheusText([
      {
        name: 'kuroshiro_device_battery_volts',
        help: 'Last reported battery voltage, in volts.',
        type: 'gauge',
        samples: [
          { labels: { device: 'Living Room', friendly_id: 'ABC123' }, value: 3.99 },
        ],
      },
    ])

    expect(text).toBe(
      '# HELP kuroshiro_device_battery_volts Last reported battery voltage, in volts.\n'
      + '# TYPE kuroshiro_device_battery_volts gauge\n'
      + 'kuroshiro_device_battery_volts{device="Living Room",friendly_id="ABC123"} 3.99\n',
    )
  })

  it('still renders HELP and TYPE lines for a family with no samples', () => {
    const text = renderPrometheusText([
      { name: 'kuroshiro_device_battery_volts', help: 'Volts.', type: 'gauge', samples: [] },
    ])

    expect(text).toBe(
      '# HELP kuroshiro_device_battery_volts Volts.\n'
      + '# TYPE kuroshiro_device_battery_volts gauge\n',
    )
  })

  it('escapes a backslash, double quote and newline in a label value', () => {
    const text = renderPrometheusText([
      {
        name: 'kuroshiro_device_battery_volts',
        help: 'Volts.',
        type: 'gauge',
        samples: [
          { labels: { device: 'Living "Room"\\den\nfloor 2', friendly_id: 'ABC123' }, value: 1 },
        ],
      },
    ])

    expect(text).toContain('device="Living \\"Room\\"\\\\den\\nfloor 2"')
  })

  it('joins multiple families with a blank separator', () => {
    const text = renderPrometheusText([
      { name: 'kuroshiro_a', help: 'A.', type: 'gauge', samples: [] },
      { name: 'kuroshiro_b', help: 'B.', type: 'gauge', samples: [] },
    ])

    expect(text).toBe(
      '# HELP kuroshiro_a A.\n'
      + '# TYPE kuroshiro_a gauge\n'
      + '# HELP kuroshiro_b B.\n'
      + '# TYPE kuroshiro_b gauge\n',
    )
  })
})
