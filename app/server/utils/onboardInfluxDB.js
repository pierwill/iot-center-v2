const {InfluxDB, HttpError} = require('@influxdata/influxdb-client')
const {SetupAPI, BucketsAPI} = require('@influxdata/influxdb-client-apis')
const {
  INFLUX_URL,
  INFLUX_TOKEN,
  INFLUX_ORG,
  onboarding_username,
  onboarding_password,
  INFLUX_BUCKET,
} = require('../env')
const getOrganization = require('./getOrganization')

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
    const {id: orgID} = await getOrganization(INFLUX_ORG)
    const bucketsAPI = new BucketsAPI(new InfluxDB({url, token: INFLUX_TOKEN}))
    let createBucket = false
    try {
      await bucketsAPI.getBuckets({name: INFLUX_BUCKET, orgID})
      console.log(`Bucket ${INFLUX_ORG} exists`)
    } catch (e) {
      console.log('!!!!!', e)
      if (e instanceof HttpError && e.statusCode === 401) {
        console.log(
          `Unauthorized to determine whether a bucket '${INFLUX_BUCKET}' exists.`
        )
      } else if (e instanceof HttpError && e.statusCode === 404) {
        // bucket not found
        createBucket = true
      } else {
        console.log(
          `Unable to check whether a bucket '${INFLUX_BUCKET}' exists.`,
          e
        )
      }
    }
    if (createBucket) {
      await bucketsAPI.postBuckets({
        body: {
          name: INFLUX_BUCKET,
          orgID,
          description: 'Created by IoT Center',
          retentionRules: [],
        },
      })
      console.warn(`Bucket ${INFLUX_BUCKET} created.`)
    }
  } catch (error) {
    console.error(
      `Unable to determine whether InfluxDB at ${INFLUX_URL} is onboarded.`,
      error
    )
  }
}

module.exports = onboardInfluxDB
