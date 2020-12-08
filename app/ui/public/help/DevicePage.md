## This is Device Page

[Source Code in DevicePage.tsx](https://github.com/bonitoo-io/iot-center-v2/blob/master/app/ui/src/pages/DevicePage.tsx)

The following Javascript function is used to display the **Device Configuration** table on this page.
It includes a Flux function.

```js
async function fetchDeviceData(config: DeviceConfig): Promise<DeviceData> {
  const {
    // influx_url: url, // use '/influx' proxy to avoid problem with InfluxDB v2 Beta (Docker)
    influx_token: token,
    influx_org: org,
    influx_bucket: bucket,
    id,
  } = config
  const influxDB = new InfluxDB({url: '/influx', token})
  const queryApi = influxDB.getQueryApi(org)
  const measurements = await queryApi.collectRows<any>(flux`
  import "math"
from(bucket: ${bucket})
  |> range(start: -30d)
  |> filter(fn: (r) => r._measurement == "environment")
  |> filter(fn: (r) => r.clientId == ${id})
  |> toFloat()
  |> group(columns: ["_field"])
  |> reduce(
      fn: (r, accumulator) => ({
        maxTime: (if r._time>accumulator.maxTime then r._time else accumulator.maxTime),
        maxValue: (if r._value>accumulator.maxValue then r._value else accumulator.maxValue),
        minValue: (if r._value<accumulator.minValue then r._value else accumulator.minValue),
        count: accumulator.count + 1.0
      }),
      identity: {maxTime: 1970-01-01, count: 0.0, minValue: math.mInf(sign: 1), maxValue: math.mInf(sign: -1)}
  )`)
  return {config, measurements}
}
```
