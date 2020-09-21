import {Table as GirrafeTable, newTable} from '@influxdata/giraffe'

// TODO: find way to select data to show through giraffe tools (like y in LinePlot)
/**
 * Selects latest value for given column.
 * Returns null if latest value is null or if column does not exist.
 */
export const tableGetColumnLatestVal = (
  table: GirrafeTable,
  column: string
) => {
  const last = function <T>(arr: T[]) {
    return arr && arr[arr.length - 1]
  }
  const columnVal = last(table.getColumn(column) as number[])

  if (!columnVal && columnVal !== 0) return null

  return newTable(1).addColumn('_value', 'number', [columnVal])
}
