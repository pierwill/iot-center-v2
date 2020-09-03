import React, { useState, useEffect } from "react";
import PageContent from "./PageContent";
import { Alert, Table, Button, Popconfirm, message as antMessage } from "antd";

interface DeviceInfo {
  key: string;
  clientId: string;
  createdAt: string;
}

interface Message {
  title: string;
  description: string;
  type: "info" | "error";
}

const NO_DEVICES: Array<DeviceInfo> = [];
const NO_MESSAGE: Message | undefined = undefined;

function DevicesPage() {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(NO_MESSAGE);
  const [data, setData] = useState(NO_DEVICES);
  const [dataTime, setDataTime] = useState(Date.now());
  useEffect(() => {
    setLoading(false);
    fetch("/api/devices")
      .then((response) => response.json())
      .then(setData)
      .catch((e) =>
        setMessage({
          title: "Cannot fetch data",
          description: String(e),
          type: "error",
        })
      )
      .finally(() => setLoading(false));
  }, [dataTime]);

  // code that handles removal of authorizations
  const removeAuthorization = (device: DeviceInfo) => {
    // console.log("Removing: " + device.key);
    setLoading(true);
    fetch(`/api/devices/${device.key}`, { method: "DELETE" })
      .then(async (response) => {
        console.log(response.status);
        if (response.status >= 300) {
          const text = await response.text();
          throw new Error(`${response.status} ${text}`);
        }
      })
      .then(() => {
        setLoading(false);
        antMessage.success(`Device ${device.clientId} was unregistered`, 2);
      })
      .catch((e) => {
        setLoading(false);
        setMessage({
          title: "Cannot remove device",
          description: String(e),
          type: "error",
        });
      })
      .finally(() => setDataTime(Date.now()));
  }

  // define table columns
  const columnDefinitions = [
    {
      title: "Client ID",
      dataIndex: "clientId",
      defaultSortOrder: "ascend" as "ascend",
      sorter: (a: DeviceInfo, b: DeviceInfo) => (a.clientId > b.clientId ? 1 : -1),
    },
    {
      title: "Registration Time",
      dataIndex: "createdAt",
    },
    {
      title: "",
      key: "action",
      align: "right" as "right",
      render: (_: string, device: DeviceInfo) => (
        <Popconfirm
          title={`Are you sure to remove '${device.clientId}' ?`}
          onConfirm={() => removeAuthorization(device)}
          okText="Yes"
          cancelText="No"
        >
          <Button type="link">Remove</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <PageContent title="Device Registrations" spin={loading}>
      {message ? (
        <Alert
          message={message.title}
          description={message.description}
          type={message.type}
          showIcon
          closable
        />
      ) : undefined}
      <Table dataSource={data} columns={columnDefinitions}></Table>
      <Button type="primary" onClick={() => setDataTime(Date.now)}>
        Reload
      </Button>
    </PageContent>
  );
}

export default DevicesPage;
