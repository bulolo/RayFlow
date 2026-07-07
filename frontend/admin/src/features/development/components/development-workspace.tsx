'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type FlinkJobRequest,
  useCancelFlinkJob,
  useCreateFlinkJob,
  useDeleteFlinkJob,
  useExecuteFlinkSqlPreview,
  useListFlinkRuntimes,
  useListFlinkJobs,
  usePublishFlinkJob,
  useDebugFlinkJob,
  useStartFlinkJob,
  useTriggerFlinkSavepoint,
  useUpdateFlinkJob,
  useValidateFlinkSql,
} from '@/shared/api/generated';
import { Tooltip } from '@/components/ui';
import {
  DevelopmentContextMenus,
  DevelopmentJobSidebar,
  DevelopmentMainContent,
  DevelopmentModals,
  LeftPanelTabs,
  type DevelopmentViewMode,
  type LeftPanelTab,
  VariablesPanel,
} from '@/features/development/components';
import { emptyJobForm, extractSqlSchema, formFromJob, formatSql } from '@/features/development/lib/job-forms';
import type { SqlValidationDiagnostic } from '@/features/development/lib/sql-editor-diagnostics';
import {
  extractSqlPlaceholders,
} from '@/features/development/lib/variables';
import {
  buildGroupTree,
  normalizeGroupPath,
  normalizeJobs,
} from '@/features/development/lib/job-groups';
import {
  useRuntimeIndex,
  useDevelopmentJobActions,
  useDevelopmentJobGroups,
  useDevelopmentLayoutState,
  useDevelopmentOpsState,
  useDevelopmentDraftOutput,
  type OpsStatusFilter,
  type OpsTypeFilter,
  useDevelopmentSqlPreview,
  useDevelopmentVariables,
  useJobAutoRefresh,
  type OpsRuntimeModeFilter,
} from '@/features/development/hooks';
import type { DevelopmentConfirmDialogState } from '@/features/development/types';
import { useAuthTokenState } from '@/hooks/use-auth-token-state';
import { getErrorMessage } from '@/lib/error-message';
import type { ExtendedFlinkJob } from '@/types/extended';
import { toast } from 'sonner';

function jobTypeLabel(type?: string) {
  const labels: Record<string, string> = {
    SQL: 'SQL',
    JAR: 'JAR',
    PYTHON: 'Python',
  };
  return type ? labels[type] ?? '其他' : '未分类';
}

const opsStatusFilters: OpsStatusFilter[] = ['all', 'running', 'abnormal', 'created', 'canceled', 'finished'];
const opsTypeFilters: OpsTypeFilter[] = ['all', 'SQL', 'JAR', 'PYTHON'];
const opsRuntimeModeFilters: OpsRuntimeModeFilter[] = ['all', 'STREAMING', 'BATCH'];

function opsStatusFilterLabel(filter: OpsStatusFilter) {
  const labels: Record<OpsStatusFilter, string> = {
    all: '全部',
    running: '运行中',
    abnormal: '异常',
    created: '已创建',
    canceled: '已取消',
    finished: '已完成',
  };
  return labels[filter];
}

function opsStatusParam(filter: OpsStatusFilter) {
  if (filter === 'all') return undefined;
  if (filter === 'abnormal') return 'FAILED,ERROR';
  if (filter === 'canceled') return 'CANCELED,CANCELLED';
  if (filter === 'finished') return 'FINISHED';
  return filter.toUpperCase();
}

function opsTypeFilterLabel(filter: OpsTypeFilter) {
  if (filter === 'all') return '全部';
  return jobTypeLabel(filter);
}

function opsRuntimeModeFilterLabel(filter: OpsRuntimeModeFilter) {
  const labels: Record<OpsRuntimeModeFilter, string> = {
    all: '全部',
    STREAMING: '流',
    BATCH: '批',
  };
  return labels[filter];
}

