'use client';

import type { ReactNode } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export function TableShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('overflow-hidden rounded-lg border border-border/80 bg-white shadow-sm', className)}>
      {children}
    </div>
  );
}

export function TableEmpty({
  colSpan,
  message = '暂无数据',
}: {
  colSpan: number;
  message?: string;
}) {
  return (
    <tr>
      <td className="px-5 py-12 text-center text-sm font-medium text-slate-400" colSpan={colSpan}>
        {message}
      </td>
    </tr>
  );
}

export function TableToolbar({
  action,
  onSearchChange,
  searchPlaceholder = '搜索',
  searchValue,
}: {
  action?: ReactNode;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  searchValue: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          className="h-9 w-full rounded-lg border border-border bg-white pl-9 pr-3 text-sm placeholder-slate-400 outline-none transition duration-150 focus:border-primary focus:ring-2 focus:ring-primary/15"
        />
      </label>
      <div className="flex shrink-0 items-center gap-3">
        {action}
      </div>
    </div>
  );
}

export function TablePagination({
  disabled,
  end,
  onPageChange,
  onPageSizeChange,
  page,
  pageCount,
  pageSize,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  start,
  total,
}: {
  disabled?: boolean;
  end: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  page: number;
  pageCount: number;
  pageSize: number;
  pageSizeOptions?: number[];
  start: number;
  total: number;
}) {
  const normalizedPageCount = Math.max(1, pageCount);

  return (
    <div className="flex h-12 items-center justify-between border-t border-border-subtle bg-white px-4">
      <div className="flex items-center gap-3 text-xs font-medium text-slate-500">
        <span>
          显示 {total ? start : 0}-{end} 条，共 {total} 条
        </span>
        <label className="flex items-center gap-1.5">
          <span className="text-slate-400">每页</span>
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="h-7 rounded-md border border-border bg-white px-2 text-xs font-semibold text-slate-600 outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
            disabled={disabled}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span className="text-slate-400">条</span>
        </label>
      </div>
      <div className="flex items-center gap-2">
        <Button
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          variant="ghost"
          className="h-8 px-2.5 text-xs text-slate-500 disabled:opacity-40"
        >
          上一页
        </Button>
        <span className="min-w-10 rounded bg-slate-100 px-2 py-1 text-center text-xs font-semibold text-slate-500">
          {page} / {normalizedPageCount}
        </span>
        <Button
          disabled={disabled || page >= normalizedPageCount}
          onClick={() => onPageChange(Math.min(normalizedPageCount, page + 1))}
          variant="ghost"
          className="h-8 px-2.5 text-xs text-slate-500 disabled:opacity-40"
        >
          下一页
        </Button>
      </div>
    </div>
  );
}
