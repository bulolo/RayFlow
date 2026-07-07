'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Calendar, Clock, History, RefreshCw, Save, Terminal, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui';
import {
  getListSchedulerWorkflowsQueryKey,
  getSchedulerWorkflowDefinition,
  listSchedulerExecutionLogs,
  listSchedulerNodeExecutions,
  listSchedulerExecutions,
  useListFlinkJobs,
  useListNotificationChannels,
  useCancelSchedulerExecution,
  useRunSchedulerWorkflow,
  useUpdateSchedulerWorkflowDefinition,
} from '@/shared/api/generated';
import { toAtomicJob, toDefinitionRequest, toEdge, toNode, toWorkflowFromDefinition } from '@/features/scheduler/api-adapters';
import {
  CreateWorkflowModal,
  DeleteWorkflowModal,
  HistoryVersionsModal,
  NodeConfigModal,
  SaveVersionModal,
  ScheduleConfigModal,
  SchedulerExecutionLogsModal,
  WorkflowDesignerView,
  WorkflowListView,
} from '@/features/scheduler/components';
import {
  useSchedulerDesignerState,
  useSchedulerVersionState,
  useSchedulerWorkflowState,
} from '@/features/scheduler/hooks';
import type { Workflow, WorkflowNode } from '@/features/scheduler/types';
import { formatBackendUtcDateTime, formatBackendUtcDuration } from '@/lib/date';
import { getErrorMessage } from '@/lib/error-message';
import type {
  SchedulerExecutionLogResponse,
  SchedulerExecutionResponse,
  SchedulerNodeExecutionResponse,
} from '@/shared/api/generated';

