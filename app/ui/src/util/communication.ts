import {InfluxDB, flux, fluxDuration} from '@influxdata/influxdb-client'

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
  measurementsLastValues?: {column: string; table: GirafeTable}[]
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
  |> filter(fn: (r) => r._measurement == "environment")
  |> filter(fn: (r) => r.clientId == ${id})
  |> filter(fn: (r) => r._field == "Temperature")
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
  config: DeviceConfig,
  timeStart = '-30d'
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
    |> range(start: ${fluxDuration(timeStart)})
    |> filter(fn: (r) => r._measurement == "environment")
    |> filter(fn: (r) => r.clientId == ${id})
    |> v1.fieldsAsCols()`
  )
  return result
}

export const fetchDeviceDataFieldLast = async (
  config: DeviceConfig,
  field: string,
  maxPastTime = '-1m'
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
    |> range(start: ${fluxDuration(maxPastTime)})
    |> filter(fn: (r) => r.clientId == ${id})
    |> filter(fn: (r) => r._measurement == "environment")
    |> filter(fn: (r) => r["_field"] == ${field})
    |> keep(columns: ["_value", "_time"])
    |> last()`
  )
  return result
}
