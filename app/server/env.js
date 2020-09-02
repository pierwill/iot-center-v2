/** InfluxDB URL */
const INFLUX_URL = process.env.INFLUX_URL || 'http://localhost:9999'
/** InfluxDB authorization token */
const INFLUX_TOKEN = process.env.INFLUX_TOKEN || 'my-token'
/** Organization within InfluxDB  */
const INFLUX_ORG = process.env.INFLUX_ORG || 'my-org'

// Default user+pwd when setting up a new InfluxDB instance
/** InfluxDB user  */
const onboarding_username = 'my-user'
/** InfluxDB password  */
const onboarding_password = 'my-password'

module.exports = {
  INFLUX_URL,
  INFLUX_TOKEN,
  INFLUX_ORG,
  onboarding_username,
  onboarding_password,
}
