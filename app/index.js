const express = require('express')
const app = express()

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Hello dari CI/CD!' })
})

app.get('/health', (req, res) => {
  res.json({ healthy: true })
})

module.exports = app  // penting: export untuk bisa ditest

if (require.main === module) {
  app.listen(3000, () => console.log('Running di port 3000'))
}
