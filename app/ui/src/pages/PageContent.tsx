import React, { ReactNode } from "react";
import { Layout, PageHeader, Spin, Alert } from "antd";

export interface Message {
  title: string;
  description: string;
  type: "info" | "error";
}

export interface PageContentProps {
  title: ReactNode;
  children: ReactNode;
  spin?: boolean;
  message?: Message;
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
        {props.message ? (
          <Alert
            message={props.message.title}
            description={props.message.description}
            type={props.message.type}
            showIcon
            closable
          />
        ) : undefined}
        {content}
      </Layout.Content>
    </Layout>
  );
}
export default PageContent;
