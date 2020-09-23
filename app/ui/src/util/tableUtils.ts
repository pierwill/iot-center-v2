import { Table as GirrafeTable, newTable } from '@influxdata/giraffe'

/**
 * Selects latest value for given column.
 * Returns null if latest value is null or if column does not exist.
 */
export const tableGetColumnLatestVal = (
  table: GirrafeTable,
  column: string
): GirrafeTable | null => {
  const last = function <T>(arr: T[], lastN = 1) {
    if (!arr)
      return
    let index = arr.length - 1;
    while (index >= 0 && lastN) {
      const value = arr[index];
      if (value !== null && value !== undefined)
        return value;

      index--;
      lastN--;
    }
  }
  const columnVal = last(table.getColumn(column) as number[], 500)

  if (columnVal === null || columnVal === undefined) return null

  return newTable(1).addColumn('_value', table.getColumnType(column), [
    columnVal,
  ])
}

/**
 * Returns minimum and maximum time from table
 */
export const getXDomainFromTable = (
  table: GirrafeTable | undefined
): [number, number] | undefined => {
  const sorted = table?.getColumn('_time')?.slice()?.sort()
  if (sorted) return [sorted[0], sorted[sorted.length - 1]] as [number, number]
}
