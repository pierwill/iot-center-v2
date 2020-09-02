const express = require('express')
const path = require('path')
const apis = require('./apis')

const app = express()

// APIs
app.use('/api', apis)

// UI
const uiBuildDir = path.join(__dirname, '../ui/build')
app.use(express.static(uiBuildDir))
// assume UI client navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(uiBuildDir, 'index.html'))
})

// start HTTP server
const port = process.env.PORT || 5000
app.listen(port)
console.log(`listening on http://localhost:${port}`)