export function DevelopmentWorkspace({
  selectedJobId: controlledSelectedJobId,
  onSelectedJobChange,
  viewMode,
  onViewModeChange,
}: {
  onSelectedJobChange?: (jobId: number | null) => void;
  onViewModeChange: (mode: DevelopmentViewMode) => void;
  selectedJobId?: number | null;
  viewMode: DevelopmentViewMode;
}) {
  const hasToken = useAuthTokenState();
  const [uncontrolledSelectedJobId, setUncontrolledSelectedJobId] = useState<number | null>(null);
  const selectedJobId = controlledSelectedJobId !== undefined ? controlledSelectedJobId : uncontrolledSelectedJobId;
  const [leftPanelTab, setLeftPanelTab] = useState<LeftPanelTab>('jobs');
  const [draft, setDraft] = useState<FlinkJobRequest>(emptyJobForm());
  const [previewTab, setPreviewTab] = useState<'result' | 'output'>('result');
  const previousSelectedJobIdRef = useRef<number | null | undefined>(undefined);
  const [jobSearch, setJobSearch] = useState('');
  const {
    handleOpsFilterChange,
    handleOpsJobNameSearchChange,
    handleOpsRuntimeModeFilterChange,
    handleOpsTagSearchChange,
    handleOpsSelectionModeChange,
    handleOpsTypeFilterChange,
    opsJobNameKeyword,
    opsPage,
    opsPageSize,
    opsRuntimeModeFilter,
    opsSelectionMode,
    opsStatusFilter,
    opsTagKeyword,
    opsTypeFilter,
    selectedOpsJobIds,
    setOpsPage,
    setOpsPageSize,
    setOpsSelectionMode,
    setSelectedOpsJobIds,
  } = useDevelopmentOpsState();
  const [jobGroupOverrides, setJobGroupOverrides] = useState<Record<number, string>>({});
  const [confirmDialog, setConfirmDialog] = useState<DevelopmentConfirmDialogState | null>(null);
  const [sqlValidationDiagnostic, setSqlValidationDiagnostic] = useState<SqlValidationDiagnostic | null>(null);

  const setSelectedJobId = useCallback((jobId: number | null) => {
    if (controlledSelectedJobId === undefined) {
      setUncontrolledSelectedJobId(jobId);
    }
    onSelectedJobChange?.(jobId);
  }, [controlledSelectedJobId, onSelectedJobChange]);

  const clusters = useListFlinkRuntimes(undefined, { query: { enabled: hasToken } });
  const jobs = useListFlinkJobs({ is_pager: 0, page: 1, size: 100 }, { query: { enabled: hasToken } });
  const opsJobs = useListFlinkJobs(
    {
      is_pager: 1,
      page: opsPage,
      size: opsPageSize,
      job_name: opsJobNameKeyword.trim() || undefined,
      job_tags: opsTagKeyword.trim() || undefined,
      status: opsStatusParam(opsStatusFilter),
      job_type: opsTypeFilter === 'all' ? undefined : opsTypeFilter,
      runtime_mode: opsRuntimeModeFilter === 'all' ? undefined : opsRuntimeModeFilter,
    },
    { query: { enabled: hasToken && viewMode === 'ops' } },
  );
  const refetchClusters = clusters.refetch;
  const refetchJobs = jobs.refetch;
  const refetchOpsJobs = opsJobs.refetch;
  const createJob = useCreateFlinkJob();
  const updateJob = useUpdateFlinkJob();
  const deleteJob = useDeleteFlinkJob();
  const cancelJob = useCancelFlinkJob();
  const startJob = useStartFlinkJob();
  const debugJob = useDebugFlinkJob();
  const publishJob = usePublishFlinkJob();
  const triggerSavepoint = useTriggerFlinkSavepoint();
  const previewSql = useExecuteFlinkSqlPreview();
  const validateSql = useValidateFlinkSql();
  const {
    deletePending: deletingVariable,
    handleCreateVariable,
    handleDeleteVariable,
    handleUpdateVariable,
    isLoading: variablesLoading,
    variables: variableRows,
  } = useDevelopmentVariables();
  const {
    previewHeight,
    rightPanelTab,
    settingsCollapsed,
    settingsWidth,
    setPreviewHeight,
    setRightPanelTab,
    setSettingsWidth,
    setSidebarCollapsed,
    setSidebarWidth,
    sidebarCollapsed,
    sidebarWidth,
    startHorizontalResize,
    startVerticalResize,
    toggleSettingsPanel,
    toggleSidebar,
  } = useDevelopmentLayoutState();

  const clusterList = useMemo(() => clusters.data?.list ?? [], [clusters.data]);
  const firstClusterId = clusterList[0]?.id;
  const baseJobs = useMemo(() => (hasToken ? normalizeJobs(jobs.data) : []), [hasToken, jobs.data]);
  const currentJobs = useMemo(
    () => baseJobs.map((job) => (job.id && job.id in jobGroupOverrides ? { ...job, jobGroup: jobGroupOverrides[job.id] } : job)),
    [baseJobs, jobGroupOverrides],
  );

  useEffect(() => {
    if (!hasToken) return;
    void refetchClusters();
    void refetchJobs();
    if (viewMode === 'ops') {
      void refetchOpsJobs();
    }
  }, [hasToken, refetchClusters, refetchJobs, refetchOpsJobs, viewMode]);

  const allGroupKeys = useMemo(
    () =>
      Array.from(
        new Set(
          currentJobs
            .map((job) => normalizeGroupPath(job.jobGroup))
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [currentJobs],
  );
  const selectedJob = currentJobs.find((job) => job.id === selectedJobId) ?? currentJobs[0] ?? null;
  const {
    outputLoading: previewOutputLoading,
    outputText: previewOutputText,
    reset: resetDraftOutput,
    runWithOutput,
  } = useDevelopmentDraftOutput({
    enabled: hasToken,
    selectedJob,
  });
  const filteredJobs = currentJobs.filter((job) => {
    const keyword = jobSearch.trim().toLowerCase();
    if (!keyword) return true;
    return `${job.jobName ?? ''} ${job.status ?? ''} ${job.jobType ?? ''}`.toLowerCase().includes(keyword);
  });
  const opsRows = useMemo(() => normalizeJobs(opsJobs.data), [opsJobs.data]);
  const selectedOpsJobs = useMemo(
    () => opsRows.filter((job) => job.id && selectedOpsJobIds.includes(job.id)),
    [opsRows, selectedOpsJobIds],
  );
  const opsTotal = opsJobs.data?.pagination?.total ?? opsRows.length;
  const resolvedOpsPageSize = opsJobs.data?.pagination?.size ?? opsPageSize;
  const opsPageCount = Math.max(1, Math.ceil(opsTotal / resolvedOpsPageSize));
  const opsFilterOptions = useMemo(
    () =>
      opsStatusFilters.map((filter) => ({
        key: filter,
        label: opsStatusFilterLabel(filter),
      })),
    [],
  );
  const opsTypeFilterOptions = useMemo(
    () =>
      opsTypeFilters.map((filter) => ({
        key: filter,
        label: opsTypeFilterLabel(filter),
      })),
    [],
  );
  const opsRuntimeModeFilterOptions = useMemo(
    () =>
      opsRuntimeModeFilters.map((filter) => ({
        key: filter,
        label: opsRuntimeModeFilterLabel(filter),
      })),
    [],
  );
  const {
    batchSavepointJobs,
    closeSavepointDialog,
    createOpen,
    handleBatchCancelJobs,
    handleBatchRunJobs,
    handleCancel,
    handleCancelJob,
    handleCreate,
    deleteJobImmediately,
    handleDelete,
    handleEditJob,
    handleRun,
    handleRunJob,
    handlePublish,
    handlePublishJob,
    handleSave,
    handleTriggerSavepoint,
    newJob,
    openBatchSavepoint,
    openCreateJob,
    openJobSavepoint,
    operatingJobIds,
    savepointCancel,
    savepointJob,
    savepointTarget,
    setCreateOpen,
    setNewJob,
    setSavepointCancel,
    setSavepointTarget,
    submitPending,
    publishPending,
    triggerSavepointPending,
    updatePending,
  } = useDevelopmentJobActions({
    cancelJob,
    deleteJob,
    draft,
    firstClusterId,
    jobsRefetch: async () => {
      await Promise.all([jobs.refetch(), opsJobs.refetch()]);
    },
    onAfterDelete: (job) => {
      if (selectedJobId === job.id) {
        setSelectedJobId(null);
      }
    },
    selectedJob,
    selectedJobId,
    setConfirmDialog,
    setSelectedJobId,
    setSelectedOpsJobIds,
    startJob,
    debugJob,
    publishJob,
    createJob,
    triggerSavepoint,
    updateJob,
  });
  const {
    collapsedGroups,
    createGroupOpen,
    customGroups,
    dragOverGroupKey,
    dragOverRoot,
    draggingGroupKey,
    draggingJobId,
    editGroupName,
    editGroupOpen,
    editGroupParent,
    editingGroupPath,
    groupContextMenu,
    handleConfirmDialogOpenChange,
    handleConfirmSubmit,
    handleContextDelete,
    handleCreateGroup,
    handleCreateJobInGroup,
    handleCreateSubGroup,
    handleDeleteGroup,
    handleEditGroup,
    handleEditGroupOpenChange,
    handleGroupDrop,
    handleOpenEditGroup,
    handleRootDrop,
    jobContextMenu,
    newGroupName,
    newGroupParent,
    openCreateGroup,
    openGroupContextMenu,
    openJobContextMenu,
    setCreateGroupOpen,
    setDragOverGroupKey,
    setDragOverRoot,
    setDraggingGroupKey,
    setDraggingJobId,
    setEditGroupName,
    setEditGroupParent,
    setNewGroupName,
    setNewGroupParent,
    toggleGroup,
  } = useDevelopmentJobGroups({
    confirmDialog,
    currentJobs,
    firstClusterId,
    groupKeys: allGroupKeys,
    jobsRefetch: async () => {
      await Promise.all([jobs.refetch(), opsJobs.refetch()]);
    },
    deleteJobImmediately,
    onDeleteJob: handleDelete,
    onOpenCreateJob: openCreateJob,
    selectedJobId,
    setConfirmDialog,
    setJobGroupOverrides,
    setSelectedJobId,
    updateJob,
  });
  const jobGroups = useMemo(() => {
    const groupNames = new Set<string>(customGroups);
    const groups = new Map<string, ExtendedFlinkJob[]>();
    for (const job of filteredJobs) {
      const key = normalizeGroupPath(job.jobGroup);
      if (!key) continue;
      groupNames.add(key);
      groups.set(key, [...(groups.get(key) ?? []), job]);
    }
    return Array.from(groupNames)
      .sort((a, b) => a.localeCompare(b))
      .map((key) => ({ key, label: key, rows: groups.get(key) ?? [] }));
  }, [customGroups, filteredJobs]);
  const groupOptions = useMemo(() => jobGroups.map((group) => group.key), [jobGroups]);
  const groupTree = useMemo(() => buildGroupTree(jobGroups), [jobGroups]);
  const ungroupedJobs = useMemo(
    () => filteredJobs.filter((job) => !normalizeGroupPath(job.jobGroup)),
    [filteredJobs],
  );
  const { clusterNameById, clusterAddressById } = useRuntimeIndex(clusterList);
  const saving = submitPending || updatePending;
  const isRunning = selectedJob?.status === 'RUNNING';
  const isSql = draft.jobType === 'SQL';
  const hasJobs = currentJobs.length > 0;
  const jobsInitialLoading = hasToken && !jobs.data && (jobs.isLoading || jobs.isFetching);
  const clustersInitialLoading = hasToken && !clusters.data && (clusters.isLoading || clusters.isFetching);
  const developInitialLoading = viewMode === 'develop' && (jobsInitialLoading || clustersInitialLoading);
  const developRefreshing = !developInitialLoading && (jobs.isFetching || clusters.isFetching);
  const opsInitialLoading = viewMode === 'ops' && !opsJobs.data && (opsJobs.isLoading || opsJobs.isFetching);
  const opsRefreshing = viewMode === 'ops' && !opsInitialLoading && opsJobs.isFetching;
  const {
    handlePreview,
    previewData,
    previewLoading,
    setPreviewData,
  } = useDevelopmentSqlPreview({
    draft,
    previewSql,
    setPreviewHeight,
  });

  useJobAutoRefresh(baseJobs, jobs.refetch, opsJobs.refetch);

  // The editor draft intentionally tracks the active row and resets preview state when selection changes.
  useEffect(() => {
    const nextSelectedJobId = selectedJob?.id ?? null;
    const selectedJobChanged = previousSelectedJobIdRef.current !== undefined && previousSelectedJobIdRef.current !== nextSelectedJobId;
    previousSelectedJobIdRef.current = nextSelectedJobId;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(formFromJob(selectedJob, firstClusterId));
    setPreviewData(null);
    if (selectedJobChanged) {
      resetDraftOutput();
    }
    setSqlValidationDiagnostic(null);
  }, [firstClusterId, resetDraftOutput, selectedJob, setPreviewData]);

  // This keeps local optimistic group overrides aligned with the latest server snapshot.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setJobGroupOverrides((prev) => {
      const next = { ...prev };
      for (const job of baseJobs) {
        if (job.id && job.id in next && (job.jobGroup ?? '') === next[job.id]) {
          delete next[job.id];
        }
      }
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });
  }, [baseJobs]);

  const sqlPlaceholders = useMemo(() => extractSqlPlaceholders(draft.content), [draft.content]);
  const unresolvedSqlPlaceholders = useMemo(() => {
    const defined = new Set(variableRows.map((item) => item.variableName).filter(Boolean));
    return sqlPlaceholders.filter((name) => !defined.has(name));
  }, [sqlPlaceholders, variableRows]);
  const sqlSchema = useMemo(() => extractSqlSchema(draft.content ?? ''), [draft.content]);

  function handleFormatSql() {
    if (!isSql) return;
    const content = draft.content?.trim();
    if (!content) {
      toast.error('请输入 SQL 内容');
      return;
    }
    try {
      setDraft({ ...draft, content: formatSql(content) });
    } catch (error) {
      toast.error(getErrorMessage(error, 'SQL 格式化失败'));
    }
  }

  function handleDraftChange(nextDraft: FlinkJobRequest) {
    if (nextDraft.content !== draft.content) {
      setSqlValidationDiagnostic(null);
    }
    setDraft(nextDraft);
  }

  async function handleValidateSql() {
    if (!draft.clusterId) {
      toast.error('请先选择运行时');
      return;
    }
    if (!draft.content?.trim()) {
      toast.error('请输入 SQL 内容');
      return;
    }
    try {
      const result = await validateSql.mutateAsync({
        data: {
          clusterId: draft.clusterId,
          sql: draft.content,
        },
      });
      if (result.valid) {
        setSqlValidationDiagnostic(null);
        toast.success(result.message || `SQL 校验通过，共 ${result.statementCount ?? 0} 条语句`);
        return;
      }
      setSqlValidationDiagnostic({
        line: result.line ?? 1,
        column: result.column ?? 1,
        message: result.message || 'SQL 校验失败',
      });
      toast.error(result.message || 'SQL 校验失败');
    } catch (error) {
      toast.error(getErrorMessage(error, 'SQL 校验失败'));
    }
  }

  async function handleRefreshJobs() {
    try {
      await Promise.all([jobs.refetch(), opsJobs.refetch(), clusters.refetch()]);
    } catch (error) {
      toast.error(getErrorMessage(error, '刷新失败'));
    }
  }

  return (
    <>
      <div className="flex h-[calc(100vh-112px)] min-h-[720px] overflow-hidden rounded-lg border border-border-subtle bg-white shadow-card max-lg:h-[760px]">
        <aside
          className="flex shrink-0 bg-zinc-50/60"
          style={{ width: sidebarCollapsed || viewMode === 'ops' ? 56 : sidebarWidth + 56 }}
        >
          <LeftPanelTabs
            activeTab={leftPanelTab}
            collapsed={sidebarCollapsed}
            onChange={(tab) => {
              setLeftPanelTab(tab);
              if (sidebarCollapsed) {
                setSidebarCollapsed(false);
              }
            }}
            onOpsSelectionModeChange={handleOpsSelectionModeChange}
            onModeChange={(mode) => {
              setOpsSelectionMode(false);
              setSelectedOpsJobIds([]);
              onViewModeChange(mode);
            }}
            onRefresh={() => void handleRefreshJobs()}
            onToggle={toggleSidebar}
            opsSelectionMode={opsSelectionMode}
            refreshing={viewMode === 'ops' ? opsInitialLoading || opsRefreshing : developInitialLoading || developRefreshing}
            viewMode={viewMode}
          />
            {!sidebarCollapsed && viewMode === 'develop' && leftPanelTab === 'jobs' && (
              <DevelopmentJobSidebar
                collapsedGroups={collapsedGroups}
                dragOverGroupKey={dragOverGroupKey}
                dragOverRoot={dragOverRoot}
                draggingGroupKey={draggingGroupKey}
                draggingJobId={draggingJobId}
                groupTree={groupTree}
                isRefreshing={developRefreshing}
                jobSearch={jobSearch}
                loading={developInitialLoading}
                onCreateGroup={() => openCreateGroup()}
                onCreateJob={openCreateJob}
                onDragLeaveGroup={(groupKey) => {
                  setDragOverGroupKey((prev) => (prev === groupKey ? null : prev));
                }}
                onDragOverGroup={(groupKey) => {
                  if (draggingJobId || draggingGroupKey) setDragOverGroupKey(groupKey);
                }}
                onDragStartGroup={(event, groupKey) => {
                  setDraggingGroupKey(groupKey);
                  setDraggingJobId(null);
                  setDragOverGroupKey(null);
                  setDragOverRoot(false);
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('application/x-rayflow-group', groupKey);
                }}
                onDropGroup={handleGroupDrop}
                onDropRoot={handleRootDrop}
                onGroupContextMenu={openGroupContextMenu}
                onJobContextMenu={openJobContextMenu}
                onJobSearchChange={setJobSearch}
                onRefresh={() => void handleRefreshJobs()}
                onRootDragOver={() => {
                  if (draggingJobId || draggingGroupKey) {
                    setDragOverGroupKey(null);
                    setDragOverRoot(true);
                  }
                }}
                onRootDragLeave={(event) => {
                  event.stopPropagation();
                  const related = event.relatedTarget as Node | null;
                  if (!related || !event.currentTarget.contains(related)) {
                    setDragOverRoot(false);
                  }
                }}
                onSelectJob={(job) => job.id && setSelectedJobId(job.id)}
                onToggleGroup={toggleGroup}
                selectedJobId={selectedJob?.id}
                setDraggingGroupKey={setDraggingGroupKey}
                setDraggingJobId={setDraggingJobId}
                setDragOverGroupKey={setDragOverGroupKey}
                setDragOverRoot={setDragOverRoot}
                ungroupedJobs={ungroupedJobs}
              />
            )}
          {!sidebarCollapsed && viewMode === 'develop' && leftPanelTab === 'variables' && (
            <div className="flex min-w-0 flex-1 flex-col">
              <VariablesPanel
                currentPlaceholders={sqlPlaceholders}
                deleting={deletingVariable}
                isLoading={variablesLoading}
                onCreate={handleCreateVariable}
                onDelete={handleDeleteVariable}
                onUpdate={handleUpdateVariable}
                variables={variableRows}
              />
            </div>
          )}
        </aside>
        {!sidebarCollapsed && viewMode === 'develop' && (
          <Tooltip content="拖动调整作业导航宽度" side="right" className="w-2 shrink-0 self-stretch">
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="拖动调整作业导航宽度"
              onMouseDown={(event) => startHorizontalResize(event, sidebarWidth, setSidebarWidth, { min: 300, max: 480 })}
              className="h-full w-full cursor-col-resize bg-zinc-100 transition hover:bg-primary/20"
            />
          </Tooltip>
        )}

        <DevelopmentMainContent
          cancelDisabled={cancelJob.isPending}
          clusterAddressById={clusterAddressById}
          clusterList={clusterList}
          clusterNameById={clusterNameById}
          draft={draft}
          groupOptions={groupOptions}
          hasJobs={hasJobs}
          initialLoading={developInitialLoading}
          isRunning={isRunning}
          isSql={isSql}
          jobDescription={draft.description || selectedJob?.description || ''}
          onCancel={handleCancel}
          onCancelJob={handleCancelJob}
          onChangeDraft={handleDraftChange}
          onClearPreview={() => setPreviewData(null)}
          onCollapsePreview={() => setPreviewHeight(36)}
          onCreateGroup={() => openCreateGroup()}
          onCreateJob={openCreateJob}
          onDeleteJob={handleDelete}
          onEditJob={(job) => handleEditJob(job, onViewModeChange)}
          onExpandPreview={() => setPreviewHeight(224)}
          onFormatSql={handleFormatSql}
          onJobNameKeywordChange={handleOpsJobNameSearchChange}
          onTagKeywordChange={handleOpsTagSearchChange}
          onOpsBatchCancel={handleBatchCancelJobs}
          onOpsBatchRun={handleBatchRunJobs}
          onOpsBatchSavepoint={openBatchSavepoint}
          onOpsPageChange={(nextPage) => {
            setSelectedOpsJobIds([]);
            setOpsPage(nextPage);
          }}
          onOpsPageSizeChange={(nextSize) => {
            setSelectedOpsJobIds([]);
            setOpsPage(1);
            setOpsPageSize(nextSize);
          }}
          onOpsPublish={handlePublishJob}
          onOpsSavepoint={openJobSavepoint}
          onOpsStatusFilterChange={handleOpsFilterChange}
          onOpsRuntimeModeFilterChange={handleOpsRuntimeModeFilterChange}
          onOpsTypeFilterChange={handleOpsTypeFilterChange}
          onPreview={() => {
            setPreviewTab('result');
            void handlePreview(previewHeight);
          }}
          onPreviewResizeStart={startVerticalResize}
          onRun={async () => {
            setPreviewTab('output');
            if (previewHeight < 140) setPreviewHeight(224);
            await runWithOutput(handleRun);
          }}
          onRunJob={handleRunJob}
          onPublish={handlePublish}
          onSave={handleSave}
          onValidateSql={handleValidateSql}
          onSelectedOpsJobIdsChange={setSelectedOpsJobIds}
          onSelectionModeChange={handleOpsSelectionModeChange}
          onSettingsResizeStart={(event) => startHorizontalResize(event, settingsWidth, setSettingsWidth, { direction: 'left', min: 440, max: 860 })}
          onToggleSettings={toggleSettingsPanel}
          onTriggerSavepoint={() => selectedJob && openJobSavepoint(selectedJob)}
          operatingJobIds={operatingJobIds}
          publishPending={publishPending}
          opsJobs={opsRows}
          opsJobNameKeyword={opsJobNameKeyword}
          opsTagKeyword={opsTagKeyword}
          opsLoading={opsInitialLoading || opsRefreshing}
          opsPage={opsPage}
          opsPageCount={opsPageCount}
          opsPageSize={opsPageSize}
          opsSelectionMode={opsSelectionMode}
          opsStatusFilterOptions={opsFilterOptions}
          opsStatusFilterValue={opsStatusFilter}
          opsTotal={opsTotal}
          opsRuntimeModeFilterOptions={opsRuntimeModeFilterOptions}
          opsRuntimeModeFilterValue={opsRuntimeModeFilter}
          opsTypeFilterOptions={opsTypeFilterOptions}
          opsTypeFilterValue={opsTypeFilter}
          previewData={previewData}
          previewHeight={previewHeight}
          previewLoading={previewLoading}
          previewOutputLoading={previewOutputLoading}
          previewOutputText={previewOutputText}
          previewTab={previewTab}
          rightPanelTab={rightPanelTab}
          saveDisabled={!selectedJob || saving}
          saving={saving}
          selectedJob={selectedJob}
          selectedJobId={selectedJob?.id}
          selectedOpsJobIds={selectedOpsJobIds}
          selectedOpsJobs={selectedOpsJobs}
          setPreviewTab={setPreviewTab}
          setRightPanelTab={setRightPanelTab}
          settingsCollapsed={settingsCollapsed}
          settingsWidth={settingsWidth}
          sqlPlaceholders={sqlPlaceholders}
          sqlSchema={sqlSchema}
          sqlValidationDiagnostic={sqlValidationDiagnostic}
          status={selectedJob?.status}
          unresolvedSqlPlaceholders={unresolvedSqlPlaceholders}
          validatingSql={validateSql.isPending}
          viewMode={viewMode}
        />
      </div>

      <DevelopmentContextMenus
        groupContextMenu={groupContextMenu}
        jobContextMenu={jobContextMenu}
        onContextDelete={handleContextDelete}
        onCreateJobInGroup={handleCreateJobInGroup}
        onCreateSubGroup={handleCreateSubGroup}
        onDeleteGroup={handleDeleteGroup}
        onOpenEditGroup={handleOpenEditGroup}
      />

      <DevelopmentModals
        batchSavepointJobs={batchSavepointJobs}
        cancelDeletePending={cancelJob.isPending}
        clusterList={clusterList}
        confirmDialog={confirmDialog}
        createGroupOpen={createGroupOpen}
        createOpen={createOpen}
        deletePending={deleteJob.isPending}
        editGroupName={editGroupName}
        editGroupOpen={editGroupOpen}
        editGroupParent={editGroupParent}
        editingGroupPath={editingGroupPath}
        groupOptions={groupOptions}
        newGroupName={newGroupName}
        newGroupParent={newGroupParent}
        newJob={newJob}
        onConfirmDialogOpenChange={handleConfirmDialogOpenChange}
        onConfirmDialogSubmit={handleConfirmSubmit}
        onCreateGroup={handleCreateGroup}
        onCreateJob={handleCreate}
        onEditGroup={handleEditGroup}
        onEditGroupNameChange={setEditGroupName}
        onEditGroupOpenChange={handleEditGroupOpenChange}
        onEditGroupParentChange={setEditGroupParent}
        onNewGroupNameChange={setNewGroupName}
        onNewGroupOpenChange={setCreateGroupOpen}
        onNewGroupParentChange={setNewGroupParent}
        onNewJobChange={setNewJob}
        onNewJobOpenChange={setCreateOpen}
        onSavepointCancelChange={setSavepointCancel}
        onSavepointOpenChange={(open) => {
          if (!open) {
            closeSavepointDialog();
          }
        }}
        onSavepointSubmit={handleTriggerSavepoint}
        onSavepointTargetChange={setSavepointTarget}
        savepointCancel={savepointCancel}
        savepointJob={savepointJob}
        savepointTarget={savepointTarget}
        submitPending={submitPending}
        triggerSavepointPending={triggerSavepointPending}
        updatePending={updatePending}
      />
    </>
  );
}
