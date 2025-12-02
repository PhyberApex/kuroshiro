import process from 'node:process'
import { DataSource } from 'typeorm'
import { Device } from '../devices/devices.entity'
import { LogEntry } from '../logs/logs.entity'
import { Screen } from '../screens/screens.entity'

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.KUROSHIRO_DB_HOST || 'localhost',
  port: Number.parseInt(process.env.KUROSHIRO_DB_PORT || '5432', 10),
  username: process.env.KUROSHIRO_DB_USER || 'root',
  password: process.env.KUROSHIRO_DB_PASSWORD || 'root',
  database: process.env.KUROSHIRO_DB_DB || 'test',
  entities: [Device, Screen, LogEntry],
  migrations: ['dist/src/migrations/*.js'],
  migrationsTableName: 'migrations',
  synchronize: false,
  logging: process.env.NODE_ENV !== 'production',
})

export default AppDataSource
