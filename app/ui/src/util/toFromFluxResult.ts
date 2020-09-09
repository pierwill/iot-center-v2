import { InfluxDB, ParameterizedQuery } from "@influxdata/influxdb-client";
import { fromFlux, FromFluxResult } from "@influxdata/giraffe";

/**
 * Executes a flux query and collects results to a structure that can be used
 * in giraffe to render results visualizations.
 *
 * @param influxDB influxDB client configuration, including url and token
 * @param org Influx organization
 * @param query flux query string
 * @return Promise of data results
 */
async function toFromFluxResult(
  influxDB: InfluxDB,
  org: string,
  query: string | ParameterizedQuery
): Promise<FromFluxResult> {
  // TODO replace by influxDB.getQueryApi(org).raw(query)
  const fullResponse = await new Promise<string>((resolve, reject) => {
    let result = ''
    influxDB.getQueryApi(org).queryLines(query, {
      next(line: string){
        result += line
        result += '\n'
      },
      error(error: Error){
        reject(error)
      },
      complete(){
        resolve(result)
      }
    });
  })
  return fromFlux(fullResponse);
}

export default toFromFluxResult;
