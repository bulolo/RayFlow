'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { AlertCircle, Clock, GitBranch, Link2, Play, Plus, Search, Sliders, Terminal, Trash2, Waypoints, X } from 'lucide-react';
import { Button, Badge } from '@/components/ui';
import { TableEmpty, TablePagination, TableShell, TableToolbar } from '@/components/data-display/table-shell';
import type { AtomicSchedulerJob } from '@/features/scheduler/api-adapters';
import type { Workflow, WorkflowEdge, WorkflowNode } from '@/features/scheduler/types';

const workflowSkeletonRows = Array.from({ length: 7 });

function schedulerStatusLabel(status?: string) {
  const labels: Record<string, string> = {
    FAILED: '失败',
    FINISHED: '已完成',
    IDLE: '空闲',
    PENDING: '等待中',
    RUNNING: '运行中',
    SKIPPED: '已跳过',
    SUCCESS: '成功',
    CANCELED: '已取消',
  };
  return status ? labels[status] ?? status : '-';
}

function executionStatusTone(status?: string): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
  if (status === 'SUCCESS') return 'success';
  if (status === 'RUNNING' || status === 'RETRYING' || status === 'PENDING') return 'warning';
  if (status === 'FAILED') return 'danger';
  if (status === 'CANCELED') return 'neutral';
  return 'neutral';
}

