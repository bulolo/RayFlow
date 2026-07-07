'use client';

const metricSkeletons = Array.from({ length: 3 });
const rowSkeletons = Array.from({ length: 6 });
const detailSkeletons = Array.from({ length: 6 });

export function ResourcePanelSkeleton({ metrics = 3, rows = 6 }: { metrics?: 2 | 3; rows?: number }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 border border-border-subtle bg-white">
        <div className="flex flex-col gap-3 border-b border-border-subtle px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-36 animate-pulse rounded bg-slate-200" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-20 animate-pulse rounded-md bg-slate-100" />
            <div className="h-8 w-28 animate-pulse rounded-md bg-slate-100" />
          </div>
        </div>
        <div className={`grid gap-3 border-b border-border-subtle p-5 ${metrics === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
          {metricSkeletons.slice(0, metrics).map((_, index) => (
            <div key={index} className="bg-slate-50 px-4 py-3">
              <div className="h-3 w-16 animate-pulse rounded bg-slate-200" />
              <div className="mt-2 h-6 w-10 animate-pulse rounded bg-slate-200" />
            </div>
          ))}
        </div>
        <div className="border-b border-border-subtle p-4">
          <div className="h-9 max-w-sm animate-pulse rounded-lg bg-slate-100" />
        </div>
        <div className="overflow-hidden">
          <div className="grid h-10 grid-cols-[1fr_1fr_1fr_1fr_6rem] items-center gap-4 bg-slate-50 px-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-3 animate-pulse rounded bg-slate-200" />
            ))}
          </div>
          {rowSkeletons.slice(0, rows).map((_, rowIndex) => (
            <div key={rowIndex} className="grid h-12 grid-cols-[1fr_1fr_1fr_1fr_6rem] items-center gap-4 border-t border-border-subtle px-4">
              {Array.from({ length: 5 }).map((_, columnIndex) => (
                <div
                  key={columnIndex}
                  className="h-3 animate-pulse rounded bg-slate-100"
                  style={{ width: `${columnIndex === 0 ? 78 : columnIndex === 4 ? 62 : 88}%` }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="border border-border-subtle bg-white p-5">
        <div className="flex items-center justify-between gap-3 border-b border-border-subtle pb-4">
          <div>
            <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
            <div className="mt-2 h-5 w-32 animate-pulse rounded bg-slate-200" />
          </div>
          <div className="h-6 w-16 animate-pulse rounded-full bg-slate-100" />
        </div>
        <div className="mt-4 space-y-3">
          {detailSkeletons.map((_, index) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
              <div className="h-3 animate-pulse rounded bg-slate-100" style={{ width: `${index % 2 === 0 ? 120 : 80}px` }} />
            </div>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="h-8 animate-pulse rounded-md bg-slate-100" />
          <div className="h-8 animate-pulse rounded-md bg-slate-100" />
        </div>
      </div>
    </div>
  );
}
