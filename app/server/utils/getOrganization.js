const {InfluxDB} = require('@influxdata/influxdb-client')
const {OrgsAPI} = require('@influxdata/influxdb-client-apis')
const {INFLUX_URL, INFLUX_TOKEN} = require('../env')

/**
 * Gets organization details for the organization name supplied.
 * @param {string} name organization name
 * @return promise with an instance of organization or an error
 * @see https://influxdata.github.io/influxdb-client-js/influxdb-client-apis.organization.html
 */
async function getOrganization(name) {
  const orgsApi = new OrgsAPI(
    new InfluxDB({url: INFLUX_URL, token: INFLUX_TOKEN})
  )
  return orgsApi.getOrgs({org: name}).then((response) => {
    if (!response.orgs || response.orgs.length === 0) {
      throw new Error(`No organization named ${name} found!`)
    }
    return response.orgs[0]
  })
}

module.exports = getOrganization
