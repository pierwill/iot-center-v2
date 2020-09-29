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
  List,
  Descriptions,
  Table,
  Statistic,
  Progress,
} from 'antd'
import {RouteComponentProps, withRouter} from 'react-router-dom'

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
  fetchDeviceDataFieldLast,
  DeviceConfig,
} from '../util/communication'
import {
  SettingFilled,
  ReloadOutlined,
  InfoCircleFilled,
  PlayCircleOutlined,
  CloseCircleOutlined,
  PauseCircleOutlined,
} from '@ant-design/icons'
import CollapsePanel from 'antd/lib/collapse/CollapsePanel'
import {DeviceInfo} from './DevicesPage'
import {getXDomainFromTable} from '../util/tableUtils'
import DescriptionsItem from 'antd/lib/descriptions/Item'
import {ColumnsType} from 'antd/lib/table'
import * as CSS from 'csstype'

interface Props {}

const OverviewPage: FunctionComponent<RouteComponentProps<Props>> = ({}) => {
  const [loading, setLoading] = useState(true)
  const [devices, setDevices] = useState<DeviceInfo[] | undefined>(undefined)
  const [message, setMessage] = useState<Message | undefined>()
  const [selected, setSelected] = useState<DeviceInfo[]>([])

  useEffect(() => {
    const fetchDevices = async () => {
      setLoading(true)
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
      setLoading(false)
    }

    fetchDevices()
  }, [])

  const columnDefinitions: ColumnsType<DeviceInfo> = [
    {
      title: 'Device ID',
      dataIndex: 'deviceId',
      defaultSortOrder: 'ascend',
      render: (deviceId: string) => deviceId,
      sorter: (a: DeviceInfo, b: DeviceInfo) =>
        a.deviceId > b.deviceId ? 1 : -1,
    },
    {
      title: 'status',
      render: () => {
        const _ = () => {
          let rand = Math.random()
          if ((rand -= 1 / 3) <= 0)
            return <PlayCircleOutlined style={{color: 'green'}} />
          if ((rand -= 1 / 3) <= 0)
            return <PauseCircleOutlined style={{color: '#ccba00'}} />
          return <CloseCircleOutlined style={{color: 'red'}} />
        }

        return <div style={{fontSize: '1.2em'}}>{_()}</div>
      },
      align: 'center',
    },
  ]

  const deviceOverview = (
    <Card title="Device overview">
      <Row justify="space-around">
        {[
          {label: 'Registered', value: devices?.length},
          {label: 'online', value: devices?.length},
          {label: 'offline', value: devices?.length},
          {label: 'static', value: devices?.length},
          {label: 'mobile', value: devices?.length},
        ].map(({label, value}) => (
          <Col xs={4}>
            <Statistic title={label} value={value} />
          </Col>
        ))}
      </Row>
    </Card>
  )

  const PieChart: FunctionComponent<{
    lablel: string
    value: number
    percent: number
    color?: CSS.Property.Color
  }> = ({lablel, value, percent, color}) => (
    <div>
      <div
        style={{textAlign: 'center', paddingBottom: '.4em'}}
        className="ant-statistic-title"
      >
        {lablel}
      </div>
      <Progress
        type="circle"
        percent={percent}
        format={() => `${value}`}
        strokeColor={color}
      />
    </div>
  )
  const rand = (dec = 3) => (Math.random() * 10 ** dec) >> 0
  const connectionOverwiev = (
    <Card>
      <Row justify="space-around">
        <PieChart
          lablel="online"
          percent={rand(2)}
          value={rand()}
          color="green"
        />
        <PieChart
          lablel="offline"
          percent={rand(1.5)}
          value={rand()}
          color="blue"
        />
        <PieChart
          lablel="unregistered"
          percent={rand(1.5)}
          value={rand()}
          color="red"
        />
      </Row>
    </Card>
  )

  return (
    <PageContent title="Overview" message={message}>
      <Row>
        <Col xs={12}>
          {deviceOverview}
          {connectionOverwiev}
          <Card>
            <Table
              columns={columnDefinitions}
              dataSource={devices}
              rowSelection={{
                type: 'checkbox',
                onSelect: (...[, , selected]) =>
                  setSelected(selected as DeviceInfo[]),
              }}
            />
          </Card>
        </Col>
        <Col xs={12}>
          <Card>
            <Empty />
          </Card>
          <Card>
            <Plot
              config={{
                layers: [
                  {
                    type: 'line',
                    x: '_time',
                    y: '_value',
                  },
                ],
              }}
            />
          </Card>
        </Col>
      </Row>
    </PageContent>
  )
}

export default withRouter(OverviewPage)
