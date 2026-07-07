'use client';

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type ColumnDef,
  type PaginationState,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { useState } from 'react';
import { TableEmpty, TablePagination, TableShell, TableToolbar } from '@/components/data-display/table-shell';

export function DataTable<TData>({
  columns,
  data,
  searchPlaceholder = '搜索',
}: {
  columns: ColumnDef<TData>[];
  data: TData[];
  searchPlaceholder?: string;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  // TanStack Table intentionally returns instance methods with stable internal state;
  // this React Compiler lint is expected here and does not indicate a runtime bug.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
      pagination,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="space-y-4">
      <TableToolbar
        onSearchChange={setGlobalFilter}
        searchPlaceholder={searchPlaceholder}
        searchValue={globalFilter}
      />

      <TableShell>
        <table className="w-full border-collapse text-left text-sm">
          <thead className="border-b border-border-subtle bg-slate-50/70 text-xs font-semibold text-slate-500">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-5 py-3 font-semibold">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border-subtle bg-white">
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-slate-50/50">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-5 py-3 text-slate-600">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <TableEmpty colSpan={columns.length} />
            )}
          </tbody>
        </table>
        <TablePagination
          end={Math.min((pagination.pageIndex + 1) * pagination.pageSize, table.getFilteredRowModel().rows.length)}
          onPageChange={(page) => table.setPageIndex(page - 1)}
          onPageSizeChange={(size) => table.setPageSize(size)}
          page={pagination.pageIndex + 1}
          pageCount={table.getPageCount() || 1}
          pageSize={pagination.pageSize}
          start={pagination.pageIndex * pagination.pageSize + 1}
          total={table.getFilteredRowModel().rows.length}
        />
      </TableShell>
    </div>
  );
}
