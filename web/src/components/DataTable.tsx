import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef, type OnChangeFn, type Row, type SortingState } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[]
  data: T[]
  loading?: boolean
  skeletonRows?: number
  empty?: ReactNode
  sorting?: SortingState
  onSortingChange?: OnChangeFn<SortingState>
  manualSorting?: boolean
  onRowClick?: (row: Row<T>) => void
  rowClassName?: (row: Row<T>) => string | undefined
  getRowId?: (row: T, index: number) => string
  className?: string
  dense?: boolean
}

// Headless TanStack Table + our table primitives. Sorting is client-side by
// default; pass manualSorting + onSortingChange for server-driven lists.
export function DataTable<T>({ columns, data, loading = false, skeletonRows = 6, empty, sorting, onSortingChange, manualSorting = false, onRowClick, rowClassName, getRowId, className, dense = false }: DataTableProps<T>) {
  const table = useReactTable({
    data,
    columns,
    state: sorting ? { sorting } : undefined,
    onSortingChange,
    manualSorting,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: manualSorting ? undefined : getSortedRowModel()
  })
  const colCount = columns.length

  return (
    <Table className={className} aria-busy={loading || undefined} data-loading={loading ? 'true' : undefined}>
      <TableHeader>
        {table.getHeaderGroups().map((hg) => (
          <TableRow key={hg.id} className="hover:bg-transparent">
            {hg.headers.map((header) => {
              const canSort = header.column.getCanSort()
              const dir = header.column.getIsSorted()
              const meta = header.column.columnDef.meta as { align?: 'right' | 'center'; width?: string } | undefined
              return (
                <TableHead key={header.id} style={meta?.width ? { width: meta.width } : undefined} className={cn(meta?.align === 'right' && 'text-right', meta?.align === 'center' && 'text-center')}>
                  {header.isPlaceholder ? null : canSort ? (
                    <button type="button" onClick={header.column.getToggleSortingHandler()} className={cn('inline-flex items-center gap-1 rounded hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring', dir && 'text-foreground')} aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none'}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {dir === 'asc' ? <ArrowUp className="size-3.5" /> : dir === 'desc' ? <ArrowDown className="size-3.5" /> : <ArrowUpDown className="size-3.5 opacity-50" />}
                    </button>
                  ) : (
                    flexRender(header.column.columnDef.header, header.getContext())
                  )}
                </TableHead>
              )
            })}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {loading ? (
          Array.from({ length: skeletonRows }).map((_, i) => (
            <TableRow key={`s-${i}`} className="hover:bg-transparent" data-skeleton="true" aria-hidden>
              {Array.from({ length: colCount }).map((__, j) => (
                <TableCell key={j} className={dense ? 'py-1.5' : undefined}>
                  <Skeleton className={cn('h-4', j === 0 ? 'w-16' : j === 1 ? 'w-40' : 'w-24')} />
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : table.getRowModel().rows.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={colCount} className="p-0">
              {empty}
            </TableCell>
          </TableRow>
        ) : (
          table.getRowModel().rows.map((row) => (
            <TableRow key={row.id} onClick={onRowClick ? () => onRowClick(row) : undefined} className={cn(onRowClick && 'cursor-pointer', rowClassName?.(row))}>
              {row.getVisibleCells().map((cell) => {
                const meta = cell.column.columnDef.meta as { align?: 'right' | 'center'; className?: string } | undefined
                return (
                  <TableCell key={cell.id} className={cn(dense && 'py-1.5', meta?.align === 'right' && 'text-right', meta?.align === 'center' && 'text-center', meta?.className)}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                )
              })}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
