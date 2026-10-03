import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp'
import { DataSource } from 'typeorm'
import { PGliteDriver } from 'typeorm-pglite'
import { Alert } from '../alerts/entities/alert.entity.js'
import { DeviceModel } from '../device-models/entities/device-model.entity.js'
import { Palette } from '../device-models/entities/palette.entity.js'
import { DeviceSensor } from '../device-sensors/entities/device-sensor.entity.js'
import { Device } from '../devices/devices.entity.js'
import { Firmware } from '../firmware/entities/firmware.entity.js'
import { LogEntry } from '../logs/logs.entity.js'
import { MashupConfiguration } from '../mashup/entities/mashup-configuration.entity.js'
import { MashupSlot } from '../mashup/entities/mashup-slot.entity.js'
import { DevicePlugin } from '../plugins/entities/device-plugin.entity.js'
import { PluginDataSource } from '../plugins/entities/plugin-data-source.entity.js'
import { PluginFieldValue } from '../plugins/entities/plugin-field-value.entity.js'
import { PluginField } from '../plugins/entities/plugin-field.entity.js'
import { PluginTemplate } from '../plugins/entities/plugin-template.entity.js'
import { Plugin } from '../plugins/entities/plugin.entity.js'
import { Schedule } from '../schedule/schedule.entity.js'
import { Screen } from '../screens/screens.entity.js'
import { InstanceSettings } from '../settings/entities/instance-settings.entity.js'

/**
 * A real Postgres (PGlite, in-process and in-memory) with the schema TypeORM
 * derives from the entities, for specs whose subject is what the database
 * does with a save: cascades, orphaned relations, unique constraints.
 */
export async function createTestDatabase(): Promise<DataSource> {
  const dataSource = new DataSource({
    type: 'postgres',
    driver: new PGliteDriver({ extensions: { uuid_ossp } }).driver,
    entities: [Device, DeviceModel, Palette, DeviceSensor, Screen, LogEntry, Plugin, DevicePlugin, PluginDataSource, PluginTemplate, PluginField, PluginFieldValue, MashupConfiguration, MashupSlot, Schedule, Firmware, Alert, InstanceSettings],
    synchronize: true,
  })
  return dataSource.initialize()
}
