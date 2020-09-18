import {InfluxDB, flux, Point} from '@influxdata/influxdb-client'

import {Table as GirafeTable} from '@influxdata/giraffe'
import {queryTable} from '../util/queryTable'

export interface DeviceConfig {
  influx_url: string
  influx_org: string
  influx_token: string
  influx_bucket: string
  id: string
}
export interface DeviceData {
  config: DeviceConfig
  minValue?: number
  maxValue?: number
  maxTime?: string
  count?: string
  measurementsTable?: GirafeTable
}
export type TProgressFn = (
  percent: number,
  current: number,
  total: number
) => void
export const VIRTUAL_DEVICE = 'virtual_device'
export const DAY_MILLIS = 24 * 60 * 60 * 1000

export const fetchDeviceConfig = async (
  deviceId: string
): Promise<DeviceConfig> => {
  const response = await fetch(
    `/api/env/${deviceId}?register=${deviceId === VIRTUAL_DEVICE}`
  )
  if (response.status >= 300) {
    const text = await response.text()
    throw new Error(`${response.status} ${text}`)
  }
  const deviceConfig: DeviceConfig = await response.json()
  if (!deviceConfig.influx_token) {
    throw new Error(`Device '${deviceId}' is not authorized!`)
  }
  return deviceConfig
}

export const fetchDeviceData = async (
  config: DeviceConfig
): Promise<DeviceData> => {
  const {
    // influx_url: url, // use '/influx' proxy to avoid problem with InfluxDB v2 Beta (Docker)
    influx_token: token,
    influx_org: org,
    influx_bucket: bucket,
    id,
  } = config
  const influxDB = new InfluxDB({url: '/influx', token})
  const queryApi = influxDB.getQueryApi(org)
  const results = await queryApi.collectRows<any>(flux`
from(bucket: ${bucket})
  |> range(start: -30d)
  |> filter(fn: (r) => r._measurement == "air")
  |> filter(fn: (r) => r.clientId == ${id})
  |> filter(fn: (r) => r._field == "temperature")
  |> group()
  |> reduce(
        fn: (r, accumulator) => ({
          maxTime: (if r._time>accumulator.maxTime then r._time else accumulator.maxTime),
          maxValue: (if r._value>accumulator.maxValue then r._value else accumulator.maxValue),
          minValue: (if r._value<accumulator.minValue then r._value else accumulator.minValue),
          count: accumulator.count + 1.0
        }),
        identity: {maxTime: 1970-01-01, count: 0.0, minValue: 10000.0, maxValue: -10000.0}
    )`)
  if (results.length > 0) {
    const {maxTime, minValue, maxValue, count} = results[0]
    return {config, maxTime, minValue, maxValue, count}
  }
  return {config}
}

export const fetchDeviceMeasurements = async (
  config: DeviceConfig
): Promise<GirafeTable> => {
  const {
    // influx_url: url, // use '/influx' proxy to avoid problem with InfluxDB v2 Beta (Docker)
    influx_token: token,
    influx_org: org,
    influx_bucket: bucket,
    id,
  } = config
  const queryApi = new InfluxDB({url: '/influx', token}).getQueryApi(org)
  const result = await queryTable(
    queryApi,
    flux`
  import "influxdata/influxdb/v1"    
  from(bucket: ${bucket})
    |> range(start: -30d)
    |> filter(fn: (r) => r._measurement == "environment")
    |> filter(fn: (r) => r.clientId == ${id})
    |> v1.fieldsAsCols()`
  )
  return result
}

export const writeEmulatedData = async (
  state: DeviceData,
  onProgress: TProgressFn
): Promise<number> => {
  const {
    // influx_url: url, // use '/influx' proxy to avoid problems with InfluxDB v2 Beta (Docker)
    influx_token: token,
    influx_org: org,
    influx_bucket: bucket,
    id,
  } = state.config
  // calculate window to emulate writes
  const toTime = Math.trunc(Date.now() / 60_000) * 60_000
  let lastTime = state.maxTime
    ? Math.trunc(Date.parse(state.maxTime) / 60_000) * 60_000
    : 0
  if (lastTime < toTime - 30 * 24 * 60 * 60 * 1000) {
    lastTime = toTime - 30 * 24 * 60 * 60 * 1000
  }
  const totalPoints = Math.trunc((toTime - lastTime) / 60_000)
  let pointsWritten = 0
  if (totalPoints > 0) {
    const batchSize = 2000
    const influxDB = new InfluxDB({url: '/influx', token})
    const writeApi = influxDB.getWriteApi(org, bucket, 'ms', {
      batchSize: batchSize + 1,
      defaultTags: {clientId: id},
    })
    try {
      // write random temperatures
      const point = new Point('air') // reuse the same point to spare memory
      onProgress(0, 0, totalPoints)
      while (lastTime < toTime) {
        lastTime += 60_000 // emulate next minute
        // calculate temperature as a predictable continuous functionto look better
        let dateTemperature =
          10 +
          10 * Math.sin((((lastTime / DAY_MILLIS) % 30) / 30) * 2 * Math.PI)
        // it is much warmer around lunch time
        dateTemperature +=
          10 +
          10 *
            Math.sin(
              ((lastTime % DAY_MILLIS) / DAY_MILLIS) * 2 * Math.PI - Math.PI / 2
            )
        point
          .floatField(
            'temperature',
            Math.trunc((dateTemperature + Math.random()) * 10) / 10
          )
          .timestamp(lastTime)
        writeApi.writePoint(point)

        pointsWritten++
        if (pointsWritten % batchSize === 0) {
          await writeApi.flush()
          onProgress(
            (pointsWritten / totalPoints) * 100,
            pointsWritten,
            totalPoints
          )
        }
      }
      await writeApi.flush()
    } finally {
      await writeApi.close()
    }
    onProgress(100, pointsWritten, totalPoints)
  }

  return pointsWritten
}
