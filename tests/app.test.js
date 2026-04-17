const request = require('supertest')
const app = require('../app/index')

test('GET / mengembalikan status ok', async () => {
  const res = await request(app).get('/')
  expect(res.statusCode).toBe(200)
  expect(res.body.status).toBe('ok')
})

test('GET /health mengembalikan healthy true', async () => {
  const res = await request(app).get('/health')
  expect(res.body.healthy).toBe(true)
})
