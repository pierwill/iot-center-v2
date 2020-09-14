import {
  ParameterizedQuery,
  QueryApi,
  FluxTableMetaData,
  ColumnType as ClientColumnType,
  Cancellable,
} from '@influxdata/influxdb-client'
import {Table, ColumnType, ColumnData, fromFlux} from '@influxdata/giraffe'

/**
 * Stores data and metadata of a result column.
 */
interface ColumnStore {
  /** column name */
  name: string
  /** column type */
  type: ColumnType
  /** column data */
  data: ColumnData
  /** converts string to column value */
  toValue: (row: string[]) => number | string | boolean
  /** marker to indicate that this column can have multiple keys  */
  multipleTypes?: true
  /** it this column part of the group key */
  group?: boolean
}

function toTableColumns(
  columns: Record<string, ColumnStore>,
  tableLength: number
): Record<string, ColumnStore> {
  return Object.keys(columns).reduce((acc, val) => {
    const col = columns[val]
    if (!col.multipleTypes) {
      acc[val] = col
      ;(col.data as any).length = tableLength // extend the array length, required by test
    }
    return acc
  }, {} as Record<string, ColumnStore>)
}

/**
 * Contains parameters that optimize/drive creation of the query result Table.
 */
export interface TableOptions {
  /** max size of the result table */
  maxTableSize?: number
  /** column keys to collect, undefined means all columns */
  columns?: string[]
}

/** QUERY_OPTIMIZED=false changes the queryTable function to simply use queryRawTable */
export let QUERY_OPTIMIZED = true // eslint-disable-line prefer-const
/** prints out query and its processing time  */
export let DEBUG_queryTable = true // eslint-disable-line prefer-const

/**
 * Executes a flux query and iterrativelly collects results into a giraffe's Table depending on the TableOptions supplied.
 *
 * @param queryApi InfluxDB client's QuiryApi instance
 * @param query query to execute
 * @param tableOptions tableOptions allows to specify maximum rows to process, or columns to create
 * @return Promise  with query results
 */
export async function queryTable(
  queryApi: QueryApi,
  query: string | ParameterizedQuery,
  tableOptions: TableOptions = {}
): Promise<Table> {
  const {maxTableSize, columns: onlyColumns} = tableOptions
  const startTime = Date.now()
  const timeSpentInThisFunction = DEBUG_queryTable
    ? () => {
        console.log(`queryTable took ${Date.now() - startTime}ms: ${query}`)
      }
    : () => undefined
  if (!QUERY_OPTIMIZED) {
    return await queryRawTable(queryApi, query).finally(timeSpentInThisFunction)
  }
  const columns: Record<string, ColumnStore> = {}
  let dataColumns: ColumnStore[]
  let lastTableMeta: FluxTableMetaData = new FluxTableMetaData([])
  let tableSize = 0
  let cancellable: Cancellable
  return new Promise<Table>((resolve, reject) => {
    queryApi.queryRows(query, {
      next(row: string[], tableMeta: FluxTableMetaData) {
        if (tableMeta !== lastTableMeta) {
          dataColumns = []
          for (const metaCol of tableMeta.columns) {
            const type = toGiraffeColumnType(metaCol.dataType)
            if (onlyColumns && !onlyColumns.includes(metaCol.label)) {
              continue // exclude this column
            }

            // handle the rare situation of having columns with the same name, but different type
            let columnKey = metaCol.label
            let existingColumn = columns[columnKey]
            if (existingColumn) {
              if (existingColumn.multipleTypes) {
                // multiple column types of the same name already found
                // use type-specific column key
                columnKey = `${metaCol.label} (${type})`
                existingColumn = columns[columnKey]
              } else if (existingColumn.type !== type) {
                // move the existing key to a type-specific key
                columns[
                  `${existingColumn.name} (${existingColumn.type})`
                ] = existingColumn
                // occupy the column by a multiType virtual column
                columns[metaCol.label] = {
                  name: metaCol.label,
                  type: existingColumn.type,
                  data: [],
                  multipleTypes: true,
                  toValue: () => '',
                }
                //
                columnKey = `${metaCol.label} (${type})`
                existingColumn = columns[columnKey]
              }
            }
            const column = {
              name: metaCol.label,
              type,
              data: existingColumn ? existingColumn.data : [],
              group: metaCol.group,
              toValue: toValueFn(metaCol.index, type, metaCol.defaultValue),
            }

            dataColumns.push(column)
            columns[columnKey] = column
          }
          lastTableMeta = tableMeta
        }
        if (maxTableSize !== undefined && maxTableSize <= tableSize) {
          cancellable.cancel()
          return
        }
        for (let i = 0; i < dataColumns.length; i++) {
          const column = dataColumns[i]
          column.data[tableSize] = column.toValue(row)
        }
        tableSize++
      },
      complete() {
        resolve(new SimpleTable(tableSize, toTableColumns(columns, tableSize)))
      },
      error(e: Error) {
        if (e?.name === 'AbortError') {
          resolve(
            new SimpleTable(tableSize, toTableColumns(columns, tableSize))
          )
        }
        reject(e)
      },
      useCancellable(val: Cancellable) {
        cancellable = val
      },
    })
  }).finally(timeSpentInThisFunction)
}

