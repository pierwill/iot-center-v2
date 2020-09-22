import React, {useState, useEffect, FunctionComponent} from 'react'
import {Tooltip, Button, Card, Row, Col, Collapse, Empty, Select} from 'antd'
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
import {getXDomainFromTable, tableGetColumnLatestVal} from '../util/tableUtils'

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
  const [timeStart, setTimeStart] = useState('-1d')
  const [xDomain, setXDomain] = useState<number[] | undefined>(undefined)

  const resetXDomain = () =>
    setXDomain(getXDomainFromTable(deviceData?.measurementsTable))

  const isVirtualDevice = deviceId === VIRTUAL_DEVICE

  const withLoading = async (action: () => Promise<void>) => {
    setLoading(true)
    try {
      await action()
    } finally {
      setLoading(false)
    }
  }

  // fetch device configuration and data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const deviceConfig = await fetchDeviceConfig(deviceId)
        const [deviceData, table] = await Promise.all([
          fetchDeviceData(deviceConfig),
          fetchDeviceMeasurements(deviceConfig, timeStart),
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
  }, [dataStamp, deviceId, timeStart])

  useEffect(() => {
    resetXDomain()
  }, [deviceData])

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
          {id: 'min', name: 'min', value: 0, hex: '#00aaff', type: 'min'},
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
          {id: 'min', name: 'min', value: 970, hex: '#00ffff', type: 'min'},
          {id: 'max', name: 'max', value: 1_050, hex: '#ff6666', type: 'max'},
        ],
      },
    },
    {
      title: 'CO2',
      column: 'CO2',
      gauge: {
        suffix: ' ppm',
        tickSuffix: ' ppm',
        decimalPlaces: {digits: 0, isEnforced: true},
        gaugeColors: [
          {id: 'min', name: 'min', value: 400, hex: '#00aaff', type: 'min'},
          {id: 'max', name: 'max', value: 3000, hex: '#ff6666', type: 'max'},
        ],
      },
    },
    {
      title: 'TVOC',
      column: 'TVOC',
      gauge: {
        suffix: ' ppm',
        tickSuffix: ' ppm',
        decimalPlaces: {digits: 0, isEnforced: true},
        gaugeColors: [
          {id: 'min', name: 'min', value: 250, hex: '#00aaff', type: 'min'},
          {id: 'max', name: 'max', value: 2000, hex: '#ff6666', type: 'max'},
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
              layers: [{...gaugeDefaults, ...gaugeDefinition}],
              table,
            }}
          />
        ) : (
          <Empty />
        )}
      </div>
    )
  }

  // TODO: Remove this function when fixed https://github.com/influxdata/giraffe/issues/284
  const fixNeedleGaugeIssue = (
    gaugeDef: Partial<GaugeLayerConfig>,
    table: GirrafeTable | null
  ): [Partial<GaugeLayerConfig>, GirrafeTable | null] => {
    if (!table) return [gaugeDef, table]
    const value = (table.getColumn('_value') as number[])[0]
    if (value < 1000) return [gaugeDef, table]

    // create deep copy to not modify
    const gaugeDefCpy = {...gaugeDef}
    gaugeDefCpy.gaugeColors = (gaugeDef.gaugeColors || []).map((x) => ({...x}))

    gaugeDefCpy.tickSuffix = `0${gaugeDef.tickSuffix || ''}`
    gaugeDefCpy.suffix = `0${gaugeDef.suffix || ''}`

    gaugeDefCpy.gaugeColors.forEach((color) => {
      color.value = Math.trunc(color.value / 10)
    })

    return [
      gaugeDefCpy,
      newTable(1).addColumn('_value', 'number', [Math.trunc(value / 10)]),
    ]
  }

  const gauges = deviceData && (
    <Row gutter={[4, 8]}>
      {measurementsDefinitions.map(({gauge, title, column}) => (
        <Col xs={24} md={12} xl={6}>
          {
            <Card title={title}>
              {renderGauge(
                ...fixNeedleGaugeIssue(
                  gauge,
                  tableGetColumnLatestVal(
                    deviceData.measurementsTable as GirrafeTable,
                    column
                  )
                )
              )}
            </Card>
          }
        </Col>
      ))}
    </Row>
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
              xDomain: xDomain,
              onSetXDomain: setXDomain,
              onResetXDomain: resetXDomain,
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

  const plots = deviceData && (
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
  )

  const timeOptions: {label: string; value: string}[] = [
    {label: 'Past 5m', value: '-5m'},
    {label: 'Past 15m', value: '-15m'},
    {label: 'Past 1h', value: '-1h'},
    {label: 'Past 6h', value: '-6h'},
    {label: 'Past 1d', value: '-1d'},
    {label: 'Past 3d', value: '-3d'},
    {label: 'Past 7d', value: '-7d'},
    {label: 'Past 30d', value: '-30d'},
  ]

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

      <Tooltip title="Choose time" placement="left">
        <Select
          value={timeStart}
          onChange={setTimeStart}
          style={{minWidth: 100}}
          loading={loading}
          disabled={loading}
        >
          {timeOptions.map(({label, value}) => (
            <Select.Option key={value} value={value}>
              {label}
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
      forceShowScroll={true}
    >
      {deviceData?.measurementsTable?.length ? (
        <>
          {gauges}
          {plots}
        </>
      ) : (
        <Card>
          <Empty />
        </Card>
      )}
    </PageContent>
  )
}

export default DashboardPage
