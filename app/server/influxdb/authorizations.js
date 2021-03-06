const {AuthorizationsAPI} = require('@influxdata/influxdb-client-apis')
const influxdb = require('./influxdb')
const {getOrganization} = require('./organizations')
const {getBucket} = require('./buckets')
const {INFLUX_BUCKET} = require('../env')

const authorizationsAPI = new AuthorizationsAPI(influxdb)
const DESC_PREFIX = 'IoT Center: '
const CREATE_BUCKET_SPECIFIC_AUTHORIZATIONS = false

/**
 * Gets all authorizations.
 * @return promise with an array of authorizations
 * @see https://influxdata.github.io/influxdb-client-js/influxdb-client-apis.authorization.html
 * @return {Array<import('@influxdata/influxdb-client-apis').Authorization>}
 */
async function getAuthorizations() {
  const {id: orgID} = await getOrganization()
  const authorizations = await authorizationsAPI.getAuthorizations({orgID})
  return authorizations.authorizations || []
}

/**
 * Gets all IoT Center device authorizations.
 * @return promise with an authorization or undefined
 * @see https://influxdata.github.io/influxdb-client-js/influxdb-client-apis.authorization.html
 * @return {Array<import('@influxdata/influxdb-client-apis').Authorization>}
 */
async function getIoTAuthorizations() {
  const authorizations = await getAuthorizations()
  const {id: bucketId} = await getBucket()
  return authorizations.filter(
    (val) =>
      val.description.startsWith(DESC_PREFIX) &&
      isBucketRWAuthorized(val, bucketId)
  )
}
/**
 * Gets IoT Center device authorization.
 * @return promise with an authorization or undefined
 * @see https://influxdata.github.io/influxdb-client-js/influxdb-client-apis.authorization.html
 * @return {import('@influxdata/influxdb-client-apis').Authorization} promise with authorization, undefined or an error
 */
async function getIoTAuthorization(deviceId) {
  const authorizations = await getAuthorizations()
  const descriptionPrefix = DESC_PREFIX + deviceId
  const {id: bucketId} = await getBucket()
  const retVal = authorizations.reduce((acc, val) => {
    if (val.description.startsWith(descriptionPrefix)) {
      // does the authorization allow access to the bucket
      if (!isBucketRWAuthorized(val, bucketId)) {
        return acc // this grant does not allow R/W to the bucket
      }
      // if there are more tokens, use the one that was lastly updated
      if (!acc || String(val.updatedAt) > String(acc.updatedAt)) {
        return val
      }
    }
    return acc
  }, undefined)
  // console.log('getIoTAuthorization: ', retVal ? retVal.description : undefined)
  return retVal
}

/**
 * Creates authorization for a supplied deviceId
 * @param {string} deviceId client identifier
 * @return {import('@influxdata/influxdb-client-apis').Authorization} promise with authorization or an error
 */
async function createIoTAuthorization(deviceId) {
  const {id: orgID} = await getOrganization()
  let bucketID = undefined
  if (CREATE_BUCKET_SPECIFIC_AUTHORIZATIONS) {
    bucketID = await getBucket(INFLUX_BUCKET).id
  }
  console.log(
    `createIoTAuthorization: deviceId=${deviceId} orgID=${orgID} bucketID=${bucketID}`
  )
  return await authorizationsAPI.postAuthorizations({
    body: {
      orgID,
      description: DESC_PREFIX + deviceId,
      permissions: [
        {
          action: 'read',
          resource: {type: 'buckets', id: bucketID, orgID},
        },
        {
          action: 'write',
          resource: {type: 'buckets', id: bucketID, orgID},
        },
      ],
    },
  })
}

/**
 * Deletes authorization for a supplied InfluxDB key
 * @param {string} key InfluxDB id of the authorization
 * @return {Promise} promise with a possible error
 */
async function deleteAuthorization(key) {
  return authorizationsAPI.deleteAuthorizationsID({authID: key})
}

/**
 * Gets client ID from authorization object.
 * @param {import('@influxdata/influxdb-client-apis').Authorization} authorization
 * @return client identifier
 */
function getDeviceId(authorization) {
  const description = String(authorization.description)
  if (description.startsWith(DESC_PREFIX)) {
    return description.substring(DESC_PREFIX.length)
  }
  return description
}

/**
 * Checks if the supplied authorization allows to read and write INFLUX_BUCKET.
 * @param {import('@influxdata/influxdb-client-apis').Authorization} authorization
 * @param {string} bucketId INFLUX_BUCKET identifier
 * @return {boolean} true if it can
 */
function isBucketRWAuthorized(authorization, bucketId) {
  const bucketRW = authorization.permissions.reduce((acc, val) => {
    if (
      val.resource.type === 'buckets' &&
      (!val.resource.id || val.resource.id === bucketId)
    ) {
      return acc | (val.action === 'read' ? 1 : 2)
    }
    return acc
  }, 0)
  return bucketRW === 3
}

module.exports = {
  getAuthorizations,
  getDeviceId,
  getIoTAuthorizations,
  getIoTAuthorization,
  createIoTAuthorization,
  deleteAuthorization,
}
