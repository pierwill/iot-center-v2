const express = require('express')
const env = require('../env')
const {
  getIoTAuthorization,
  createIoTAuthorization,
} = require('../influxdb/authorizations')
const router = express.Router()

// return environment for a specific client by its ID
router.get('/env/:clientId', async (req, res) => {
  const clientId = req.params.clientId
  // console.log(`GET /env/${clientId}`)
  let authorization = await getIoTAuthorization(clientId)
  if (!authorization) {
    authorization = await createIoTAuthorization(clientId)
  }
  const result = {
    influx_url: env.INFLUX_URL,
    influx_org: env.INFLUX_ORG,
    influx_token: authorization.token,
    influx_bucket: env.INFLUX_BUCKET,
    client_id: req.params.clientId,
  }
  res.json(result)
})

// all other routes are not supported!
router.all('*', (_, res) => {
  res.status(404)
  res.send('Not Found!')
})

module.exports = router
