const fs = require('node:fs')
const path = require('node:path')
const process = require('node:process')
const { DataSource } = require('typeorm')

const migrationsDir = path.join(__dirname, '../dist/src/migrations')
const migrations = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith('.js'))
  .map(f => require(path.join(migrationsDir, f)))

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.KUROSHIRO_DB_HOST || 'localhost',
  port: Number.parseInt(process.env.KUROSHIRO_DB_PORT || '5432', 10),
  username: process.env.KUROSHIRO_DB_USER || 'root',
  password: process.env.KUROSHIRO_DB_PASSWORD || 'root',
  database: process.env.KUROSHIRO_DB_DB || 'test',
  migrations,
  migrationsTableName: 'migrations',
  logging: process.env.NODE_ENV !== 'production',
})

async function runMigrations() {
  try {
    console.log('🎀 initializing database connection...')
    await AppDataSource.initialize()

    console.log('✨ running migrations...')
    const executedMigrations = await AppDataSource.runMigrations({ transaction: 'all' })

    if (executedMigrations.length === 0) {
      console.log('💫 no pending migrations!')
    }
    else {
      console.log(`🌸 ran ${executedMigrations.length} migration(s):`)
      executedMigrations.forEach((migration) => {
        console.log(`  - ${migration.name}`)
      })
    }

    await AppDataSource.destroy()
    console.log('✅ migration complete!')
    process.exit(0)
  }
  catch (error) {
    console.error('❌ migration failed:', error)
    process.exit(1)
  }
}

runMigrations()
