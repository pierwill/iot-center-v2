const express = require('express')
const env = require('../env')
const router = express.Router()

// return environment for a specific client by its ID
router.get('/env/:clientId', (req, res) => {
  const result = {
    influx_url: env.INFLUX_URL,
    influx_org: env.INFLUX_ORG,
    influx_token: env.INFLUX_TOKEN,
    influx_bucket: env.INFLUX_BUCKET,
    client_id: req.params.clientId,
  }
  res.json(result)
})

// other routes in API are not supported!
router.get('*', (_, res) => {
  res.status(404)
  res.send('Not Found!')
})

module.exports = router
