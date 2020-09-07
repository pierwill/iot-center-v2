import React, { useState } from "react";
import {
  Switch,
  Route,
  Redirect,
  RouteComponentProps,
  withRouter,
  NavLink,
  Link,
} from "react-router-dom";
import "./App.css";
import { Layout, Menu } from "antd";
import {
  HomeOutlined,
  BugOutlined,
  DoubleRightOutlined,
  FastForwardOutlined,
} from "@ant-design/icons";

import HomePage from "./pages/HomePage";
import DevicesPage from "./pages/DevicesPage";
import VirtualDevicePage from "./pages/VirtualDevicePage";
import NotFoundPage from "./pages/NotFoundPage";

const { Header, Sider } = Layout;

function App(props: RouteComponentProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = props.location.pathname;
  // console.log(pathname);
  return (
    <div className="App">
      <Layout style={{ minHeight: "100vh" }}>
        <Sider
          collapsible
          collapsed={collapsed as boolean}
          onCollapse={() => setCollapsed(!collapsed)}
        >
          <Header
            className="site-layout-background"
            style={{ padding: "10px" }}
          >
            <h1 style={{ color: "rgba(255,255,255,255)" }}>
              <Link to="/home">IoT&nbsp;Center</Link>
            </h1>
          </Header>
          <Menu theme="dark" selectedKeys={[pathname]} mode="inline">
            <Menu.Item key="/home" icon={<HomeOutlined />}>
              <NavLink to="/home">Home</NavLink>
            </Menu.Item>
            <Menu.Item key="/devices" icon={<DoubleRightOutlined />}>
              <NavLink to="/devices">Device Registrations</NavLink>
            </Menu.Item>
            <Menu.Item key="/devices/virtual_device" icon={<FastForwardOutlined />}>
              <NavLink to="/devices/virtual_device">Virtual Device</NavLink>
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
          <Route exact path="/devices/:deviceId" component={VirtualDevicePage} />
          <Route path="*" component={NotFoundPage} />
        </Switch>
      </Layout>
    </div>
  );
}

export default withRouter(App);
