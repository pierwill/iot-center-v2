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
