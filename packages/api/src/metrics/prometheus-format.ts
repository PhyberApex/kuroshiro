export interface MetricSample {
  labels: Record<string, string>
  value: number
}

export interface MetricFamily {
  name: string
  help: string
  type: 'gauge'
  samples: MetricSample[]
}

function escapeLabelValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
}

function formatLabels(labels: Record<string, string>): string {
  const entries = Object.entries(labels)
  if (entries.length === 0)
    return ''
  return `{${entries.map(([key, value]) => `${key}="${escapeLabelValue(value)}"`).join(',')}}`
}

function renderFamily(family: MetricFamily): string {
  const lines = [
    `# HELP ${family.name} ${family.help}`,
    `# TYPE ${family.name} ${family.type}`,
    ...family.samples.map(sample => `${family.name}${formatLabels(sample.labels)} ${sample.value}`),
  ]
  return `${lines.join('\n')}\n`
}

/** Renders metric families in the Prometheus text exposition format — `# HELP`/`# TYPE` lines always present, one sample line per `MetricSample`, even for a family with none. */
export function renderPrometheusText(families: MetricFamily[]): string {
  return families.map(renderFamily).join('')
}
