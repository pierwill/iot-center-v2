const express = require('express')
const path = require('path')

const app = express()

// APIs
app.get('/api/env', (_req, res) => {
  const result = {}
  res.json(result)
})

// UI
const uiBuildDir = path.join(__dirname, '../ui/build')
app.use(express.static(uiBuildDir))
// assume UI client navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(uiBuildDir, 'index.html'))
})

const port = process.env.PORT || 5000
app.listen(port)
console.log(`listening on http://localhost:${port}`)
