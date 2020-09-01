import { ReactElement } from "react";
import React from "react";
import { Layout, PageHeader } from "antd";

export interface PageContentProps {
  title: string;
  children: ReactElement<any>;
}

function PageContent(props: PageContentProps) {
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
        <div className="site-layout-background" style={{ minHeight: 360 }}>
          {props.children}
        </div>
      </Layout.Content>
    </Layout>
  );
}
export default PageContent;
