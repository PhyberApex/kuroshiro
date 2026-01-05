import process from 'node:process'

export default () => ({
  port: Number.parseInt(process.env.KUROSHIRO_API_PORT, 10) || 3000,
  api_url: process.env.KUROSHIRO_API_URL || 'http://localhost:5173',
  demo_mode: process.env.KUROSHIRO_DEMO_MODE === 'true' || false,
  database: {
    host: process.env.KUROSHIRO_DB_HOST || 'localhost',
    port: Number.parseInt(process.env.KUROSHIRO_DB_PORT || '5432', 10),
    database: process.env.KUROSHIRO_DB_DB || 'test',
    user: process.env.KUROSHIRO_DB_USER || 'root',
    password: process.env.KUROSHIRO_DB_PASSWORD || 'root',
  },
})
