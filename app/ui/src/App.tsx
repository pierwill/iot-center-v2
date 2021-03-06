import React, {useState, useEffect, FunctionComponent} from 'react'
import {
  Switch,
  Route,
  Redirect,
  RouteComponentProps,
  withRouter,
  NavLink,
  matchPath,
  RouteProps,
} from 'react-router-dom'
import Markdown from './util/Markdown'
import './App.css'
import {Layout, Menu} from 'antd'
import {
  HomeOutlined,
  DoubleRightOutlined,
  FastForwardOutlined,
  AreaChartOutlined,
} from '@ant-design/icons'

import HomePage from './pages/HomePage'
import DevicesPage from './pages/DevicesPage'
import DevicePage from './pages/DevicePage'
import NotFoundPage from './pages/NotFoundPage'
import DashboardPage from './pages/DashboardPage'

export const VIRTUAL_DEVICE = 'virtual_device'

const {Sider} = Layout
const PAGE_HELP: Array<{
  file: string
  matcher: string | RouteProps | string[]
}> = [
  {
    file: '/help/DevicesPage.md',
    matcher: {
      path: '/devices',
      exact: true,
    },
  },
  {
    file: '/help/VirtualDevicePage.md',
    matcher: '/devices/virtual_device',
  },
  {
    file: '/help/DevicePage.md',
    matcher: '/devices/:device',
  },
  {
    file: '/help/DashboardPage.md',
    matcher: '/dashboard/:device',
  },
]

const getPageHelp = (url: string) =>
  PAGE_HELP.filter(({matcher}) => matchPath(url, matcher)).map(
    ({file}) => file
  )[0]

const useHelpCollapsed = (): [boolean, (v: boolean) => void] => {
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

  const help = getPageHelp(props.location.pathname)

  useEffect(() => {
    setHelpText('')
    if (help) {
      // load markdown from file
      ;(async () => {
        try {
          const response = await fetch(help)
          const txt = await response.text()
          setHelpText((txt ?? '').startsWith('<!') ? 'HELP NOT FOUND' : txt)
        } catch (e) {
          console.error(e)
        }
      })()
    }
  }, [help])

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
            selectedKeys={[
              props.location.pathname,
              ...(matchPath(props.location.pathname, '/dashboard/:device')
                ? ['/dashboard/:device']
                : []),
            ]}
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
            <Menu.Item key="/dashboard/:device" icon={<AreaChartOutlined />}>
              <NavLink to="/dashboard">Dashboard</NavLink>
            </Menu.Item>
            {}
          </Menu>
        </Sider>
        <Switch>
          <Redirect exact from="/" to="/home" />
          <Route exact path="/home" component={HomePage} />
          <Route
            exact
            path="/devices"
            render={(props) => (
              <DevicesPage {...props} helpCollapsed={helpCollapsed} />
            )}
          />
          <Route
            exact
            path="/devices/:deviceId"
            render={(props) => (
              <DevicePage {...props} helpCollapsed={helpCollapsed} />
            )}
          />
          <Redirect
            exact
            from="/dashboard"
            to={`/dashboard/${VIRTUAL_DEVICE}`}
          />
          <Route
            exact
            path="/dashboard/:deviceId"
            render={(props) => (
              <DashboardPage {...props} helpCollapsed={helpCollapsed} />
            )}
          />
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
            width={'20vw'}
            breakpoint="sm"
          >
            <div style={{paddingLeft: 10, paddingRight: 10}}>
              <Markdown source={helpText && !helpCollapsed ? helpText : ''} />
            </div>
          </Sider>
        ) : undefined}
      </Layout>
    </div>
  )
}

export default withRouter(App)
