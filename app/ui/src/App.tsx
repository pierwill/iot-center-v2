import React, { useState } from "react";
import "./App.css";
import { Layout, Menu, Typography} from 'antd';

const { Header, Content, Footer, Sider } = Layout;
const { Title } = Typography;

function App() {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <div className="App">
      <Layout style={{ minHeight: '100vh' }}>
        <Sider collapsible collapsed={collapsed as boolean} onCollapse={() => setCollapsed(!collapsed)} >
          <Header className="site-layout-background" style={{ padding: '10px' }}><h1 style={{color:'rgba(255,255,255,255)'}}>IoT&nbsp;Center</h1></Header>
          <Menu theme="dark" defaultSelectedKeys={["1"]} mode="inline">
            <Menu.Item key="1">
              UC 1
            </Menu.Item>
            <Menu.Item key="2">
              UC 2
            </Menu.Item>
          </Menu>
        </Sider>
        <Layout className="site-layout" style={{padding: 24}}>
          <Title>UC1 Content Header</Title>
          <Content>
            <div
              className="site-layout-background"
              style={{ minHeight: 360 }}
            >
              Bill is a cat.
            </div>
          </Content>
          <Footer style={{ textAlign: "center" }}>
            Link to Source Code
          </Footer>
        </Layout>
      </Layout>
    </div>
  );
}

export default App;