export function WorkflowListView({
  channelsList,
  onCreate,
  onDelete,
  onDesignerOpen,
  onLogsOpen,
  loading,
  onPageChange,
  onCancelRun,
  onRun,
  runningWorkflowId,
  onScheduleOpen,
  onSearchChange,
  onToggleStatus,
  page,
  pageCount,
  pageSize,
  rows,
  searchValue,
  setPageSize,
  total,
}: {
  channelsList: Array<{ id?: number; name?: string }>;
  onCreate: () => void;
  onDelete: (workflow: Workflow) => void;
  onDesignerOpen: (workflow: Workflow) => void;
  onLogsOpen: (workflow: Workflow) => void;
  loading: boolean;
  onPageChange: (page: number) => void;
  onCancelRun: (workflow: Workflow) => void;
  onRun: (workflow: Workflow) => void;
  runningWorkflowId: number | null;
  onScheduleOpen: (workflow: Workflow) => void;
  onSearchChange: (value: string) => void;
  onToggleStatus: (workflow: Workflow) => void;
  page: number;
  pageCount: number;
  pageSize: number;
  rows: Workflow[];
  searchValue: string;
  setPageSize: (size: number) => void;
  total: number;
}) {
  return (
    <div className="space-y-6">
      <TableToolbar
        action={(
          <Button onClick={onCreate} variant="primary" className="h-9 px-4 text-xs font-bold shadow-sm">
            <Plus className="h-3.5 w-3.5" />
            新建工作流
          </Button>
        )}
        onSearchChange={onSearchChange}
        searchPlaceholder="搜索工作流名称、描述、周期或状态"
        searchValue={searchValue}
      />

      <TableShell>
        <table className="w-full border-collapse text-left text-sm">
          <thead className="border-b border-border-subtle bg-slate-50/70 text-xs font-semibold text-slate-500">
            <tr>
              <th className="px-5 py-3 font-semibold">工作流</th>
              <th className="px-5 py-3 font-semibold">启用状态</th>
              <th className="px-5 py-3 font-semibold">最近运行</th>
              <th className="px-5 py-3 font-semibold">节点</th>
              <th className="px-5 py-3 font-semibold">失败策略</th>
              <th className="px-5 py-3 font-semibold">告警渠道</th>
              <th className="px-5 py-3 font-semibold">最近运行时间</th>
              <th className="px-5 py-3 text-right font-semibold">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle bg-white">
            {loading && rows.length === 0 ? (
              workflowSkeletonRows.map((_, rowIndex) => (
                <tr key={rowIndex}>
                  <td className="px-5 py-3">
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 h-4 w-4 shrink-0 animate-pulse rounded bg-slate-100" />
                      <div className="min-w-0 flex-1">
                        <div className="h-4 animate-pulse rounded bg-slate-200" style={{ width: `${rowIndex % 2 === 0 ? 58 : 42}%` }} />
                        <div className="mt-2 h-3 w-44 max-w-full animate-pulse rounded bg-slate-100" />
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3"><div className="h-6 w-16 animate-pulse rounded-full bg-slate-100" /></td>
                  <td className="px-5 py-3"><div className="h-6 w-16 animate-pulse rounded-full bg-slate-100" /></td>
                  <td className="px-5 py-3"><div className="h-3 w-8 animate-pulse rounded bg-slate-100" /></td>
                  <td className="px-5 py-3"><div className="h-3 w-10 animate-pulse rounded bg-slate-100" /></td>
                  <td className="px-5 py-3"><div className="h-3 w-20 animate-pulse rounded bg-slate-100" /></td>
                  <td className="px-5 py-3"><div className="h-3 w-24 animate-pulse rounded bg-slate-100" /></td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1.5">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <div key={index} className="h-7 w-7 animate-pulse rounded-md bg-slate-100" />
                      ))}
                    </div>
                  </td>
                </tr>
              ))
            ) : rows.length ? (
              rows.map((workflow) => {
                const executionStatus = runningWorkflowId === workflow.id ? 'RUNNING' : workflow.latestExecutionStatus;
                return (
                <tr key={workflow.id} className="transition-colors hover:bg-slate-50/50">
                  <td className="max-w-[300px] px-5 py-3">
                    <div className="flex min-w-0 items-start gap-2">
                      <GitBranch className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => onDesignerOpen(workflow)}
                          className="block max-w-full truncate text-left font-bold text-slate-900 transition-colors hover:text-primary hover:underline"
                          title="进入任务编排"
                        >
                          {workflow.name}
                        </button>
                        <div className="mt-0.5 line-clamp-1 text-xs font-medium text-slate-400" title={workflow.description}>{workflow.description}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => onToggleStatus(workflow)}
                      className="transition hover:opacity-80 focus:outline-none flex"
                      title="点击切换启用/暂停"
                    >
                      <Badge tone={workflow.status === 'ACTIVE' ? 'success' : 'neutral'} className="font-semibold">
                        {workflow.status === 'ACTIVE' ? '已启用' : '已暂停'}
                      </Badge>
                    </button>
                  </td>
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      onClick={() => onLogsOpen(workflow)}
                      className="transition hover:opacity-80 focus:outline-none flex"
                      title="查看执行记录和日志"
                    >
                      <Badge tone={executionStatusTone(executionStatus)} className="font-semibold">
                        {executionStatus === 'UNKNOWN' ? '未运行' : schedulerStatusLabel(executionStatus)}
                      </Badge>
                    </button>
                  </td>
                  <td className="px-5 py-3 text-xs font-semibold text-slate-500">{workflow.nodeCount} 个</td>
                  <td className="px-5 py-3 text-xs font-semibold text-slate-500">{workflow.failureStrategy === 'BLOCK_ALL' ? '阻断' : '继续'}</td>
                  <td className="max-w-[180px] truncate px-5 py-3 text-xs font-semibold text-slate-500">
                    {workflow.alertChannelId ? channelsList.find((channel) => channel.id === workflow.alertChannelId)?.name ?? `通道 ${workflow.alertChannelId}` : '未绑定'}
                  </td>
                  <td className="px-5 py-3 text-xs font-semibold text-slate-500">{workflow.lastRunTime}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1.5">
                      <Button onClick={() => onScheduleOpen(workflow)} variant="ghost" className="h-7 w-7 p-0" title="控制设置" aria-label="控制设置">
                        <Clock className="h-3.5 w-3.5" />
                      </Button>
                      <Button onClick={() => onDesignerOpen(workflow)} variant="ghost" className="h-7 w-7 p-0" title="任务编排" aria-label="任务编排">
                        <Waypoints className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        onClick={() => runningWorkflowId === workflow.id ? onCancelRun(workflow) : onRun(workflow)}
                        variant="ghost"
                        className={`h-7 w-7 p-0 ${runningWorkflowId === workflow.id ? 'text-rose-600 hover:text-rose-700' : ''}`}
                        disabled={workflow.nodeCount === 0}
                        title={runningWorkflowId === workflow.id ? '取消运行' : workflow.nodeCount === 0 ? '当前工作流没有节点，无法运行' : '运行工作流'}
                        aria-label={runningWorkflowId === workflow.id ? '取消运行' : '运行工作流'}
                      >
                        {runningWorkflowId === workflow.id ? <X className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                      </Button>
                      <Button onClick={() => onLogsOpen(workflow)} variant="ghost" className="h-7 px-2 text-xs" title="运行日志" aria-label="运行日志">
                        <Terminal className="h-3.5 w-3.5" />
                        日志
                      </Button>
                      <Button onClick={() => onDelete(workflow)} variant="ghost" className="h-7 w-7 p-0 text-rose-600 hover:text-rose-700" title="删除" aria-label="删除">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
                );
              })
            ) : (
              <TableEmpty colSpan={8} message="暂无工作流" />
            )}
          </tbody>
        </table>
        <TablePagination
          disabled={loading}
          end={Math.min(page * pageSize, total)}
          onPageChange={onPageChange}
          onPageSizeChange={setPageSize}
          page={page}
          pageCount={pageCount}
          pageSize={pageSize}
          start={(page - 1) * pageSize + 1}
          total={total}
        />
      </TableShell>
    </div>
  );
}

