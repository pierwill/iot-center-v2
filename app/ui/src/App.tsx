import React, {useState, useEffect, FunctionComponent} from 'react'
import {
  Switch,
  Route,
  Redirect,
  RouteComponentProps,
  withRouter,
  NavLink,
} from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import './App.css'
import {Layout, Menu} from 'antd'
import {
  HomeOutlined,
  BugOutlined,
  DoubleRightOutlined,
  FastForwardOutlined,
  AreaChartOutlined,
  PieChartOutlined,
} from '@ant-design/icons'

import HomePage from './pages/HomePage'
import DevicesPage from './pages/DevicesPage'
import DevicePage from './pages/DevicePage'
import NotFoundPage from './pages/NotFoundPage'
import DashboardPage from './pages/DashboardPage'
import {VIRTUAL_DEVICE} from './util/communication'
import OverviewPage from './pages/OverviewPage'

const {Sider} = Layout
const PAGE_HELP: Record<string, {file: string}> = {
  '/devices': {file: '/help/DevicesPage.md'},
  '/devices/virtual_device': {file: '/help/VirtualDevicePage.md'},
}

function useHelpCollapsed(): [boolean, (v: boolean) => void] {
  const [helpCollapsed, setHelpCollapsed] = useState(
    localStorage?.getItem('helpCollapsed') === 'true'
  )
  const changeHelpCollapsed = (v: boolean) => {
    setHelpCollapsed(v)
    localStorage?.setItem('helpCollapsed', String(v))
  }
  return [helpCollapsed, changeHelpCollapsed]
}

const App: FunctionComponent<RouteComponentProps> = (props) => {
  const [menuCollapsed, setMenuCollapsed] = useState(false)
  const [helpCollapsed, setHelpCollapsed] = useHelpCollapsed()
  const [helpText, setHelpText] = useState('')
  const page = PAGE_HELP[props.location.pathname]
  useEffect(() => {
    setHelpText('')
    if (page) {
      // load markdown from file
      ;(async () => {
        try {
          const response = await fetch(page.file)
          const txt = await response.text()
          setHelpText((txt ?? '').startsWith('<!') ? 'HELP NOT FOUND' : txt)
        } catch (e) {
          console.error(e)
        }
      })()
    }
  }, [page])

  return (
    <div className="App">
      <Layout style={{minHeight: '100vh'}}>
        <Sider
          collapsible
          collapsed={menuCollapsed as boolean}
          onCollapse={() => setMenuCollapsed(!menuCollapsed)}
        >
          {/* <Header
            className="site-layout-background"
            style={{ padding: "10px" }}
          >
            <h1 style={{ color: "rgba(255,255,255,255)" }}>
              <Link to="/home">IoT&nbsp;Center</Link>
            </h1>
          </Header> */}
          <Menu
            theme="dark"
            selectedKeys={[props.location.pathname]}
            mode="inline"
          >
            <Menu.Item key="/home" icon={<HomeOutlined />}>
              <NavLink to="/home">Home</NavLink>
            </Menu.Item>
            <Menu.Item key="/devices" icon={<DoubleRightOutlined />}>
              <NavLink to="/devices">Device Registrations</NavLink>
            </Menu.Item>
            <Menu.Item
              key="/devices/virtual_device"
              icon={<FastForwardOutlined />}
            >
              <NavLink to="/devices/virtual_device">Virtual Device</NavLink>
            </Menu.Item>
            <Menu.Item key="/overview" icon={<PieChartOutlined />}>
              <NavLink to="/overview">Overview</NavLink>
            </Menu.Item>
            <Menu.Item key="/dashboard" icon={<AreaChartOutlined />}>
              <NavLink to="/dashboard">Dashboard</NavLink>
            </Menu.Item>
            <Menu.Item key="/todo" icon={<BugOutlined />}>
              <NavLink to="/todo">ToDo</NavLink>
            </Menu.Item>
            {}
          </Menu>
        </Sider>
        <Switch>
          <Redirect exact from="/" to="/home" />
          <Route exact path="/home" component={HomePage} />
          <Route exact path="/devices" component={DevicesPage} />
          <Route exact path="/devices/:deviceId" component={DevicePage} />
          <Redirect
            exact
            from="/dashboard"
            to={`/dashboard/${VIRTUAL_DEVICE}`}
          />
          <Route exact path="/dashboard/:deviceId" component={DashboardPage} />
          <Route exact path="/overview" component={OverviewPage} />
          <Route path="*" component={NotFoundPage} />
        </Switch>
        {helpText ? (
          <Sider
            reverseArrow
            collapsible
            collapsed={helpCollapsed}
            onCollapse={() => setHelpCollapsed(!helpCollapsed)}
            collapsedWidth={30}
            theme="light"
            width={'40vw'}
            breakpoint="sm"
          >
            <div style={{paddingLeft: 10, paddingRight: 10}}>
              <ReactMarkdown
                source={helpText && !helpCollapsed ? helpText : ''}
              />
            </div>
          </Sider>
        ) : undefined}
      </Layout>
    </div>
  )
}

export default withRouter(App)
