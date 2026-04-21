const express = require('express')
const { Pool } = require('pg')
const redis = require('redis')

const app = express()
app.use(express.json())

// Koneksi PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
})

// Koneksi Redis
const redisClient = redis.createClient({
  url: process.env.REDIS_URL
})

redisClient.connect().catch(console.error)

// Route utama
app.get('/', async (req, res) => {
  res.json({ status: 'ok', message: 'Hello dari Docker Compose!' })
})

// Health check — cek semua koneksi
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1')          // cek postgres
    await redisClient.ping()              // cek redis
    res.json({ healthy: true, postgres: 'ok', redis: 'ok' })
  } catch (err) {
    res.status(500).json({ healthy: false, error: err.message })
  }
})

// Contoh: simpan + ambil data dengan Redis cache
app.get('/users/:id', async (req, res) => {
  const { id } = req.params
  const cacheKey = `user:${id}`

  // Cek cache Redis dulu
  const cached = await redisClient.get(cacheKey)
  if (cached) {
    return res.json({ source: 'cache', data: JSON.parse(cached) })
  }

  // Kalau tidak ada di cache, ambil dari DB
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [id])
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'User tidak ditemukan' })
  }

  // Simpan ke cache selama 60 detik
  await redisClient.setEx(cacheKey, 60, JSON.stringify(result.rows[0]))
  res.json({ source: 'database', data: result.rows[0] })
})

module.exports = app

if (require.main === module) {
  app.listen(process.env.PORT || 3000, () => {
    console.log(`Running di port ${process.env.PORT || 3000}`)
  })
} 
// update
