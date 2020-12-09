## Devices Page

_You can find the [source code for this page on Github](https://github.com/bonitoo-io/iot-center-v2/blob/master/app/ui/src/pages/DevicesPage.tsx)_.

In this line we import the InfluxDB client:
```js
import {flux, InfluxDB} from '@influxdata/influxdb-client'
```



### Flux

We use Flux to get the result.

```js
const result = await queryTable(
  queryApi,
  flux`
import "influxdata/influxdb/v1"
from(bucket: ${bucket})
  |> range(start: -1y)
  |> filter(fn: (r) => r.clientId == ${id})
  |> filter(fn: (r) => r._measurement == "environment")
  |> keep(columns: ["_time"])
  |> max(column: "_time")
  `
)
```
