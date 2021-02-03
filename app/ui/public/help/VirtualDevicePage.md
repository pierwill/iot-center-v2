## Virtual Device page

[_Source code for this page on GitHub_](https://github.com/bonitoo-io/iot-center-v2/blob/master/app/ui/src/pages/DevicePage.tsx)

The virtual device emulates a real device, generating examples data so that we can use IoT Center without needing a real device.
It writes measurements for every minute in the last 30 days.
It can also generate and send temperature, humidity, pressure, CO2, TVOC, latitude, and longitude measurements.

The “device” is a piece of code that runs in the browser.
It uses the [influxdb-client-js] library.
It gets the configuration of how to communicate with InfluxDB (URL, organization, bucket, token) from IoT center.

For more, see the [*InfluxDB IoT dev guide*](https://influxdata.github.io/iot-dev-guide/pages/virtual-device.html).
