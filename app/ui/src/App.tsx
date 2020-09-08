import React, { useState, useEffect } from "react";
import {
  Switch,
  Route,
  Redirect,
  RouteComponentProps,
  withRouter,
  NavLink,
} from "react-router-dom";
import ReactMarkdown from "react-markdown";
import "./App.css";
import { Layout, Menu, Tooltip } from "antd";
import {
  HomeOutlined,
  BugOutlined,
  DoubleRightOutlined,
  FastForwardOutlined,
  LeftOutlined,
  RightOutlined,
} from "@ant-design/icons";

import HomePage from "./pages/HomePage";
import DevicesPage from "./pages/DevicesPage";
import DevicePage from "./pages/DevicePage";
import NotFoundPage from "./pages/NotFoundPage";

const { Sider } = Layout;
const PAGE_HELP: Record<string, { file: string }> = {
  "/devices": { file: "/help/DevicesPage.md" },
  "/devices/virtual_device": { file: "/help/VirtualDevicePage.md" },
};

function useHelpCollapsed(): [boolean, (v: boolean) => void] {
  const [helpCollapsed, setHelpCollapsed] = useState(
    localStorage?.getItem("helpCollapsed") === "true"
  );
  const changeHelpCollapsed = (v: boolean) => {
    setHelpCollapsed(v);
    localStorage?.setItem("helpCollapsed", String(v));
  };
  return [helpCollapsed, changeHelpCollapsed];
}

function App(props: RouteComponentProps) {
  const [menuCollapsed, setMenuCollapsed] = useState(false);
  const [helpCollapsed, setHelpCollapsed] = useHelpCollapsed();
  const [helpText, setHelpText] = useState("");
  const page = PAGE_HELP[props.location.pathname];
  useEffect(() => {
    setHelpText("");
    if (page) {
      fetch(page.file)
        .then((res) => res.text())
        .then((txt) =>
          setHelpText(txt.startsWith("<!") ? "HELP NOT FOUND" : txt)
        )
        .catch((e) => console.error);
    }
  }, [page]);

  return (
    <div className="App">
      <Layout style={{ minHeight: "100vh" }}>
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
          <Route
            exact
            path="/devices/:deviceId"
            component={DevicePage}
          />
          <Route path="*" component={NotFoundPage} />
        </Switch>
        {helpText ? (
          helpCollapsed ? (
            <Tooltip title="Show Help">
              <div
                className="ant-layout-sider-trigger"
                style={{
                  position: "absolute",
                  bottom: 0,
                  right: 0,
                  paddingLeft: 16,
                  paddingRight: 16,
                }}
                onClick={() => setHelpCollapsed(false)}
              >
                <span className="anticon">
                  <LeftOutlined />
                </span>
              </div>
            </Tooltip>
          ) : (
            <aside
              className="ant-layout-sider ant-layout-sider-light ant-layout-sider-has-trigger"
              style={{
                width: "30vw",
                paddingLeft: 16,
                paddingRight: 16,
                paddingTop: 24,
                paddingBottom: 24,
                minWidth: 200,
              }}
            >
              <div className="ant-layout-sider-children">
                <ReactMarkdown source={helpText} />
              </div>
              <div
                className="ant-layout-sider-trigger"
                style={{
                  width: "30vw",
                }}
              >
                <Tooltip title="Hide Help">
                  <span
                    className="anticon"
                    onClick={() => setHelpCollapsed(true)}
                  >
                    <RightOutlined />
                  </span>
                </Tooltip>
              </div>
            </aside>
          )
        ) : undefined}
      </Layout>
    </div>
  );
}

export default withRouter(App);