/**
 * Executes a flux to a raw string and then creates a giraffe Table from the string.
 *
 * @param queryApi InfluxDB client's QuiryApi instance
 * @param query query to execute
 * @return Promise  with query results
 */
export async function queryRawTable(
  queryApi: QueryApi,
  query: string | ParameterizedQuery
): Promise<Table> {
  const raw = await queryApi.queryRaw(query)
  return fromFlux(raw).table
}

/**
 * Creates a function that returns a column value from row data.
 *
 * @param rowIndex index of a string value in the row data
 * @param type column type
 * @param def default value
 * @returns column value to store in a table
 */
function toValueFn(
  rowIndex: number,
  type: ColumnType,
  def: string
): (row: string[]) => number | string | boolean {
  // from: 'boolean' | 'unsignedLong' | 'long' | 'double' | 'string' | 'base64Binary' | 'dateTime:RFC3339' | 'duration'
  switch (type) {
    case 'boolean':
      return (row: string[]) =>
        (row[rowIndex] === '' ? def : row[rowIndex]) === 'true'
    case 'number':
      return (row: string[]) => {
        const val = row[rowIndex] === '' ? def : row[rowIndex]
        return val === '' ? ((null as any) as number) : Number(val) // TODO wrong API reference
      }
    case 'time':
      return (row: string[]) =>
        Date.parse(row[rowIndex] === '' ? def : row[rowIndex])
    default:
      return (row: string[]) => (row[rowIndex] === '' ? def : row[rowIndex])
  }
}

/**
 * Converts between columns types.
 *
 * @param clientType @influxdata/influxdb-client column type
 * @returns @influxdata/giraffe column type
 */
function toGiraffeColumnType(clientType: ClientColumnType): ColumnType {
  // from: 'boolean' | 'unsignedLong' | 'long' | 'double' | 'string' | 'base64Binary' | 'dateTime:RFC3339' | 'duration'
  // to:   'number' | 'string' | 'time' | 'boolean'
  switch (clientType) {
    case 'boolean':
      return 'boolean'
    case 'unsignedLong':
    case 'long':
    case 'double':
      return 'number'
    case 'dateTime:RFC3339':
      return 'time'
    default:
      return 'string'
  }
}

// internal implementation of Table interface
class SimpleTable implements Table {
  public readonly length: number = 0

  private columns: Record<
    string,
    Pick<ColumnStore, 'name' | 'type' | 'data'>
  > = {}

  constructor(
    length: number,
    columns: Record<string, Pick<ColumnStore, 'name' | 'type' | 'data'>>
  ) {
    this.length = length
    this.columns = columns
  }

  get columnKeys(): string[] {
    return Object.keys(this.columns)
  }

  getColumn(columnKey: string, columnType?: ColumnType): any[] | null {
    const column = this.columns[columnKey]
    if (!column) {
      return null
    }

    // Allow time columns to be retrieved as number columns
    const isWideningTimeType = columnType === 'number' && column.type === 'time'
    if (columnType && columnType !== column.type && !isWideningTimeType) {
      return null
    }

    switch (columnType) {
      case 'number':
        return column.data as number[]
      case 'time':
        return column.data as number[]
      case 'string':
        return column.data as string[]
      case 'boolean':
        return column.data as boolean[]
      default:
        return column.data as any[]
    }
  }

  getColumnName(columnKey: string): string {
    const column = this.columns[columnKey]

    if (!column) {
      return (null as any) as string // TODO wrong API interface in giraffe
    }

    return column.name
  }

  getColumnType(columnKey: string): ColumnType {
    const column = this.columns[columnKey]

    if (!column) {
      return (null as any) as ColumnType // TODO wrong API interface in giraffe
    }

    return column.type
  }

  addColumn(
    columnKey: string,
    type: ColumnType,
    data: ColumnData,
    name?: string
  ): Table {
    if (this.columns[columnKey]) {
      throw new Error('column already exists')
    }

    if (data.length !== this.length) {
      throw new Error(
        `expected column of length ${this.length}, got column of length ${data.length} instead`
      )
    }

    return new SimpleTable(this.length, {
      ...this.columns,
      [columnKey]: {
        name: name || columnKey,
        type,
        data,
      },
    })
  }
}
