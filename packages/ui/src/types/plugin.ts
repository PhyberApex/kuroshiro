export interface Plugin {
  id: string
  name: string
  description?: string
  kind: string
  refreshInterval: number
  createdAt: Date
  updatedAt: Date
  dataSource?: PluginDataSource
  templates?: PluginTemplate[]
  fields?: PluginField[]
  deviceAssignments?: DeviceAssignment[]
  // Used when fetching by device
  _devicePluginId?: string
  _isActive?: boolean
  _order?: number
}

export interface DeviceAssignment {
  id: string
  isActive: boolean
  order: number
  device: {
    id: string
    name: string
  }
}

export interface PluginDataSource {
  id: string
  method: string
  url: string
  headers?: Record<string, string>
  body?: Record<string, any>
  transformJs?: string
}

export interface PluginTemplate {
  id: string
  layout: string
  liquidMarkup: string
  lastRenderedAt?: Date
}

export interface PluginField {
  id: string
  keyname: string
  fieldType: string
  name: string
  description?: string
  defaultValue?: string
  required: boolean
  order: number
  value?: PluginFieldValue
}

export interface PluginFieldValue {
  id: string
  value: string
  deviceId?: string
}
