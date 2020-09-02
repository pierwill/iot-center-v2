const {AuthorizationsAPI} = require('@influxdata/influxdb-client-apis')
const influxdb = require('./influxdb')
const {getOrganization} = require('./organizations')
const {getBucket} = require('./buckets')
const {INFLUX_BUCKET} = require('../env')

const authorizationsAPI = new AuthorizationsAPI(influxdb)

/**
 * Gets all authorizations.
 * @return promise with an array of authorizations
 * @see https://influxdata.github.io/influxdb-client-js/influxdb-client-apis.authorization.html
 */
async function getAuthorizations() {
  const {id: orgID} = await getOrganization()
  const authorizations = await authorizationsAPI.getAuthorizations({orgID})
  return authorizations.authorizations || []
}

/**
 * Gets all IoT Center client authorizations.
 * @return promise with an authorization or undefined
 * @see https://influxdata.github.io/influxdb-client-js/influxdb-client-apis.authorization.html
 */
async function getIoTAuthorizations() {
  const authorizations = await getAuthorizations()
  const descriptionPrefix = `IoT Center: `
  return authorizations.filter((val) =>
    val.description.startsWith(descriptionPrefix)
  )
}
/**
 * Gets IoT Center client authorization.
 * @return promise with an authorization or undefined
 * @see https://influxdata.github.io/influxdb-client-js/influxdb-client-apis.authorization.html
 */
async function getIoTAuthorization(clientId) {
  const authorizations = await getAuthorizations()
  const descriptionPrefix = `IoT Center: ${clientId}`
  const {id: bucketId} = await getBucket()
  const retVal = authorizations.reduce((acc, val) => {
    if (val.description.startsWith(descriptionPrefix)) {
      // does the authorization allow access to the bucket
      const bucketRW = val.permissions.reduce((acc, val) => {
        if (
          val.resource.type === 'buckets' &&
          (!val.resource.id || val.resource.id === bucketId)
        ) {
          return acc | (val.action === 'read' ? 1 : 2)
        }
        return acc
      }, 0)
      if (bucketRW !== 3) {
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

async function createIoTAuthorization(clientId) {
  const {id: orgID} = await getOrganization()
  const {id: bucketID} = await getBucket(INFLUX_BUCKET)
  console.log(
    `createIoTAuthorization: clientId=${clientId} orgID=${orgID} bucketID=${bucketID}`
  )
  return await authorizationsAPI.postAuthorizations({
    body: {
      orgID,
      description: `IoT Center: ${clientId}`,
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

module.exports = {
  getAuthorizations,
  getIoTAuthorizations,
  getIoTAuthorization,
  createIoTAuthorization,
}
