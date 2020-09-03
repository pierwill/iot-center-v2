const express = require('express')
const env = require('../env')
const {
  getIoTAuthorization,
  createIoTAuthorization,
  getIoTAuthorizations,
  getClientId,
  deleteAuthorization,
} = require('../influxdb/authorizations')
const router = express.Router()

// return environment for a specific client by its ID
router.get('/env/:clientId', async (req, res) => {
  const clientId = req.params.clientId
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

// return all devices as []{key: string, clientId:string, createdAt: string}
router.get('/devices', async (_req, res) => {
  const authorizations = await getIoTAuthorizations()
  res.json(
    authorizations.map((a) => ({
      key: a.id,
      clientId: getClientId(a),
      createdAt: a.createdAt,
    }))
  )
})

// return all devices as []{key: string, clientId:string, createdAt: string}
router.delete('/devices/:deviceId', async (req, res) => {
  await deleteAuthorization(req.params.deviceId)
  res.status(201)
  res.send('Device authorization removed')
})

// all other routes are not supported!
router.all('*', (_, res) => {
  res.status(404)
  res.send('Not Found!')
})

module.exports = router
