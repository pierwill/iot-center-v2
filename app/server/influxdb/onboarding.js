const {InfluxDB, HttpError} = require('@influxdata/influxdb-client')
const {SetupAPI} = require('@influxdata/influxdb-client-apis')
const {
  INFLUX_URL,
  INFLUX_TOKEN,
  INFLUX_ORG,
  onboarding_username,
  onboarding_password,
  INFLUX_BUCKET,
} = require('../env')
const {getBucket, createBucket} = require('./buckets')

async function onboardInfluxDB() {
  const url = INFLUX_URL
  const setupApi = new SetupAPI(new InfluxDB({url}))
  try {
    const {allowed} = await setupApi.getSetup()
    if (allowed) {
      await setupApi.postSetup({
        body: {
          org: INFLUX_ORG,
          bucket: INFLUX_BUCKET,
          username: onboarding_username,
          password: onboarding_password,
          token: INFLUX_TOKEN,
        },
      })
      console.log(`InfluxDB has been onboarded.`)
    }
    let bucketNotFound = false
    try {
      await getBucket(INFLUX_BUCKET)
      console.log(`Bucket '${INFLUX_BUCKET}' exists.`)
    } catch (e) {
      if (e instanceof HttpError && e.statusCode === 401) {
        console.error(
          `Unauthorized to determine whether a bucket '${INFLUX_BUCKET}' exists.`
        )
      } else if (e instanceof HttpError && e.statusCode === 404) {
        // bucket not found
        bucketNotFound = true
      } else {
        console.error(
          `Unable to check whether a bucket '${INFLUX_BUCKET}' exists.`,
          e
        )
      }
    }
    if (bucketNotFound) {
      await createBucket(INFLUX_BUCKET)
      console.log(`Bucket ${INFLUX_BUCKET} created.`)
    }
  } catch (error) {
    console.error(
      `Unable to determine whether InfluxDB at ${INFLUX_URL} is onboarded.`,
      error
    )
  }
}

module.exports = onboardInfluxDB
