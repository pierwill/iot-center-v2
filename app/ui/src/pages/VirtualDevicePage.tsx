import React, { useState, useEffect } from "react";
import PageContent, { Message } from "./PageContent";
import {
  InfluxDB,
  flux,
  WritePrecision,
  Point,
} from "@influxdata/influxdb-client";
import {
  Tooltip,
  Button,
  message as antdMessage,
  Progress,
  Descriptions,
} from "antd";
import { RouteComponentProps } from "react-router-dom";

interface DeviceConfig {
  influx_url: string;
  influx_org: string;
  influx_token: string;
  influx_bucket: string;
  id: string;
}
interface DeviceData {
  config: DeviceConfig;
  minValue?: number;
  maxValue?: number;
  maxTime?: string;
  count?: string;
}
type ProgressFn = (percent: number, current: number, total: number) => void;
const VIRTUAL_DEVICE = "virtual_device";

async function fetchDeviceConfig(
  deviceId = VIRTUAL_DEVICE
): Promise<DeviceConfig> {
  const response = await fetch(
    `/api/env/${deviceId}?register=${deviceId === VIRTUAL_DEVICE}`
  );
  if (response.status >= 300) {
    const text = await response.text();
    throw new Error(`${response.status} ${text}`);
  }
  const deviceConfig: DeviceConfig = await response.json();
  if (!deviceConfig.influx_token) {
    throw new Error(`Device '${deviceId}' is not authorized!`);
  }
  return deviceConfig;
}

async function fetchDeviceData(config: DeviceConfig): Promise<DeviceData> {
  const {
    // influx_url: url, // use '/influx' proxy to avoid problem with InfluxDB v2 Beta (Docker)
    influx_token: token,
    influx_org: org,
    influx_bucket: bucket,
    id,
  } = config;
  const influxDB = new InfluxDB({ url: "/influx", token });
  const queryApi = influxDB.getQueryApi(org);
  const results = await queryApi.collectRows<any>(flux`
from(bucket: ${bucket})
  |> range(start: -30d)
  |> filter(fn: (r) => r._measurement == "air")
  |> filter(fn: (r) => r.clientId == ${id})
  |> filter(fn: (r) => r._field == "temperature")
  |> group()
  |> reduce(
        fn: (r, accumulator) => ({
          maxTime: (if r._time>accumulator.maxTime then r._time else accumulator.maxTime),
          maxValue: (if r._value>accumulator.maxValue then r._value else accumulator.maxValue),
          minValue: (if r._value<accumulator.minValue then r._value else accumulator.minValue),
          count: accumulator.count + 1.0
        }),
        identity: {maxTime: 1970-01-01, count: 0.0, minValue: 10000.0, maxValue: -10000.0}
    )`);
  if (results.length > 0) {
    const { maxTime, minValue, maxValue, count } = results[0];
    return { config, maxTime, minValue, maxValue, count };
  }
  return { config };
}

async function writeEmulatedData(
  state: DeviceData,
  onProgress: ProgressFn
): Promise<number> {
  const {
    // influx_url: url, // use '/influx' proxy to avoid problems with InfluxDB v2 Beta (Docker)
    influx_token: token,
    influx_org: org,
    influx_bucket: bucket,
    id,
  } = state.config;
  // calculate window to emulate writes
  const toTime = Math.trunc(Date.now() / 60_000) * 60_000;
  let lastTime = state.maxTime
    ? Math.trunc(Date.parse(state.maxTime) / 60_000) * 60_000
    : 0;
  if (lastTime < toTime - 30 * 24 * 60 * 60 * 1000) {
    lastTime = toTime - 30 * 24 * 60 * 60 * 1000;
  }
  const totalPoints = Math.trunc((toTime - lastTime) / 60_000);
  let pointsWritten = 0;
  if (totalPoints > 0) {
    const batchSize = 2000;
    const influxDB = new InfluxDB({ url: "/influx", token });
    const writeApi = influxDB.getWriteApi(
      org,
      bucket,
      "ms" as WritePrecision.ms,
      { batchSize: batchSize + 1, defaultTags: { clientId: id } }
    );
    try {
      // write random temperatures
      const point = new Point("air"); // reuse the same point to spare memory
      onProgress(0, 0, totalPoints);
      while (lastTime < toTime) {
        lastTime += 60_000; // emulate next minute
        point
          .floatField("temperature", 10 + Math.trunc(100 * Math.random()) / 10)
          .timestamp(lastTime);
        writeApi.writePoint(point);

        pointsWritten++;
        if (pointsWritten % batchSize === 0) {
          await writeApi.flush();
          onProgress(
            (pointsWritten / totalPoints) * 100,
            pointsWritten,
            totalPoints
          );
        }
      }
      await writeApi.flush();
    } finally {
      await writeApi.close();
    }
    onProgress(100, pointsWritten, totalPoints);
  }

  return pointsWritten;
}

