const express = require('express')
const path = require('path')
const proxy = require('express-http-proxy')

const apis = require('./apis')
const onboardInfluxDB = require('./influxdb/onboarding')
const {logEnvironment, INFLUX_URL} = require('./env')

async function startApplication() {
  const app = express()

  // log request URLs
  app.use((req, _resp, next) => {
    console.info(`${req.method} ${req.path}`)
    next()
  })

  // APIs
  app.use('/api', apis)

  // start proxy to InfluxDB to avoid CORS blocking with InfluXDB OSS v2 Beta
  app.use('/influx', proxy(INFLUX_URL))
  console.log(`Enable proxy from /influx/* to ${INFLUX_URL}/*`)

  // UI
  const uiBuildDir = path.join(__dirname, '../ui/build')
  app.use(express.static(uiBuildDir))
  // assume UI client navigation
  app.get('*', (req, res) => {
    res.sendFile(path.join(uiBuildDir, 'index.html'))
  })

  // onboard a new InfluxDB instance
  await onboardInfluxDB()

  // start HTTP server
  const port = process.env.PORT || 5000
  app.listen(port, process.env.HOSTNAME || '0.0.0.0')

  logEnvironment()
  console.log(`Listening on http://localhost:${port}`)
}

startApplication().catch((e) => {
  console.error('Failed to start', e)
})
