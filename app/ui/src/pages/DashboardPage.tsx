import React, {useState, useEffect} from 'react'
import {
  Tooltip,
  Button,
  message as antdMessage,
  Progress,
  Card,
  Row,
  Col,
  Collapse,
  Empty,
  Select,
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
} from '@influxdata/giraffe'
import {
  VIRTUAL_DEVICE,
  DeviceData,
  fetchDeviceConfig,
  fetchDeviceData,
  fetchDeviceMeasurements,
  writeEmulatedData,
  TProgressFn,
} from '../util/communication'
import {
  SettingFilled,
  ReloadOutlined,
  InfoCircleFilled,
} from '@ant-design/icons'
import CollapsePanel from 'antd/lib/collapse/CollapsePanel'
import {Option} from 'antd/lib/mentions'
import {DeviceInfo} from './DevicesPage'

interface Props {
  deviceId?: string
}

function DashboardPage({match, location, history}: RouteComponentProps<Props>) {
  const deviceId = match.params.deviceId ?? VIRTUAL_DEVICE
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<Message | undefined>()
  const [deviceData, setDeviceData] = useState<DeviceData | undefined>()
  const [dataStamp, setDataStamp] = useState(0)
  const [progress, setProgress] = useState(-1)
  const [devices, setDevices] = useState<DeviceInfo[] | undefined>(undefined)

  const isVirtualDevice = deviceId === VIRTUAL_DEVICE
  const writeAllowed =
    isVirtualDevice ||
    new URLSearchParams(location.search).get('write') === 'true'

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

  const writeData = async () => {
    const onProgress: TProgressFn = (percent) => {
      // console.log(
      //   `writeData ${current}/${total} (${Math.trunc(percent * 100) / 100}%)`
      // );
      setProgress(percent)
    }
    try {
      const count = await writeEmulatedData(
        deviceData as DeviceData,
        onProgress
      )
      if (count) {
        antdMessage.success(
          <>
            <b>{count}</b> measurement point{count > 1 ? 's were' : ' was'}{' '}
            written to InfluxDB.
          </>
        )
        setDataStamp(dataStamp + 1) // reload device data
      } else {
        antdMessage.info(
          `No new data were written to InfluxDB, the current measurement is already written.`
        )
      }
    } catch (e) {
      console.error(e)
      setMessage({
        title: 'Cannot write data',
        description: String(e),
        type: 'error',
      })
    }
    setProgress(-1)
  }

  //#region  gauges for quick state overview

  type TGaugeDefinition = {
    title: string
    gauge: Partial<GaugeLayerConfig>
  }
  const gaugeDefinitions: TGaugeDefinition[] = [
    {
      title: 'Temperature',
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
      gauge: {
        suffix: ' hPa',
        tickSuffix: ' hPa',
        gaugeColors: [
          {id: 'min', name: 'min', value: 370, hex: '#00ffff', type: 'min'},
          {id: 'max', name: 'max', value: 1_060, hex: '#ff6666', type: 'max'},
        ],
      },
    },
    {
      title: 'Heat index',
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
      title: 'Dew Point',
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
    table: GirrafeTable
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
      <>
        <div style={{width: '100%', height: 150}}>
          <Plot
            config={{
              showAxes: false,
              layers: [{...gaugeDefaults, ...gaugeDefinition}],
              table,
              valueFormatters: {
                _time: timeFormatter({
                  timeZone: 'UTC',
                  format: 'YYYY-MM-DD HH:mm:ss ZZ',
                }),
              },
            }}
          />
        </div>
      </>
    )
  }

  const gauges = deviceData?.measurementsTable?.length ? (
    <Row gutter={[4, 8]}>
      {gaugeDefinitions.map(({gauge, title}) => (
        <Col sm={24} md={12} xl={6}>
          {
            <Card title={title}>
              {renderGauge(gauge, deviceData.measurementsTable as GirrafeTable)}
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

  //#endregion

  //#region Plots showing changes in time

  type TLineDefinition = {
    title: string
    line: Partial<LineLayerConfig>
  }
  const plotDefinitions: TLineDefinition[] = [
    {
      title: 'Temperature',
      line: {},
    },
    {
      title: 'Humidity',
      line: {},
    },
    {
      title: 'Pressure',
      line: {},
    },
    {
      title: 'Heat index',
      line: {},
    },
    {
      title: 'Dew Point',
      line: {},
    },
  ]

  const renderPlot = (
    lineDefinition: Partial<LineLayerConfig>,
    table: GirrafeTable
  ) => {
    const lineDefaults: LineLayerConfig = {
      type: 'line',
      x: '_time',
      y: '_value',
      interpolation: 'natural',
    }

    return (
      <>
        <div style={{width: '100%', height: 200}}>
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
        </div>
      </>
    )
  }

  const plots = deviceData?.measurementsTable?.length ? (
    <Collapse defaultActiveKey={plotDefinitions.map((_, i) => i)}>
      {plotDefinitions.map(({line, title}, i) => (
        <CollapsePanel key={i} header={title}>
          {renderPlot(line, deviceData.measurementsTable as GirrafeTable)}
        </CollapsePanel>
      ))}
    </Collapse>
  ) : undefined

  //#endregion

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
      titleExtra={
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
                  <Option key={deviceId}>{deviceId}</Option>
                ))}
            </Select>
          </Tooltip>

          <Tooltip title="Reload Device Data">
            <Button
              disabled={loading}
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
      }
      message={message}
      spin={loading}
    >
      {gauges}

      {plots}
    </PageContent>
  )
}

export default DashboardPage