interface Props {
  deviceId?: string;
}

function VirtualDevicePage({ match }: RouteComponentProps<Props>) {
  const deviceId = match.params.deviceId ?? VIRTUAL_DEVICE;
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<Message | undefined>();
  const [deviceData, setDeviceData] = useState<DeviceData | undefined>();
  const [dataStamp, setDataStamp] = useState(0);
  const [progress, setProgress] = useState(-1);

  // fetch device configuration and relevant data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const deviceConfig = await fetchDeviceConfig(deviceId);
        const deviceData = await fetchDeviceData(deviceConfig);
        setDeviceData(deviceData);
      } catch (e) {
        console.error(e);
        setMessage({
          title: "Cannot load device data",
          description: String(e),
          type: "error",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dataStamp, deviceId]);

  function writeData() {
    const onProgress: ProgressFn = (percent, current, total) => {
      console.log(
        `writeData ${current}/${total} (${Math.trunc(percent * 100) / 100}%)`
      );
      setProgress(percent);
    };
    writeEmulatedData(deviceData as DeviceData, onProgress)
      .then((count) => {
        if (count) {
          antdMessage.success(
            <>
              New measurement point(s) were written to InfluxDB.
              <br />
              Measurement points written: <b>{count}</b>
            </>
          );
          setDataStamp(dataStamp + 1); // reload device data
        } else {
          antdMessage.info(
            `No new data were written to InfluxDB, the current measurement is already written`
          );
        }
      })
      .catch((e) => {
        console.error(e);
        setMessage({
          title: "Cannot write data",
          description: String(e),
          type: "error",
        });
      })
      .finally(() => setProgress(-1));
  }

  return (
    <PageContent
      title={
        deviceId === VIRTUAL_DEVICE ? "Virtual Device" : `Device ${deviceId}`
      }
      message={message}
      spin={loading}
    >
      {deviceId === VIRTUAL_DEVICE ? (
        <>
          <p>
            This page writes temperature measurements for the last 30 days from
            an emulated device, the temperature is reported every minute.
          </p>
          <br />
        </>
      ) : undefined}
      <Descriptions title="Device Configuration">
        <Descriptions.Item label="Device ID">
          {deviceData?.config.id}
        </Descriptions.Item>
        <Descriptions.Item label="InfluxDB URL">
          {deviceData?.config.influx_url}
        </Descriptions.Item>
        <Descriptions.Item label="InfluxDB Organization">
          {deviceData?.config.influx_org}
        </Descriptions.Item>
        <Descriptions.Item label="InfluxDB Bucket">
          {deviceData?.config.influx_bucket}
        </Descriptions.Item>
        <Descriptions.Item label="InfluxDB Token">
          {deviceData?.config.influx_token ? "***" : "N/A"}
        </Descriptions.Item>
      </Descriptions>
      <Descriptions title="Device Measurements (last 30 days)">
        <Descriptions.Item label="Measurement Points">
          {deviceData?.count}
        </Descriptions.Item>
        <Descriptions.Item label="Last measurement Time">
          {deviceData?.maxTime
            ? new Date(deviceData?.maxTime).toString()
            : undefined}
        </Descriptions.Item>
        <Descriptions.Item label="Minimum Temperature">
          {deviceData?.minValue}
        </Descriptions.Item>
        <Descriptions.Item label="Maximum Temperature">
          {deviceData?.maxValue}
        </Descriptions.Item>
      </Descriptions>
      {deviceId === VIRTUAL_DEVICE ? (
        <>
          <br />
          <div style={{ visibility: progress >= 0 ? "visible" : "hidden" }}>
            <Progress percent={progress >= 0 ? Math.trunc(progress) : 0} />
          </div>
          <Tooltip title="Write Missing Data for the last 30 days">
            <>
              <Button
                onClick={writeData}
                disabled={progress !== -1}
                style={{ marginRight: "8px" }}
              >
                Write New Data
              </Button>
            </>
          </Tooltip>
        </>
      ) : undefined}
      <Tooltip title="Reload Device Data">
        <Button
          onClick={() => setDataStamp(dataStamp + 1)}
          style={{ marginRight: "8px" }}
        >
          Reload
        </Button>
      </Tooltip>
    </PageContent>
  );
}

export default VirtualDevicePage;
