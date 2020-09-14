const express = require('express')
const env = require('../env')
const {
  getIoTAuthorization,
  createIoTAuthorization,
  getIoTAuthorizations,
  getDeviceId,
  deleteAuthorization,
} = require('../influxdb/authorizations')
const router = express.Router()
function handleError(wrapped) {
  return async function (req, res, next) {
    try {
      await wrapped(req, res)
    } catch (e) {
      next(e)
    }
  }
}

// send simple response in text/plain when requested (arduino)
router.use(function responseTextInPlaceOfJson(req, res, next) {
  if (
    req.header('accept') === 'text/plain' ||
    req.param('accept') === 'text/plain'
  ) {
    const oldJson = res.json

    res.json = function (...args) {
      const [body] = args
      if (typeof body === 'object' && body !== null) {
        res.send(
          Object.keys(body).reduce(
            (acc, key) => acc + `${key}=${body[key]}\n`,
            ''
          )
        )
      } else {
        oldJson.apply(res, args)
      }
    }
  }
  next()
})

// return environment for a specific device by its ID
router.get(
  '/env/:deviceId',
  handleError(async (req, res) => {
    const deviceId = req.params.deviceId
    let authorization = await getIoTAuthorization(deviceId)
    let registered = false
    if (!authorization) {
      if (req.query.register !== 'false') {
        authorization = await createIoTAuthorization(deviceId)
        registered = true
      } else {
        res.status(403)
        return res.json({
          id: deviceId,
          registered,
        })
      }
    }
    const result = {
      influx_url: env.INFLUX_URL,
      influx_org: env.INFLUX_ORG,
      influx_token: authorization.token,
      influx_bucket: env.INFLUX_BUCKET,
      id: deviceId,
      default_lon: 14.4071543,
      default_lat: 50.0873254,
      measurement_interval: 60,
      newlyRegistered: registered,
      createdAt: authorization.createdAt,
      updatedAt: authorization.updatedAt,
    }
    res.json(result)
  })
)

// return all devices as []{key: string, deviceId:string, createdAt: string}
router.get(
  '/devices',
  handleError(async (_req, res) => {
    const authorizations = await getIoTAuthorizations()
    res.json(
      authorizations.map((a) => ({
        key: a.id,
        deviceId: getDeviceId(a),
        createdAt: a.createdAt,
      }))
    )
  })
)

// return all devices as []{key: string, deviceId:string, createdAt: string}
router.delete(
  '/devices/:deviceId',
  handleError(async (req, res) => {
    await deleteAuthorization(req.params.deviceId)
    res.status(201)
    res.send('Device authorization removed')
  })
)

// all other routes are not supported!
router.all('*', (_, res) => {
  res.status(404)
  res.send('Not Found!')
})

router.use((err, _req, res, next) => {
  // console.error(err)
  if (res.headersSent) {
    return next(err)
  }
  res.status(500)
  res.send(String(err))
})

module.exports = router
