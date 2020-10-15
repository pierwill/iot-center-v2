// TODO this is temporary solution, the file was taken from @influxdata/giraffe
import {Table, ColumnType, ColumnData, FluxDataType} from '@influxdata/giraffe'

// Don't export me!
class SimpleTable implements Table {
  public readonly length: number = 0

  private columns: {
    [colKey: string]: {
      name: string
      type: ColumnType
      data: ColumnData
    }
  }

  constructor(
    length: number,
    columns: {
      [colKey: string]: {
        name: string
        type: ColumnType
        data: ColumnData
      }
    } = {}
  ) {
    this.length = length
    this.columns = columns
  }

  // features we are using, doesn't care about column type
  getOriginalColumnType():
    | 'string'
    | 'boolean'
    | 'unsignedLong'
    | 'long'
    | 'double'
    | 'dateTime:RFC3339'
    | 'system'
    | null {
    return null
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
      return (null as any) as string // TODO remove when https://github.com/influxdata/giraffe/pull/279 merged
    }

    return column.name
  }

  getColumnType(columnKey: string): ColumnType {
    const column = this.columns[columnKey]

    if (!column) {
      return (null as any) as ColumnType // TODO remove when https://github.com/influxdata/giraffe/pull/279 merged
    }

    return column.type
  }

  addColumn(
    columnKey: string,
    _fluxDataType: FluxDataType,
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

    const table = new SimpleTable(this.length)

    table.columns = {
      ...this.columns,
      [columnKey]: {
        name: name || columnKey,
        type,
        data,
      },
    }

    return table
  }
}

export const newTable = (
  length: number,
  columns: {
    [colKey: string]: {
      name: string
      type: ColumnType
      data: ColumnData
    }
  } = {}
): Table => new SimpleTable(length, columns)
