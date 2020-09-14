import React, { useState, useEffect } from "react";
import PageContent, { Message } from "./PageContent";
import {
  Table,
  Button,
  Popconfirm,
  message as antdMessage,
  Tooltip,
  Modal,
  Form,
  Input,
} from "antd";
import { Link } from "react-router-dom";

interface DeviceInfo {
  key: string;
  deviceId: string;
  createdAt: string;
}

const NO_DEVICES: Array<DeviceInfo> = [];

function DevicesPage() {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<Message | undefined>(undefined);
  const [data, setData] = useState(NO_DEVICES);
  const [dataStamp, setDataStamp] = useState(0);
  useEffect(() => {
    setLoading(true);
    fetch("/api/devices")
      .then(async (response) => {
        if (response.status >= 300) {
          const text = await response.text();
          throw new Error(`${response.status} ${text}`);
        }
        return response;
      })
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
  }, [dataStamp]);

  const removeAuthorization = (device: DeviceInfo) => {
    setLoading(true);
    fetch(`/api/devices/${device.key}`, { method: "DELETE" })
      .then(async (response) => {
        if (response.status >= 300) {
          const text = await response.text();
          throw new Error(`${response.status} ${text}`);
        }
        return response;
      })
      .then(() => {
        setLoading(false);
        antdMessage.success(`Device ${device.deviceId} was unregistered`, 2);
      })
      .catch((e) => {
        setLoading(false);
        setMessage({
          title: "Cannot remove device",
          description: String(e),
          type: "error",
        });
      })
      .finally(() => setDataStamp(dataStamp + 1));
  };

  const addAuthorization = (deviceId: string) => {
    setLoading(true);
    fetch(`/api/env/${deviceId}`)
      .then(async (response) => {
        if (response.status >= 300) {
          const text = await response.text();
          throw new Error(`${response.status} ${text}`);
        }
        return response.json();
      })
      .then(({ newlyRegistered }) => {
        setLoading(false);
        if (newlyRegistered) {
          antdMessage.success(`Device '${deviceId}' was registered`, 2);
        } else {
          antdMessage.success(`Device '${deviceId}' is already registered`, 2);
        }
      })
      .catch((e) => {
        setLoading(false);
        setMessage({
          title: "Cannot register device",
          description: String(e),
          type: "error",
        }); 
      })
      .finally(() => setDataStamp(dataStamp + 1));
  };

  // define table columns
  const columnDefinitions = [
    {
      title: "Device ID",
      dataIndex: "deviceId",
      defaultSortOrder: "ascend" as "ascend",
      render: (deviceId: string) => (<Link to={`/devices/${deviceId}`}>{deviceId}</Link>),
      sorter: (a: DeviceInfo, b: DeviceInfo) =>
        a.deviceId > b.deviceId ? 1 : -1,
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
          title={`Are you sure to remove '${device.deviceId}' ?`}
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
    <PageContent title="Device Registrations" spin={loading} message={message}>
      <Table dataSource={data} columns={columnDefinitions}></Table>
      <Tooltip title="Reload Table">
        <Button
          type="primary"
          onClick={() => setDataStamp(dataStamp + 1)}
          style={{ marginRight: "8px" }}
        >
          Reload
        </Button>
      </Tooltip>
      <Tooltip title="Register a new Device">
        <Button
          type="dashed"
          onClick={() => {
            let deviceId = "";
            Modal.confirm({
              title: "Register Device",
              icon: "",
              content: (
                <Form name="registerDevice" initialValues={{ deviceId }}>
                  <Form.Item
                    name="deviceId"
                    rules={[
                      { required: true, message: "Please input device ID !" },
                    ]}
                  >
                    <Input
                      placeholder="Device ID"
                      onChange={(e) => (deviceId = e.target.value)}
                    />
                  </Form.Item>
                </Form>
              ),
              onOk: () => {
                addAuthorization(deviceId);
              },
              okText: "Register",
            });
          }}
        >
          Register
        </Button>
      </Tooltip>
    </PageContent>
  );
}

export default DevicesPage;
