const {BucketsAPI} = require('@influxdata/influxdb-client-apis')
const influxdb = require('./influxdb')
const {INFLUX_BUCKET} = require('../env')
const {getOrganization} = require('./organizations')
const bucketsAPI = new BucketsAPI(influxdb)

/**
 * Gets details for a bucket supplied by name.
 * @param {string} name bucket name, optional defaults to env.INFLUX_BUCKET
 * @return promise with an instance of bucket or an error
 * @see https://influxdata.github.io/influxdb-client-js/influxdb-client-apis.bucket.html
 */
async function getBucket(name) {
  if (!name) {
    name = INFLUX_BUCKET
  }
  const {id: orgID} = await getOrganization()
  const buckets = await bucketsAPI.getBuckets({name: INFLUX_BUCKET, orgID})
  return buckets.buckets[0]
}

/**
 * Creates a bucket of the supplied by name.
 * @param {string} name bucket name, optional defaults to env.INFLUX_BUCKET
 * @return promise with an instance of bucket or an error
 * @see https://influxdata.github.io/influxdb-client-js/influxdb-client-apis.bucket.html
 */
async function createBucket(name) {
  if (!name) {
    name = INFLUX_BUCKET
  }
  const {id: orgID} = await getOrganization()
  return await bucketsAPI.postBuckets({
    body: {
      name: INFLUX_BUCKET,
      orgID,
      description: 'Created by IoT Center',
      retentionRules: [],
    },
  })
}

module.exports = {
  getBucket,
  createBucket,
}
