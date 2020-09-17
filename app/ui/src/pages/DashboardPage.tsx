import React, {useState, useEffect, FunctionComponent} from 'react'
import {
  Tooltip,
  Button,
  Card,
  Row,
  Col,
  Collapse,
  Empty,
  Select,
  Grid,
} from 'antd'
import {RouteComponentProps} from 'react-router-dom'

import PageContent, {Message} from './PageContent'
import {
  Plot,
  timeFormatter,
  Table as GirrafeTable,
  GAUGE_THEME_LIGHT,
  GaugeLayerConfig,
  LineLayerConfig,
  newTable,
} from '@influxdata/giraffe'
import {
  VIRTUAL_DEVICE,
  DeviceData,
  fetchDeviceConfig,
  fetchDeviceData,
  fetchDeviceMeasurements,
} from '../util/communication'
import {
  SettingFilled,
  ReloadOutlined,
  InfoCircleFilled,
} from '@ant-design/icons'
import CollapsePanel from 'antd/lib/collapse/CollapsePanel'
import {DeviceInfo} from './DevicesPage'

interface Props {
  deviceId?: string
}

const DashboardPage: FunctionComponent<RouteComponentProps<Props>> = ({
  match,
  history,
}) => {
  const deviceId = match.params.deviceId ?? VIRTUAL_DEVICE
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<Message | undefined>()
  const [deviceData, setDeviceData] = useState<DeviceData | undefined>()
  const [dataStamp, setDataStamp] = useState(0)
  const [devices, setDevices] = useState<DeviceInfo[] | undefined>(undefined)

  const isVirtualDevice = deviceId === VIRTUAL_DEVICE

  const withLoading = async (action: () => Promise<void>) => {
    setLoading(true)
    await action()
    setLoading(false)
  }

  // fetch device configuration and data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const deviceConfig = await fetchDeviceConfig(deviceId)
        const [deviceData, table] = await Promise.all([
          fetchDeviceData(deviceConfig),
          fetchDeviceMeasurements(deviceConfig),
        ])
        deviceData.measurementsTable = table
        setDeviceData(deviceData)
      } catch (e) {
        console.error(e)
        setMessage({
          title: 'Cannot load device data',
          description: String(e),
          type: 'error',
        })
      }
    }

    withLoading(fetchData)
  }, [dataStamp, deviceId])

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const response = await fetch('/api/devices')
        if (response.status >= 300) {
          const text = await response.text()
          throw new Error(`${response.status} ${text}`)
        }
        const data = await response.json()
        setDevices(data)
      } catch (e) {
        setMessage({
          title: 'Cannot fetch data',
          description: String(e),
          type: 'error',
        })
      }
    }

    fetchDevices()
  }, [])

  type TMeasurementDefinition = {
    title: string
    column: string
    gauge: Partial<GaugeLayerConfig>
    line?: Partial<LineLayerConfig>
  }
  const measurementsDefinitions: TMeasurementDefinition[] = [
    {
      title: 'Temperature',
      column: 'Temperature',
      gauge: {
        suffix: ' °C',
        tickSuffix: ' °C',
        gaugeColors: [
          {id: 'min', name: 'min', value: -20, hex: '#00aaff', type: 'min'},
          {id: 'max', name: 'max', value: 40, hex: '#ff6666', type: 'max'},
        ],
      },
    },
    {
      title: 'Humidity',
      column: 'Humidity',
      gauge: {
        suffix: ' %',
        tickSuffix: ' %',
        gaugeColors: [
          {id: 'min', name: 'min', value: 0, hex: '#ff6666', type: 'min'},
          {
            id: 'low-warn',
            name: 'low-warn',
            value: 30,
            hex: '#e8e800',
            type: 'threshold',
          },
          {
            id: 'ideal',
            name: 'ideal',
            value: 40,
            hex: '#00dd00',
            type: 'threshold',
          },
          {
            id: 'high-warn',
            name: 'high-warn',
            value: 60,
            hex: '#e8e800',
            type: 'threshold',
          },
          {
            id: 'high-warn',
            name: 'high-warn',
            value: 70,
            hex: '#ff6666',
            type: 'threshold',
          },
          {id: 'max', name: 'max', value: 100, hex: '', type: 'max'},
        ],
      },
    },
    {
      title: 'Pressure',
      column: 'Pressure',
      gauge: {
        suffix: ' hPa',
        tickSuffix: ' hPa',
        decimalPlaces: {digits: 0, isEnforced: true},
        gaugeColors: [
          {id: 'min', name: 'min', value: 370, hex: '#00ffff', type: 'min'},
          {id: 'max', name: 'max', value: 1_060, hex: '#ff6666', type: 'max'},
        ],
      },
    },
    {
      title: 'TVOC',
      column: 'TVOC',
      gauge: {
        suffix: ' ppm',
        tickSuffix: ' ppm',
        gaugeColors: [
          {id: 'min', name: 'min', value: -20, hex: '#00aaff', type: 'min'},
          {id: 'max', name: 'max', value: 40, hex: '#ff6666', type: 'max'},
        ],
      },
    },
    {
      title: 'CO2',
      column: 'CO2',
      gauge: {
        suffix: ' °C',
        tickSuffix: ' °C',
        gaugeColors: [
          {id: 'min', name: 'min', value: -20, hex: '#00aaff', type: 'min'},
          {id: 'max', name: 'max', value: 40, hex: '#ff6666', type: 'max'},
        ],
      },
    },
  ]

  const renderGauge = (
    gaugeDefinition: Partial<GaugeLayerConfig>,
    table: GirrafeTable | null
  ) => {
    const gaugeDefaults: GaugeLayerConfig = {
      type: 'gauge',
      decimalPlaces: {digits: 2},
      prefix: '',
      suffix: '',
      tickPrefix: '',
      tickSuffix: '',
      gaugeColors: [],
      gaugeSize: 4,
      theme: {
        ...GAUGE_THEME_LIGHT,
        valuePositionYOffset: 1,
      },
    }

    return (
      <div style={{width: '100%', height: 150}}>
        {table ? (
          <Plot
            config={{
              showAxes: false,
              layers: [
                {...gaugeDefaults, ...gaugeDefinition, ...{y: 'Temperature'}},
              ],
              table,
              valueFormatters: {
                _time: timeFormatter({
                  timeZone: 'UTC',
                  format: 'YYYY-MM-DD HH:mm:ss ZZ',
                }),
              },
            }}
          />
        ) : (
          <Empty />
        )}
      </div>
    )
  }

  // TODO: find way to select data to show through giraffe tools (like y in LinePlot)
  const HackTableShowColumnLastVal = (table: GirrafeTable, column: string) => {
    const last = function <T>(arr: T[]) {
      return arr && arr[arr.length - 1]
    }
    const time = last(table.getColumn('_time') as number[])
    const columnVal = last(table.getColumn(column) as number[])

    if (!columnVal && columnVal !== 0) return null

    return newTable(1)
      .addColumn('_time', 'time', [time])
      .addColumn('_value', 'number', [columnVal])
  }

  const gauges = deviceData?.measurementsTable?.length ? (
    <Row gutter={[4, 8]}>
      {measurementsDefinitions.map(({gauge, title, column}) => (
        <Col sm={24} md={12} xl={6}>
          {
            <Card title={title}>
              {renderGauge(
                gauge,
                HackTableShowColumnLastVal(
                  deviceData.measurementsTable as GirrafeTable,
                  column
                )
              )}
            </Card>
          }
        </Col>
      ))}
    </Row>
  ) : (
    <Card>
      <Empty />
    </Card>
  )

  const renderPlot = (
    lineDefinition: Partial<LineLayerConfig> | undefined,
    table: GirrafeTable,
    column: string
  ) => {
    const lineDefaults: LineLayerConfig = {
      type: 'line',
      x: '_time',
      y: column,
      interpolation: 'natural',
    }

    const hasData = !!table.getColumn(column)

    return (
      <div style={{width: '100%', height: 200}}>
        {hasData ? (
          <Plot
            config={{
              layers: [{...lineDefaults, ...lineDefinition}],
              table,
              valueFormatters: {
                _time: timeFormatter({
                  timeZone: 'UTC',
                  format: 'YYYY-MM-DD HH:mm:ss ZZ',
                }),
              },
            }}
          />
        ) : (
          <Empty />
        )}
      </div>
    )
  }

  const plots = deviceData?.measurementsTable?.length ? (
    <Collapse defaultActiveKey={measurementsDefinitions.map((_, i) => i)}>
      {measurementsDefinitions.map(({line, title, column}, i) => (
        <CollapsePanel key={i} header={title}>
          {renderPlot(
            line,
            deviceData.measurementsTable as GirrafeTable,
            column
          )}
        </CollapsePanel>
      ))}
    </Collapse>
  ) : undefined

  const dashboardControls = (
    <>
      <Tooltip title="Choose device" placement="left">
        <Select
          showSearch
          value={deviceId}
          placeholder={'select device to show'}
          showArrow={true}
          filterOption={true}
          onChange={(key) => history.push(`/dashboard/${key}`)}
          style={{minWidth: 200}}
          loading={!devices}
          disabled={!devices}
        >
          {devices &&
            devices.map(({deviceId}) => (
              <Select.Option key={deviceId} value={deviceId}>
                {deviceId}
              </Select.Option>
            ))}
        </Select>
      </Tooltip>

      <Tooltip title="Reload Device Data">
        <Button
          disabled={loading}
          loading={loading}
          onClick={() => setDataStamp(dataStamp + 1)}
          icon={<ReloadOutlined />}
        />
      </Tooltip>
      <Tooltip title="Go to device settings" placement="topRight">
        <Button
          type="primary"
          icon={<SettingFilled />}
          href={`/devices/${deviceId}`}
        ></Button>
      </Tooltip>
    </>
  )

  return (
    <PageContent
      title={
        isVirtualDevice ? (
          <>
            {'Virtual Device'}
            <Tooltip title="This page writes temperature measurements for the last 30 days from an emulated device, the temperature is reported every minute.">
              <InfoCircleFilled style={{fontSize: '1em', marginLeft: 5}} />
            </Tooltip>
          </>
        ) : (
          `Device ${deviceId}`
        )
      }
      titleExtra={dashboardControls}
      message={message}
      spin={loading}
    >
      {gauges}

      {plots}
    </PageContent>
  )
}

export default DashboardPage
