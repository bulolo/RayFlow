'use client';

import { useEffect, useRef } from 'react';
import { Tooltip } from '@/components/ui';
import type { PreviewData } from '@/features/development/components/job-editor-types';

export function PreviewPanel({
  data,
  loading,
  outputLoading,
  outputText,
  activeTab,
  onActiveTabChange,
  showResultTab = true,
  onClear,
  onResizeStart,
  onCollapse,
  onExpand,
  isCollapsed,
}: {
  data: PreviewData | null;
  loading: boolean;
  outputLoading: boolean;
  outputText?: string;
  activeTab: 'result' | 'output';
  onActiveTabChange: (tab: 'result' | 'output') => void;
  showResultTab?: boolean;
  onClear: () => void;
  onResizeStart: (event: React.MouseEvent) => void;
  onCollapse: () => void;
  onExpand: () => void;
  isCollapsed: boolean;
}) {
  const outputRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showResultTab && activeTab === 'result') {
      onActiveTabChange('output');
    }
  }, [activeTab, onActiveTabChange, showResultTab]);

  useEffect(() => {
    if (activeTab !== 'output' || isCollapsed) return;
    const node = outputRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [activeTab, isCollapsed, outputLoading, outputText]);

  function handleTabClick(tab: 'result' | 'output') {
    if (activeTab === tab) {
      if (isCollapsed) {
        onExpand();
      } else {
        onCollapse();
      }
    } else {
      onActiveTabChange(tab);
      if (isCollapsed) onExpand();
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col border-t border-border bg-white font-mono text-xs text-foreground">
      <Tooltip content="拖动调整调试预览高度">
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="拖动调整调试预览高度"
          onMouseDown={onResizeStart}
          className="h-1 shrink-0 cursor-row-resize bg-zinc-100 transition hover:bg-primary/20"
        />
      </Tooltip>
      <div className="flex min-h-9 shrink-0 items-center justify-between gap-3 border-b border-border bg-zinc-50 px-3 py-1">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex gap-1 border-b border-transparent">
            <button
              type="button"
              onClick={() => handleTabClick('result')}
              disabled={!showResultTab}
              className={`-mb-[5px] border-b-2 px-3 py-1 text-xs font-semibold transition-colors ${
                activeTab === 'result' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground disabled:text-slate-300'
              }`}
            >
              调试预览
            </button>
            <button
              type="button"
              onClick={() => handleTabClick('output')}
              className={`-mb-[5px] border-b-2 px-3 py-1 text-xs font-semibold transition-colors ${
                activeTab === 'output' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              输出
            </button>
          </div>
          <div className="mx-1 h-4 w-px bg-slate-200" />
          {activeTab === 'result' && !isCollapsed ? (
            <div className="flex items-center gap-1.5">
              {data?.previewType === 'SINK_TABLE' ? (
                <span className="inline-flex items-center rounded-md border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
                  INSERT 预览
                </span>
              ) : null}
              {data?.truncated ? (
                <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                  已截断
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'result' && !isCollapsed ? (
            <button
              type="button"
              onClick={onClear}
              className="shrink-0 rounded border border-border bg-white px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-zinc-50 hover:text-foreground"
            >
              清空
            </button>
          ) : null}
          {activeTab === 'output' && outputLoading && !isCollapsed ? (
            <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-200 border-t-primary" />
              同步中
            </span>
          ) : null}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2" style={{ display: isCollapsed ? 'none' : 'block' }}>
        {activeTab === 'result' && loading ? (
          <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-200 border-t-primary" />
            正在抓取数据...
          </div>
        ) : activeTab === 'result' ? (
          !data ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">暂无预览数据</div>
          ) : data.data.length === 0 ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">查询成功，但结果为空</div>
          ) : (
            <div className="h-full overflow-auto rounded-md border border-border/80 bg-white">
              <table className="min-w-full border-separate border-spacing-0 text-left text-[11px]">
                <thead>
                  <tr className="text-muted-foreground">
                    {data.columns.map((col, index) => (
                      <th
                        key={col.name ?? `column-${index}`}
                        className="sticky top-0 z-10 border-b border-border bg-zinc-50 px-3 py-2 font-semibold shadow-[inset_0_-1px_0_0_rgba(226,232,240,1)]"
                      >
                        {col.name ?? '-'}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((row, idx) => (
                    <tr key={idx} className="even:bg-zinc-50/20 transition-colors hover:bg-primary/5">
                      {data.columns.map((col, columnIndex) => {
                        const cellKey = col.name ?? `column-${columnIndex}`;
                        const cellValue = col.name ? row[col.name] : undefined;
                        return (
                          <td key={cellKey} className="max-w-xs truncate border-b border-border/70 px-3 py-1.5 transition-colors">
                            {cellValue !== null && cellValue !== undefined ? (
                              cellValue === '' ? <span className="select-none text-[10px] italic text-zinc-300">empty</span> : String(cellValue)
                            ) : (
                              <span className="select-none text-[10px] italic text-zinc-300">null</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div ref={outputRef} className="h-full w-full overflow-auto rounded bg-zinc-950 p-3 font-mono text-[11px] leading-relaxed text-zinc-300 selection:bg-primary/30">
            {outputLoading && !outputText ? (
              <div className="flex h-full items-center justify-center gap-2 text-zinc-500">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-700 border-t-primary" />
                正在同步运行日志...
              </div>
            ) : outputText ? (
              <pre className="whitespace-pre-wrap break-all">{outputText}</pre>
            ) : (
              <div className="flex h-full items-center justify-center italic text-zinc-500">暂无输出日志</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