export function WorkflowDesignerView({
  canvasRef,
  atomicJobs,
  connectingFromId,
  runConsoleOpen,
  runLogs,
  designerEdges,
  designerNodes,
  isRunning,
  onAnchorClick,
  onCanvasClick,
  onCanvasDrop,
  onClearLogs,
  onCloseConsole,
  onDeleteEdge,
  onDeleteNode,
  onDragStartFromPool,
  onNodeConfigOpen,
  onNodeMouseDown,
  onToggleEdgeStrategy,
}: {
  atomicJobs: AtomicSchedulerJob[];
  canvasRef: React.RefObject<HTMLDivElement | null>;
  connectingFromId: string | null;
  runConsoleOpen: boolean;
  runLogs: string[];
  designerEdges: WorkflowEdge[];
  designerNodes: WorkflowNode[];
  isRunning: boolean;
  onAnchorClick: (event: React.MouseEvent, nodeId: string) => void;
  onCanvasClick: () => void;
  onCanvasDrop: (event: React.DragEvent) => void;
  onClearLogs: () => void;
  onCloseConsole: () => void;
  onDeleteEdge: (edge: WorkflowEdge) => void;
  onDeleteNode: (nodeId: string) => void;
  onDragStartFromPool: (event: React.DragEvent, job: AtomicSchedulerJob) => void;
  onNodeConfigOpen: (node: WorkflowNode) => void;
  onNodeMouseDown: (event: React.MouseEvent, nodeId: string) => void;
  onToggleEdgeStrategy: (event: React.MouseEvent, edge: WorkflowEdge) => void;
}) {
  const logViewportRef = useRef<HTMLDivElement>(null);
  const [jobKeyword, setJobKeyword] = useState('');
  const filteredAtomicJobs = useMemo(() => {
    const keyword = jobKeyword.trim().toLowerCase();
    if (!keyword) return atomicJobs;
    return atomicJobs.filter((job) =>
      [job.name, job.desc, job.type].some((value) => value.toLowerCase().includes(keyword)),
    );
  }, [atomicJobs, jobKeyword]);

  useEffect(() => {
    if (!runConsoleOpen) return;
    const viewport = logViewportRef.current;
    if (!viewport) return;
    viewport.scrollTop = viewport.scrollHeight;
  }, [runConsoleOpen, runLogs]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col rounded-xl border border-border-subtle bg-white p-4 shadow-card">
          <div className="mb-2 border-b border-border-subtle pb-3">
            <span className="block pt-0.5 text-sm font-bold tracking-tight text-foreground">可编排作业</span>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">拖入画布添加为工作流节点。</p>
          </div>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={jobKeyword}
              onChange={(event) => setJobKeyword(event.target.value)}
              placeholder="搜索作业"
              className="h-9 w-full rounded-lg border border-border bg-white pl-9 pr-3 text-xs font-medium placeholder-slate-400 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
          <div className="mt-3 flex-1 space-y-2.5 overflow-y-auto pr-1 select-none">
            {filteredAtomicJobs.length ? filteredAtomicJobs.map((job) => (
              <div
                key={job.id}
                draggable={!isRunning}
                onDragStart={(event) => onDragStartFromPool(event, job)}
                className={`group flex min-w-0 w-full flex-col gap-1 rounded-lg border border-border bg-zinc-50/50 p-3 transition-all ${isRunning ? 'cursor-not-allowed opacity-50' : 'cursor-grab shadow-sm hover:-translate-y-0.5 hover:border-primary/20 hover:bg-white hover:shadow-md active:cursor-grabbing'}`}
              >
                <div className="flex min-w-0 w-full items-center gap-2">
                  <span className={`w-10 shrink-0 rounded px-1.5 py-0.5 text-center text-xs font-bold leading-none ${job.type === 'SQL' ? 'border border-blue-100 bg-blue-50 text-blue-600' : 'border border-amber-100 bg-amber-50 text-amber-600'}`}>{job.type}</span>
                  <span className="flex-1 truncate text-xs font-semibold text-foreground transition-colors group-hover:text-primary" title={job.name}>{job.name}</span>
                </div>
                <span className="block w-full truncate pl-12 text-xs text-muted-foreground" title={job.desc}>{job.desc}</span>
              </div>
            )) : (
              <div className="rounded-lg border border-dashed border-border bg-slate-50/70 p-4 text-center text-xs font-medium text-muted-foreground">
                {atomicJobs.length ? '未找到匹配的作业。' : '暂无可编排的 Flink 作业，请先在开发运维中创建作业。'}
              </div>
            )}
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-col rounded-xl border border-border-subtle bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-border-subtle bg-zinc-50/50 px-4 py-3 backdrop-blur-sm">
            <span className="text-xs font-bold text-foreground">DAG 可视化拓扑连线画布</span>
            <span className="text-xs font-medium text-muted-foreground">双击节点可配置「单任务重试/超时策略」</span>
          </div>
          <div ref={canvasRef} onDragOver={(event) => event.preventDefault()} onDrop={isRunning ? undefined : onCanvasDrop} className="data-stream-bg relative flex-1 overflow-hidden bg-slate-50/20 select-none" onClick={onCanvasClick}>
            <svg className="absolute inset-0 z-0 h-full w-full pointer-events-none">
              {designerEdges.map((edge, index) => {
                const fromNode = designerNodes.find((node) => node.id === edge.from);
                const toNode = designerNodes.find((node) => node.id === edge.to);
                if (!fromNode || !toNode) return null;
                const startX = fromNode.x + 208;
                const startY = fromNode.y + 55;
                const endX = toNode.x;
                const endY = toNode.y + 55;
                const dx = Math.abs(endX - startX) * 0.5;
                const pathData = `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`;
                const strokeColor = edge.strategy === 'WAIT_SUCCESS' ? (fromNode.status === 'SUCCESS' ? '#10b981' : fromNode.status === 'FAILED' ? '#ef4444' : '#cbd5e1') : edge.strategy === 'WAIT_FAILED' ? (fromNode.status === 'FAILED' ? '#ef4444' : '#cbd5e1') : '#3b82f6';
                const dashArray = fromNode.status === 'IDLE' || fromNode.status === 'PENDING' ? '4 4' : '0';

                return (
                  <g key={`${edge.from}-${edge.to}-${index}`}>
                    <path d={pathData} fill="none" stroke={strokeColor} strokeWidth="2" strokeDasharray={dashArray} className="transition-all" />
                    <circle cx={endX} cy={endY} r="3.5" fill={strokeColor} />
                    <foreignObject x={(startX + endX) / 2 - 62} y={(startY + endY) / 2 - 14} width="124" height="28" className="overflow-visible">
                      <div className="pointer-events-auto flex items-center gap-1.5 rounded-lg border border-border bg-white px-2 py-1 shadow-sm transition-colors select-none">
                        <button onClick={(event) => !isRunning && onToggleEdgeStrategy(event, edge)} disabled={isRunning} className={`text-xs font-bold disabled:opacity-75 ${edge.strategy === 'WAIT_SUCCESS' ? 'text-emerald-600' : edge.strategy === 'WAIT_FAILED' ? 'text-rose-600' : 'text-blue-600'}`} title="点击切换依赖执行策略">
                          {edge.strategy === 'WAIT_SUCCESS' ? '成功触发' : edge.strategy === 'WAIT_FAILED' ? '失败触发' : '忽略失败'}
                        </button>
                        <div className="h-3 w-px bg-border" />
                        <button onClick={(event) => { event.stopPropagation(); onDeleteEdge(edge); }} disabled={isRunning} className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30" title="断开此依赖线">
                          <Trash2 className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    </foreignObject>
                  </g>
                );
              })}
            </svg>

            {designerNodes.map((node) => (
              <div
                key={node.id}
                style={{ left: `${node.x}px`, top: `${node.y}px` }}
                onDoubleClick={() => !isRunning && onNodeConfigOpen(node)}
                className={`group absolute z-10 flex w-52 cursor-pointer flex-col gap-1.5 rounded-xl border bg-white p-4 shadow-sm transition-all select-none ${node.status === 'SUCCESS' ? 'border-emerald-300 ring-2 ring-emerald-500/10' : node.status === 'RUNNING' ? 'animate-pulse border-amber-300 ring-2 ring-amber-500/10 shadow-[0_4px_12px_rgba(245,158,11,0.15)]' : node.status === 'FAILED' ? 'border-rose-300 ring-2 ring-rose-500/10' : node.status === 'PENDING' ? 'border-border bg-zinc-50 opacity-60' : 'hover:border-primary/25 hover:shadow-md'}`}
                title="双击配置节点级调度属性"
              >
                <div onMouseDown={(event) => !isRunning && onNodeMouseDown(event, node.id)} className={`flex w-full items-center justify-between border-b border-border-subtle pb-1.5 ${isRunning ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}`}>
                  <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${node.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-700' : node.status === 'RUNNING' ? 'bg-amber-100 text-amber-700' : node.status === 'FAILED' ? 'bg-rose-100 text-rose-700' : 'bg-zinc-100 text-muted-foreground'}`}>节点 {node.id}</span>
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold ${node.status === 'SUCCESS' ? 'text-emerald-600' : node.status === 'RUNNING' ? 'text-amber-600' : node.status === 'FAILED' ? 'text-rose-600' : 'text-muted-foreground/60'}`}>
                    {node.status === 'RUNNING' && <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />}
                    {node.status === 'SUCCESS' && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                    {node.status === 'FAILED' && <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />}
                    {schedulerStatusLabel(node.status)}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="truncate text-sm font-bold text-foreground" title={node.jobName}>{node.jobName}</span>
                  <div className="mt-0.5 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${node.type === 'SQL' ? 'border border-blue-100 bg-blue-50 text-blue-600' : 'border border-amber-100 bg-amber-50 text-amber-600'}`}>{node.type}</span>
                      <span className="text-xs font-medium text-muted-foreground">耗时: {node.duration}</span>
                    </div>
                    <div title="双击卡片快速编辑重试与超时" className="shrink-0">
                      <Sliders className="h-3.5 w-3.5 text-muted-foreground/60 transition-colors hover:text-primary" />
                    </div>
                  </div>
                </div>
                {!isRunning ? (
                  <>
                    <div onClick={(event) => onAnchorClick(event, node.id)} className={`absolute -left-1.5 top-[50px] flex h-3.5 w-3.5 items-center justify-center rounded-full border bg-white shadow-sm transition-colors ${connectingFromId !== null && connectingFromId !== node.id ? 'border-primary bg-primary/10 text-primary hover:bg-primary hover:text-white' : 'border-border text-muted-foreground/60 hover:border-primary'}`} title="作为子依赖节点 (输入端)">
                      <div className="h-1.5 w-1.5 rounded-full bg-current" />
                    </div>
                    <div onClick={(event) => onAnchorClick(event, node.id)} className={`absolute -right-1.5 top-[50px] flex h-3.5 w-3.5 items-center justify-center rounded-full border bg-white shadow-sm transition-colors ${connectingFromId === node.id ? 'border-primary bg-primary text-white' : 'border-border text-muted-foreground/60 hover:border-primary'}`} title="拉出连接线 (输出端)">
                      <Link2 className="h-2 w-2" />
                    </div>
                  </>
                ) : null}
                {!isRunning ? (
                  <button onClick={(event) => { event.stopPropagation(); onDeleteNode(node.id); }} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-white text-muted-foreground shadow-sm transition-opacity hover:border-rose-200 hover:text-rose-600" title="从工作流中删除此任务">
                    <Trash2 className="h-3 w-3" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-border-subtle bg-zinc-50/50 px-6 py-2 text-xs font-semibold text-muted-foreground select-none">
            <span className="flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-primary" />
              运行说明：点击右上角「运行工作流」会保存当前 DAG 并提交后端调度执行器，双击任意节点可更改其重试和超时值。
            </span>
          </div>
        </div>
      </div>

      {runConsoleOpen ? (
        <div className="fixed bottom-5 right-5 z-50 flex h-[min(20rem,calc(100vh-7rem))] w-[min(46rem,calc(100vw-2.5rem))] flex-col rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-zinc-300 shadow-2xl animate-in slide-in-from-bottom-6 duration-300">
          <div className="mb-2 flex shrink-0 items-center justify-between border-b border-slate-800 pb-2 select-none">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 shrink-0 text-amber-500" />
              <span className="font-bold text-zinc-400">Flink 作业流运行日志</span>
              {isRunning ? (
                <span className="inline-flex items-center gap-1 rounded border border-amber-800 bg-amber-950/80 px-1.5 py-0.2 text-xs font-bold text-amber-400 animate-pulse">运行中</span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded border border-emerald-800 bg-emerald-950/80 px-1.5 py-0.2 text-xs font-bold text-emerald-400">已完成</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={onClearLogs} className="text-zinc-550 transition-colors hover:text-zinc-300">清空日志</button>
              <button onClick={onCloseConsole} className="text-zinc-550 transition-colors hover:text-rose-500" title="关闭控制台">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div ref={logViewportRef} className="flex-1 space-y-1 overflow-y-auto pr-1 font-mono leading-relaxed select-text">
            {runLogs.length === 0 ? (
              <div className="italic text-zinc-600 select-none">等待工作流运行开始...</div>
            ) : (
              runLogs.map((log, index) => {
                let colorClass = 'text-zinc-300';
                if (log.includes('[SUCCESS]')) colorClass = 'text-emerald-400 font-semibold';
                else if (log.includes('[RUNNING]') || log.includes('[RETRYING]') || log.includes('[PENDING]')) colorClass = 'text-amber-400 font-semibold';
                else if (log.includes('[FAILED]')) colorClass = 'text-rose-400 font-bold';
                else if (log.includes('[CANCELED]')) colorClass = 'text-zinc-500 font-bold';
                else if (log.includes('[SKIPPED]')) colorClass = 'text-zinc-500 font-semibold';
                else if (log.includes('[SYSTEM]')) colorClass = 'text-blue-400 font-bold';
                else if (log.includes('[INFO]')) colorClass = 'text-zinc-450';
                else if (log.includes('[WARN]') || log.includes('[WARNING]')) colorClass = 'text-amber-400';
                else if (log.includes('[ERROR]')) colorClass = 'text-rose-400 font-bold';

                return <div key={index} className={colorClass}>{log}</div>;
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
