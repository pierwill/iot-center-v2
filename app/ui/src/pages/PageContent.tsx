import React, { ReactNode } from "react";
import { Layout, PageHeader, Spin } from "antd";

export interface PageContentProps {
  title: ReactNode;
  children: ReactNode;
  spin?: boolean;
}

function PageContent(props: PageContentProps) {
  const content = props.spin ? (
    <div className="site-layout-background" style={{ minHeight: 360 }}>
      <Spin>{props.children}</Spin>
    </div>
  ) : (
    <div className="site-layout-background" style={{ minHeight: 360 }}>
      {props.children}
    </div>
  );
  return (
    <Layout className="site-layout">
      <PageHeader title={props.title} />
      <Layout.Content
        style={{
          paddingLeft: 24,
          paddingRight: 24,
          margin: 0,
          minHeight: 280,
        }}
      >
        {content}
      </Layout.Content>
    </Layout>
  );
}
export default PageContent;
