const express = require('express')
const { Pool } = require('pg')
const redis = require('redis')
const promClient = require('prom-client')

const app = express()
app.use(express.json())

/* ===========================
   PROMETHEUS METRICS SETUP
=========================== */

// registry khusus (best practice, biar modular)
const register = new promClient.Registry()

// default metrics (CPU, memory, event loop, dll)
promClient.collectDefaultMetrics({ register })

// custom metric: jumlah request
const httpRequestCounter = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register]
})

// custom metric: durasi request
const httpDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route'],
  buckets: [0.1, 0.3, 0.5, 1, 2, 5],
  registers: [register]
})

// middleware metrics
app.use((req, res, next) => {
  const end = httpDuration.startTimer({
    method: req.method,
    route: req.path
  })

  res.on('finish', () => {
    httpRequestCounter.inc({
      method: req.method,
      route: req.path,
      status: res.statusCode
    })
    end()
  })

  next()
})

// endpoint metrics (buat Prometheus scrape)
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType)
  res.end(await register.metrics())
})

/* ===========================
   DATABASE & REDIS
=========================== */

// PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
})

// Redis
const redisClient = redis.createClient({
  url: process.env.REDIS_URL
})

redisClient.connect().catch(console.error)

/* ===========================
   ROUTES
=========================== */

// root
app.get('/', async (req, res) => {
  res.json({ status: 'ok', message: 'Hello dari Docker Compose!' })
})

// health check
app.get('/health', async (req, res) => {
  if (!process.env.DATABASE_URL || !process.env.REDIS_URL) {
    return res.json({ healthy: true })
  }

  try {
    await pool.query('SELECT 1')
    await redisClient.ping()
    res.json({ healthy: true, postgres: 'ok', redis: 'ok' })
  } catch (err) {
    res.status(500).json({ healthy: false, error: err.message })
  }
})

// users (DB + cache)
app.get('/users/:id', async (req, res) => {
  const { id } = req.params
  const cacheKey = `user:${id}`

  try {
    const cached = await redisClient.get(cacheKey)
    if (cached) {
      return res.json({ source: 'cache', data: JSON.parse(cached) })
    }

    const result = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User tidak ditemukan' })
    }

    await redisClient.setEx(cacheKey, 60, JSON.stringify(result.rows[0]))

    res.json({ source: 'database', data: result.rows[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = app

if (require.main === module) {
  app.listen(process.env.PORT || 3000, () => {
    console.log(`Running di port ${process.env.PORT || 3000}`)
  })
}