function formatTime() {
  return new Date().toTimeString().split(' ')[0];
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isTerminalExecutionStatus(status?: string) {
  return status === 'SUCCESS' || status === 'FAILED' || status === 'CANCELED';
}

const MODE_PARAM = 'mode';
const WORKFLOW_ID_PARAM = 'workflowId';

function formatExecutionLogs(workflow: Workflow, logs: SchedulerExecutionLogResponse[]) {
  if (logs.length === 0) {
    return [
      `[${new Date().toTimeString().split(' ')[0]}] [SYSTEM] 工作流「${workflow.name}」暂无后端运行记录。`,
      `[${new Date().toTimeString().split(' ')[0]}] [SCHEDULER] Cron：${workflow.cron || '-'} | 启用状态：${workflow.status}`,
    ];
  }

  return logs.map((log) => {
    const node = log.nodeKey ? ` [${log.nodeKey}]` : '';
    const event = log.eventType ? ` ${log.eventType}` : '';
    return `[${formatBackendUtcDateTime(log.createdAt)}] [${log.level ?? 'INFO'}]${node}${event} | ${log.message ?? '-'}`;
  });
}

export function SchedulerWorkspace() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const channelsQuery = useListNotificationChannels();
  const channelsList = channelsQuery.data?.list ?? [];
  const flinkJobsQuery = useListFlinkJobs({ is_pager: 0, page: 1, size: 100 });
  const atomicJobs = (flinkJobsQuery.data?.list ?? []).map(toAtomicJob).filter((job): job is NonNullable<typeof job> => Boolean(job));
  const updateDefinitionMutation = useUpdateSchedulerWorkflowDefinition();
  const runWorkflowMutation = useRunSchedulerWorkflow();
  const cancelExecutionMutation = useCancelSchedulerExecution();

  const [viewMode, setViewMode] = useState<'workflows' | 'designer'>('workflows');
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [runningWorkflowId, setRunningWorkflowId] = useState<number | null>(null);
  const [runningExecutionId, setRunningExecutionId] = useState<number | null>(null);
  const [executionLogsOpen, setExecutionLogsOpen] = useState(false);
  const [executionLogsWorkflow, setExecutionLogsWorkflow] = useState<Workflow | null>(null);
  const [executionRows, setExecutionRows] = useState<SchedulerExecutionResponse[]>([]);
  const [selectedExecutionId, setSelectedExecutionId] = useState<number | null>(null);
  const [executionLogRows, setExecutionLogRows] = useState<SchedulerExecutionLogResponse[]>([]);
  const [executionNodeRows, setExecutionNodeRows] = useState<SchedulerNodeExecutionResponse[]>([]);
  const [executionLogsLoading, setExecutionLogsLoading] = useState(false);
  const [executionDetailsLoading, setExecutionDetailsLoading] = useState(false);
  const [executionDetailsError, setExecutionDetailsError] = useState<string | undefined>();
  const pollTokenRef = useRef(0);
  const selectedExecutionIdRef = useRef<number | null>(null);
  const executionLogsOpenRef = useRef(false);
  const loadingDesignerWorkflowIdRef = useRef<number | null>(null);
  const loadedDesignerWorkflowIdRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      pollTokenRef.current += 1;
    };
  }, []);

  const showToast = useCallback((message: string) => toast(message), []);

  function setSelectedLogExecutionId(executionId: number | null) {
    selectedExecutionIdRef.current = executionId;
    setSelectedExecutionId(executionId);
  }

  function setExecutionLogsModalOpen(open: boolean) {
    executionLogsOpenRef.current = open;
    setExecutionLogsOpen(open);
  }

  const canvasRef = useRef<HTMLDivElement>(null);
  const {
    connectingFromId,
    runConsoleOpen,
    runLogs,
    designerEdges,
    designerNodes,
    handleAnchorClick,
    handleCanvasDrop,
    handleDragStartFromPool,
    handleNodeMouseDown,
    handleRollbackSnapshot,
    handleSaveNodeConfig,
    handleStartRun,
    isRunning,
    nodeConfigModalOpen,
    nodeToConfig,
    setConnectingFromId,
    setRunConsoleOpen,
    setRunLogs,
    setDesignerEdges,
    setDesignerNodes,
    setIsRunning,
    setNodeConfigModalOpen,
    setNodeToConfig,
    toggleEdgeStrategy,
  } = useSchedulerDesignerState({
    canvasRef,
    channelsList,
    selectedWorkflow,
    showToast,
  });
  const {
    createModalOpen,
    deleteConfirmOpen,
    handleConfirmCreateWorkflow,
    handleConfirmDeleteWorkflow,
    handleOpenCreateModal,
    handleOpenScheduleConfig,
    handleRequestDelete,
    handleSaveScheduleConfig,
    handleToggleWorkflowStatus,
    handleWorkflowPageSizeChange,
    handleWorkflowSearchChange,
    newWorkflowDesc,
    newWorkflowName,
    scheduleModalOpen,
    setCreateModalOpen,
    setDeleteConfirmOpen,
    setNewWorkflowDesc,
    setNewWorkflowName,
    setScheduleModalOpen,
    setWorkflowPage,
    setWorkflowToConfig,
    setWorkflowToDelete,
    workflowKeyword,
    workflowPage,
    workflowPageCount,
    workflowPageSize,
    workflowRows,
    workflowToConfig,
    workflowToDelete,
    workflowTotal,
    workflowsLoading,
  } = useSchedulerWorkflowState({
    selectedWorkflow,
    setSelectedWorkflow,
    showToast,
  });
  const {
    handleConfirmSaveVersion,
    handleSaveClick,
    historyModalOpen,
    saveRemarkModalOpen,
    setHistoryModalOpen,
    setSaveRemarkModalOpen,
    setVersionRemark,
    versionRemark,
    workflowVersions,
  } = useSchedulerVersionState({
    designerEdges,
    designerNodes,
    selectedWorkflow,
    setSelectedWorkflow,
    showToast,
  });

  const replaceSchedulerUrl = useCallback((nextViewMode: 'workflows' | 'designer', workflowId?: number) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (nextViewMode === 'designer' && workflowId) {
      nextParams.set(MODE_PARAM, 'designer');
      nextParams.set(WORKFLOW_ID_PARAM, String(workflowId));
    } else {
      nextParams.delete(MODE_PARAM);
      nextParams.delete(WORKFLOW_ID_PARAM);
    }
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const openWorkflowDesignerById = useCallback(async (workflowId: number, initialWorkflow?: Workflow, syncUrl = true) => {
    if (workflowId <= 0) return;

    loadingDesignerWorkflowIdRef.current = workflowId;
    if (syncUrl) replaceSchedulerUrl('designer', workflowId);
    if (initialWorkflow) setSelectedWorkflow(initialWorkflow);
    setViewMode('designer');
    setDesignerNodes([]);
    setDesignerEdges([]);

    try {
      const definition = await getSchedulerWorkflowDefinition(workflowId);
      if (loadingDesignerWorkflowIdRef.current !== workflowId) return;
      setDesignerNodes((definition.nodes ?? []).map(toNode));
      setDesignerEdges((definition.edges ?? []).map(toEdge));
      const nextWorkflow = toWorkflowFromDefinition(definition);
      if (nextWorkflow) setSelectedWorkflow(nextWorkflow);
      loadedDesignerWorkflowIdRef.current = workflowId;
    } catch {
      if (loadingDesignerWorkflowIdRef.current !== workflowId) return;
      showToast('加载工作流编排失败');
      replaceSchedulerUrl('workflows');
      setSelectedWorkflow(null);
      setViewMode('workflows');
      setDesignerNodes([]);
      setDesignerEdges([]);
    } finally {
      if (loadingDesignerWorkflowIdRef.current === workflowId) {
        loadingDesignerWorkflowIdRef.current = null;
      }
    }
  }, [replaceSchedulerUrl, setDesignerEdges, setDesignerNodes, showToast]);

  const modeFromUrl = searchParams.get(MODE_PARAM);
  const workflowIdFromUrl = Number(searchParams.get(WORKFLOW_ID_PARAM));

  useEffect(() => {
    const hasDesignerUrl = modeFromUrl === 'designer' && Number.isInteger(workflowIdFromUrl) && workflowIdFromUrl > 0;
    if (!hasDesignerUrl) {
      loadingDesignerWorkflowIdRef.current = null;
      if (viewMode === 'designer') {
        loadedDesignerWorkflowIdRef.current = null;
        setSelectedWorkflow(null);
        setDesignerNodes([]);
        setDesignerEdges([]);
        setViewMode('workflows');
      }
      return;
    }

    if (
      viewMode === 'designer'
      && selectedWorkflow?.id === workflowIdFromUrl
      && loadedDesignerWorkflowIdRef.current === workflowIdFromUrl
    ) {
      return;
    }

    if (loadingDesignerWorkflowIdRef.current === workflowIdFromUrl) {
      return;
    }

    void openWorkflowDesignerById(workflowIdFromUrl, undefined, false);
  }, [modeFromUrl, openWorkflowDesignerById, selectedWorkflow?.id, setDesignerEdges, setDesignerNodes, viewMode, workflowIdFromUrl]);

  async function saveCurrentDefinition(workflow = selectedWorkflow): Promise<Workflow | null> {
    if (!workflow) return null;
    if (workflowRows.length > 0 && !workflowRows.some((row) => row.id === workflow.id)) {
      setSelectedWorkflow(null);
      setDesignerNodes([]);
      setDesignerEdges([]);
      setViewMode('workflows');
      showToast('当前工作流已不存在，请从列表重新打开');
      return null;
    }
    try {
      const definition = await updateDefinitionMutation.mutateAsync({
        id: workflow.id,
        data: toDefinitionRequest(workflow, designerNodes, designerEdges),
      });
      const nextWorkflow = toWorkflowFromDefinition(definition);
      if (nextWorkflow) setSelectedWorkflow(nextWorkflow);
      void queryClient.invalidateQueries({ queryKey: getListSchedulerWorkflowsQueryKey() });
      return nextWorkflow ?? workflow;
    } catch (error) {
      showToast(getErrorMessage(error, '保存 DAG 编排失败，请检查节点和依赖'));
      return null;
    }
  }

  async function loadExecutionDetails(executionId: number) {
    setSelectedLogExecutionId(executionId);
    setExecutionDetailsLoading(true);
    setExecutionDetailsError(undefined);
    try {
      const [nodeRows, logRows] = await Promise.all([
        listSchedulerNodeExecutions(executionId),
        listSchedulerExecutionLogs(executionId),
      ]);
      if (selectedExecutionIdRef.current !== executionId) return;
      setExecutionNodeRows(nodeRows);
      setExecutionLogRows(logRows);
    } catch (error) {
      if (selectedExecutionIdRef.current !== executionId) return;
      setExecutionNodeRows([]);
      setExecutionLogRows([]);
      setExecutionDetailsError(getErrorMessage(error, '加载本次执行日志失败'));
    } finally {
      if (selectedExecutionIdRef.current === executionId) {
        setExecutionDetailsLoading(false);
      }
    }
  }

  async function openWorkflowExecutionLogs(workflow: Workflow, preferredExecutionId?: number) {
    setExecutionLogsWorkflow(workflow);
    setSelectedWorkflow(workflow);
    setExecutionLogsModalOpen(true);
    setExecutionLogsLoading(true);
    setExecutionDetailsError(undefined);
    setExecutionRows([]);
    setExecutionNodeRows([]);
    setExecutionLogRows([]);
    try {
      const executions = await listSchedulerExecutions({
        is_pager: 1,
        page: 1,
        size: 20,
        workflowId: workflow.id,
      });
      const rows = executions.list ?? [];
      setExecutionRows(rows);
      const targetExecutionId = preferredExecutionId ?? rows[0]?.id ?? null;
      if (targetExecutionId) {
        await loadExecutionDetails(targetExecutionId);
      } else {
        setSelectedLogExecutionId(null);
      }
    } catch (error) {
      setExecutionRows([]);
      setSelectedLogExecutionId(null);
      setExecutionDetailsError(getErrorMessage(error, '加载执行记录失败'));
    } finally {
      setExecutionLogsLoading(false);
    }
  }

  function closeExecutionLogs() {
    setExecutionLogsModalOpen(false);
    setExecutionLogsWorkflow(null);
    setExecutionRows([]);
    setSelectedLogExecutionId(null);
    setExecutionNodeRows([]);
    setExecutionLogRows([]);
    setExecutionDetailsError(undefined);
  }

  async function runWorkflowFromList(workflow: Workflow) {
    if (workflow.nodeCount === 0) {
      showToast('当前工作流没有节点，无法运行');
      return;
    }

    setRunningWorkflowId(workflow.id);
    try {
      const execution = await runWorkflowMutation.mutateAsync({ id: workflow.id });
      if (!execution.id) {
        showToast('后端未返回执行实例 ID，无法跟踪运行状态');
        return;
      }
      setRunningExecutionId(execution.id);
      showToast(`工作流「${workflow.name}」已提交后台运行`);
      void startWorkflowPolling(workflow, execution.id);
    } catch (error) {
      showToast(getErrorMessage(error, '工作流运行失败'));
      setRunningWorkflowId(null);
      setRunningExecutionId(null);
    }
  }

  async function cancelRunningWorkflow() {
    if (!runningExecutionId) {
      showToast('当前没有可取消的运行实例');
      return;
    }
    try {
      await cancelExecutionMutation.mutateAsync({ id: runningExecutionId });
      showToast('已提交取消运行请求');
      await queryClient.invalidateQueries({ queryKey: getListSchedulerWorkflowsQueryKey() });
    } catch (error) {
      showToast(getErrorMessage(error, '取消运行失败'));
    }
  }

  function startWorkflowPolling(workflow: Workflow, executionId: number) {
    pollTokenRef.current += 1;
    return pollWorkflowExecution(workflow, executionId, pollTokenRef.current);
  }

  async function pollWorkflowExecution(workflow: Workflow, executionId: number, pollToken: number) {
    const isCurrentPoll = () => pollTokenRef.current === pollToken;
    setRunningWorkflowId(workflow.id);
    setRunningExecutionId(executionId);
    try {
      for (let index = 0; index < 600; index += 1) {
        if (!isCurrentPoll()) return;
        const executions = await listSchedulerExecutions({
          is_pager: 1,
          page: 1,
          size: 10,
          workflowId: workflow.id,
        });
        const executionRows = executions.list ?? [];
        const currentExecution = executionRows.find((item) => item.id === executionId) ?? executionRows[0];
        const [nodeRows, logRows] = await Promise.all([
          listSchedulerNodeExecutions(executionId),
          listSchedulerExecutionLogs(executionId),
        ]);
        if (!isCurrentPoll()) return;
        setRunLogs(formatExecutionLogs(workflow, logRows));
        if (executionLogsOpenRef.current && selectedExecutionIdRef.current === executionId) {
          setExecutionNodeRows(nodeRows);
          setExecutionLogRows(logRows);
          setExecutionDetailsLoading(false);
          setExecutionDetailsError(undefined);
        }
        setDesignerNodes((prev) =>
          prev.map((node) => {
            const nodeExecution = nodeRows.find((item) => item.nodeKey === node.id);
            if (!nodeExecution) return node;
            return {
              ...node,
              status: (nodeExecution.status ?? 'PENDING') as WorkflowNode['status'],
              duration: formatBackendUtcDuration(nodeExecution.startedAt, nodeExecution.finishedAt),
            };
          }),
        );

        if (isTerminalExecutionStatus(currentExecution?.status)) {
          setIsRunning(false);
          if (currentExecution?.status === 'SUCCESS') {
            showToast('工作流运行完成');
          } else if (currentExecution?.status === 'CANCELED') {
            showToast('工作流运行已取消');
          } else {
            showToast(currentExecution?.message ?? '工作流运行失败，请查看运行日志');
          }
          return;
        }
        await delay(2000);
      }
      if (!isCurrentPoll()) return;
      setRunLogs((prev) => [...prev, `[${formatTime()}] [WARNING] 运行状态轮询超时，请稍后手动刷新运行日志。`]);
    } catch (error) {
      if (!isCurrentPoll()) return;
      setRunLogs((prev) => [...prev, `[${formatTime()}] [ERROR] ${getErrorMessage(error, '刷新运行状态失败')}`]);
    } finally {
      if (!isCurrentPoll()) return;
      setRunningWorkflowId(null);
      setRunningExecutionId(null);
      setIsRunning(false);
      await queryClient.invalidateQueries({ queryKey: getListSchedulerWorkflowsQueryKey() });
    }
  }

  return (
    <main className={`${viewMode === 'designer' ? 'flex h-[calc(100vh-4rem)] min-h-0 flex-col overflow-hidden' : 'min-h-0 overflow-y-auto'} px-6 py-5 lg:px-8 animate-in fade-in-50 duration-200`}>
      <div className={`${viewMode === 'designer' ? 'mb-3 shrink-0 pb-3' : 'mb-6 pb-4'} flex flex-col gap-4 border-b border-border`}>
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-white text-primary shadow-sm">
              <Calendar className="h-4 w-4" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">任务调度</h1>
          </div>
          <p className={`${viewMode === 'designer' ? 'hidden' : 'mt-1.5'} text-sm text-muted-foreground`}>
            以开发与运维视图中的 Flink 作业为原子节点，管理工作流编排、依赖关系、调度策略和运行观测。
          </p>
        </div>

        {viewMode === 'designer' && selectedWorkflow && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle bg-white px-3 py-2 shadow-sm">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-400">当前编排</div>
              <div className="truncate text-sm font-bold text-slate-900">{selectedWorkflow.name}</div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                onClick={() => {
                  replaceSchedulerUrl('workflows');
                  loadingDesignerWorkflowIdRef.current = null;
                  loadedDesignerWorkflowIdRef.current = null;
                  setViewMode('workflows');
                  setSelectedWorkflow(null);
                  setDesignerNodes([]);
                  setDesignerEdges([]);
                  setConnectingFromId(null);
                  setIsRunning(false);
                  setRunConsoleOpen(false);
                }}
                variant="secondary"
                size="sm"
                disabled={isRunning}
              >
                返回列表
              </Button>
              <Button
                onClick={() => setHistoryModalOpen(true)}
                variant="secondary"
                size="sm"
                className="active:scale-95 transition-all"
                disabled={isRunning}
              >
                <History className="h-3.5 w-3.5" />
                历史版本
              </Button>
              <Button
                onClick={() => {
                  setWorkflowToConfig({ ...selectedWorkflow });
                  setScheduleModalOpen(true);
                }}
                variant="secondary"
                size="sm"
                className="active:scale-95 transition-all"
                disabled={isRunning}
              >
                <Clock className="h-3.5 w-3.5" />
                控制与变量设置
              </Button>
              <Button
                onClick={() => void cancelRunningWorkflow()}
                variant="secondary"
                size="sm"
                className="border-rose-200 text-rose-600 hover:bg-rose-50 active:scale-95 transition-all"
                disabled={!runningExecutionId || cancelExecutionMutation.isPending}
              >
                <X className="h-3.5 w-3.5" />
                取消运行
              </Button>
              <Button
                onClick={async () => {
                  if (designerNodes.length === 0) {
                    showToast('当前工作流没有节点，无法运行');
                    return;
                  }
                  const saved = await saveCurrentDefinition();
                  if (!saved) return;
                  try {
                    const execution = await runWorkflowMutation.mutateAsync({ id: saved.id });
                    handleStartRun(execution);
                    if (execution.id) {
                      void startWorkflowPolling(saved, execution.id);
                    }
                  } catch (error) {
                    showToast(getErrorMessage(error, '工作流运行失败'));
                  }
                }}
                disabled={isRunning || runWorkflowMutation.isPending}
                size="sm"
                className="bg-amber-600 border-amber-700 text-white hover:bg-amber-500 active:scale-95 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRunning || runWorkflowMutation.isPending ? 'animate-spin' : ''}`} />
                {runWorkflowMutation.isPending ? '运行中' : '运行工作流'}
              </Button>
              <Button
                onClick={() => {
                  if (selectedWorkflow) void openWorkflowExecutionLogs(selectedWorkflow);
                }}
                variant="secondary"
                size="sm"
                className="active:scale-95 transition-all"
              >
                <Terminal className="h-3.5 w-3.5" />
                运行日志
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="active:scale-95 transition-all"
                onClick={async () => {
                  const saved = await saveCurrentDefinition();
                  if (saved) handleSaveClick();
                }}
                disabled={isRunning || updateDefinitionMutation.isPending}
              >
                <Save className="h-3.5 w-3.5" />
                保存 DAG 编排
              </Button>
            </div>
          </div>
        )}
      </div>

      {viewMode === 'workflows' ? (
        <WorkflowListView
          channelsList={channelsList}
          loading={workflowsLoading}
          onCreate={handleOpenCreateModal}
          onDelete={handleRequestDelete}
          onDesignerOpen={(workflow) => {
            void openWorkflowDesignerById(workflow.id, workflow);
          }}
          onLogsOpen={(workflow) => {
            void openWorkflowExecutionLogs(workflow);
          }}
          onPageChange={setWorkflowPage}
          onCancelRun={() => void cancelRunningWorkflow()}
          onRun={runWorkflowFromList}
          runningWorkflowId={runningWorkflowId}
          onScheduleOpen={handleOpenScheduleConfig}
          onSearchChange={handleWorkflowSearchChange}
          onToggleStatus={handleToggleWorkflowStatus}
          page={workflowPage}
          pageCount={workflowPageCount}
          pageSize={workflowPageSize}
          rows={workflowRows}
          searchValue={workflowKeyword}
          setPageSize={handleWorkflowPageSizeChange}
          total={workflowTotal}
        />
      ) : null}

      {viewMode === 'designer' && selectedWorkflow ? (
        <div className="min-h-0 flex-1">
        <WorkflowDesignerView
          atomicJobs={atomicJobs}
          canvasRef={canvasRef}
          connectingFromId={connectingFromId}
          runConsoleOpen={runConsoleOpen}
          runLogs={runLogs}
          designerEdges={designerEdges}
          designerNodes={designerNodes}
          isRunning={isRunning}
          onAnchorClick={handleAnchorClick}
          onCanvasClick={() => setConnectingFromId(null)}
          onCanvasDrop={handleCanvasDrop}
          onClearLogs={() => setRunLogs([])}
          onCloseConsole={() => {
            setRunConsoleOpen(false);
          }}
          onDeleteEdge={(edge) => {
            setDesignerEdges((prev) => prev.filter((item) => !(item.from === edge.from && item.to === edge.to)));
            showToast('已成功断开任务依赖');
          }}
          onDeleteNode={(nodeId) => {
            setDesignerNodes((prev) => prev.filter((node) => node.id !== nodeId));
            setDesignerEdges((prev) => prev.filter((edge) => edge.from !== nodeId && edge.to !== nodeId));
            showToast('成功移除了任务节点');
          }}
          onDragStartFromPool={handleDragStartFromPool}
          onNodeConfigOpen={(node) => {
            setNodeToConfig({ ...node });
            setNodeConfigModalOpen(true);
          }}
          onNodeMouseDown={handleNodeMouseDown}
          onToggleEdgeStrategy={toggleEdgeStrategy}
        />
        </div>
      ) : null}

      <DeleteWorkflowModal
        open={deleteConfirmOpen}
        workflow={workflowToDelete}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setWorkflowToDelete(null);
        }}
        onConfirm={handleConfirmDeleteWorkflow}
      />

      <NodeConfigModal
        open={nodeConfigModalOpen}
        node={nodeToConfig}
        onClose={() => {
          setNodeConfigModalOpen(false);
          setNodeToConfig(null);
        }}
        onNodeChange={setNodeToConfig as (node: WorkflowNode) => void}
        onSave={handleSaveNodeConfig}
      />

      <HistoryVersionsModal
        open={historyModalOpen}
        workflow={selectedWorkflow}
        versions={selectedWorkflow ? workflowVersions[selectedWorkflow.id] ?? [] : []}
        onRollback={(snapshot) => {
          handleRollbackSnapshot(snapshot);
          setHistoryModalOpen(false);
        }}
        onClose={() => setHistoryModalOpen(false)}
      />

      <SaveVersionModal
        open={saveRemarkModalOpen}
        versionRemark={versionRemark}
        onRemarkChange={setVersionRemark}
        onClose={() => setSaveRemarkModalOpen(false)}
        onConfirm={handleConfirmSaveVersion}
      />

      <ScheduleConfigModal
        open={scheduleModalOpen}
        workflow={workflowToConfig}
        channelsList={channelsList}
        onWorkflowChange={setWorkflowToConfig}
        onClose={() => {
          setScheduleModalOpen(false);
          setWorkflowToConfig(null);
        }}
        onSave={handleSaveScheduleConfig}
      />

      <CreateWorkflowModal
        open={createModalOpen}
        name={newWorkflowName}
        description={newWorkflowDesc}
        onClose={setCreateModalOpen}
        onConfirm={handleConfirmCreateWorkflow}
        onNameChange={setNewWorkflowName}
        onDescriptionChange={setNewWorkflowDesc}
      />

      <SchedulerExecutionLogsModal
        open={executionLogsOpen}
        workflow={executionLogsWorkflow}
        executions={executionRows}
        selectedExecutionId={selectedExecutionId}
        logs={executionLogRows}
        nodes={executionNodeRows}
        loadingExecutions={executionLogsLoading}
        loadingDetails={executionDetailsLoading}
        detailsError={executionDetailsError}
        onClose={closeExecutionLogs}
        onRefresh={() => {
          if (executionLogsWorkflow) void openWorkflowExecutionLogs(executionLogsWorkflow, selectedExecutionId ?? undefined);
        }}
        onSelectExecution={(executionId) => {
          void loadExecutionDetails(executionId);
        }}
      />
    </main>
  );
}
