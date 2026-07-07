'use client';

import { Folder, FolderPlus, Plus } from 'lucide-react';
import type { FlinkRuntimeResponse, FlinkJobResponse, FlinkJobRequest } from '@/shared/api/generated';
import { Button, Tooltip } from '@/components/ui';
import { DevelopmentSettingsSidebar } from '@/features/development/components/development-settings-sidebar';
import {
  JarConfigPanel,
  PreviewPanel,
  type PreviewData,
  SqlEditor,
} from '@/features/development/components/job-editor-panels';
import type { SqlValidationDiagnostic } from '@/features/development/lib/sql-editor-diagnostics';
import { JobOpsView, type OpsColumnFilterOption } from '@/features/development/components/job-ops-view';
import type { RightPanelTab } from '@/features/development/components/panel-rails';
import type { ExtendedFlinkJob } from '@/types/extended';

const editorSkeletonRows = Array.from({ length: 13 });
const settingsSkeletonRows = Array.from({ length: 6 });

interface DevelopmentMainContentProps {
  cancelDisabled: boolean;
  clusterAddressById: Map<number | undefined, string | undefined>;
  clusterList: FlinkRuntimeResponse[];
  clusterNameById: Map<number | undefined, string | undefined>;
  draft: FlinkJobRequest;
  groupOptions: string[];
  hasJobs: boolean;
  initialLoading: boolean;
  isRunning: boolean;
  isSql: boolean;
  jobDescription?: string;
  onCancel: () => void;
  onCancelJob: (job: FlinkJobResponse) => void;
  onChangeDraft: (value: FlinkJobRequest) => void;
  onClearPreview: () => void;
  onCollapsePreview: () => void;
  onCreateGroup: () => void;
  onCreateJob: () => void;
  onDeleteJob: (job: FlinkJobResponse) => void;
  onEditJob: (job: FlinkJobResponse) => void;
  onExpandPreview: () => void;
  onFormatSql: () => void;
  onKeywordChange: (value: string) => void;
  onOpsBatchCancel: (jobs: ExtendedFlinkJob[]) => void;
  onOpsBatchRun: (jobs: ExtendedFlinkJob[]) => void;
  onOpsBatchSavepoint: (jobs: ExtendedFlinkJob[]) => void;
  onOpsPageChange: (page: number) => void;
  onOpsPageSizeChange: (size: number) => void;
  onOpsPublish: (job: FlinkJobResponse) => void;
  onOpsSavepoint: (job: FlinkJobResponse) => void;
  onOpsStatusFilterChange: (value: string) => void;
  onOpsTypeFilterChange: (value: string) => void;
  onPreview: () => void;
  onPreviewResizeStart: (event: React.MouseEvent) => void;
  onPublish: () => void;
  onRun: () => void;
  onRunJob: (job: FlinkJobResponse) => void;
  onSave: () => void;
  onValidateSql: () => void;
  onSelectedOpsJobIdsChange: (ids: number[]) => void;
  onSelectionModeChange: (enabled: boolean) => void;
  onSettingsResizeStart: (event: React.MouseEvent) => void;
  onToggleSettings: () => void;
  onTriggerSavepoint: () => void;
  operatingJobIds: Record<number, 'run' | 'debug' | 'publish' | 'cancel' | 'savepoint' | 'delete' | boolean>;
  opsJobs: ExtendedFlinkJob[];
  opsKeyword: string;
  opsLoading: boolean;
  opsPage: number;
  opsPageCount: number;
  opsPageSize: number;
  opsSelectionMode: boolean;
  opsStatusFilterOptions: OpsColumnFilterOption[];
  opsStatusFilterValue: string;
  opsTotal: number;
  opsTypeFilterOptions: OpsColumnFilterOption[];
  opsTypeFilterValue: string;
  previewData: PreviewData | null;
  previewHeight: number;
  previewLoading: boolean;
  previewOutputLoading: boolean;
  previewOutputText?: string;
  previewTab: 'result' | 'output';
  publishPending: boolean;
  rightPanelTab: RightPanelTab;
  saveDisabled: boolean;
  saving: boolean;
  selectedJob: FlinkJobResponse | null;
  selectedJobId?: number;
  selectedOpsJobIds: number[];
  selectedOpsJobs: ExtendedFlinkJob[];
  setPreviewTab: (tab: 'result' | 'output') => void;
  setRightPanelTab: (tab: RightPanelTab) => void;
  settingsCollapsed: boolean;
  settingsWidth: number;
  sqlPlaceholders: string[];
  sqlSchema: Record<string, string[]>;
  status?: string;
  unresolvedSqlPlaceholders: string[];
  validatingSql: boolean;
  sqlValidationDiagnostic?: SqlValidationDiagnostic | null;
  viewMode: 'develop' | 'ops';
}

export function DevelopmentMainContent({
  cancelDisabled,
  clusterAddressById,
  clusterList,
  clusterNameById,
  draft,
  groupOptions,
  hasJobs,
  initialLoading,
  isRunning,
  isSql,
  jobDescription,
  onCancel,
  onCancelJob,
  onChangeDraft,
  onClearPreview,
  onCollapsePreview,
  onCreateGroup,
  onCreateJob,
  onDeleteJob,
  onEditJob,
  onExpandPreview,
  onFormatSql,
  onKeywordChange,
  onOpsBatchCancel,
  onOpsBatchRun,
  onOpsBatchSavepoint,
  onOpsPageChange,
  onOpsPageSizeChange,
  onOpsPublish,
  onOpsSavepoint,
  onOpsStatusFilterChange,
  onOpsTypeFilterChange,
  onPreview,
  onPreviewResizeStart,
  onPublish,
  onRun,
  onRunJob,
  onSave,
  onValidateSql,
  onSelectedOpsJobIdsChange,
  onSelectionModeChange,
  onSettingsResizeStart,
  onToggleSettings,
  onTriggerSavepoint,
  operatingJobIds,
  opsJobs,
  opsKeyword,
  opsLoading,
  opsPage,
  opsPageCount,
  opsPageSize,
  opsSelectionMode,
  opsStatusFilterOptions,
  opsStatusFilterValue,
  opsTotal,
  opsTypeFilterOptions,
  opsTypeFilterValue,
  previewData,
  previewHeight,
  previewLoading,
  previewOutputLoading,
  previewOutputText,
  previewTab,
  publishPending,
  rightPanelTab,
  saveDisabled,
  saving,
  selectedJob,
  selectedJobId,
  selectedOpsJobIds,
  selectedOpsJobs,
  setPreviewTab,
  setRightPanelTab,
  settingsCollapsed,
  settingsWidth,
  sqlPlaceholders,
  sqlSchema,
  status,
  unresolvedSqlPlaceholders,
  validatingSql,
  sqlValidationDiagnostic,
  viewMode,
}: DevelopmentMainContentProps) {
  const showBottomPanel = previewHeight >= 36 && (isSql || previewTab === 'output');

  if (initialLoading) {
    return (
      <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-zinc-50/60">
        <div
          className="grid min-h-0 flex-1"
          style={{ gridTemplateColumns: settingsCollapsed ? 'minmax(0, 1fr) 56px' : `minmax(0, 1fr) 5px ${settingsWidth}px` }}
        >
          <section className="min-h-0 min-w-0 bg-white p-4">
            <div className="flex h-12 items-center justify-between border-b border-slate-100 pb-3">
              <div className="h-7 w-52 animate-pulse rounded-md bg-slate-200" />
              <div className="flex gap-2">
                <div className="h-8 w-20 animate-pulse rounded-md bg-slate-100" />
                <div className="h-8 w-20 animate-pulse rounded-md bg-slate-100" />
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {editorSkeletonRows.map((_, index) => (
                <div
                  key={index}
                  className="h-4 animate-pulse rounded bg-slate-100"
                  style={{ width: `${index % 4 === 0 ? 86 : index % 4 === 1 ? 62 : index % 4 === 2 ? 94 : 48}%` }}
                />
              ))}
            </div>
            <div className="mt-8 h-28 animate-pulse rounded-lg border border-slate-100 bg-slate-50" />
          </section>

          {!settingsCollapsed ? <div className="h-full w-full bg-zinc-100" /> : null}

          <aside className="min-h-0 border-l border-slate-200 bg-white p-4">
            {settingsCollapsed ? (
              <div className="flex flex-col items-center gap-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-8 w-8 animate-pulse rounded-lg bg-slate-100" />
                ))}
              </div>
            ) : (
              <>
                <div className="h-6 w-28 animate-pulse rounded bg-slate-200" />
                <div className="mt-5 space-y-3">
                  {settingsSkeletonRows.map((_, index) => (
                    <div key={index} className="h-11 animate-pulse rounded-lg bg-slate-50" />
                  ))}
                </div>
              </>
            )}
          </aside>
        </div>
      </main>
    );
  }

  if (viewMode === 'ops' && opsLoading && !opsJobs.length) {
    return (
      <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-zinc-50/60">
        <section className="relative flex min-h-0 flex-1 flex-col bg-zinc-50/60">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">
            <div>
              <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
              <div className="mt-2 h-3 w-56 animate-pulse rounded bg-slate-100" />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden p-4">
            <div className="mb-4 flex h-10 items-center justify-between">
              <div className="h-9 w-72 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-8 w-20 animate-pulse rounded-md bg-slate-100" />
            </div>
            <div className="overflow-hidden rounded-lg border border-border-subtle bg-white">
              <div className="grid h-10 grid-cols-[2fr_1fr_1fr_1fr_1.4fr_1fr_1fr_1.4fr] items-center gap-4 border-b border-border-subtle bg-slate-50/70 px-5">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="h-3 animate-pulse rounded bg-slate-200" />
                ))}
              </div>
              {Array.from({ length: 8 }).map((_, rowIndex) => (
                <div key={rowIndex} className="grid h-14 grid-cols-[2fr_1fr_1fr_1fr_1.4fr_1fr_1fr_1.4fr] items-center gap-4 border-b border-border-subtle px-5 last:border-b-0">
                  {Array.from({ length: 8 }).map((_, columnIndex) => (
                    <div
                      key={columnIndex}
                      className="h-3 animate-pulse rounded bg-slate-100"
                      style={{ width: `${columnIndex === 0 ? 88 : columnIndex % 3 === 0 ? 52 : 72}%` }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col">
      {viewMode === 'ops' ? (
        <JobOpsView
          clusterNameById={clusterNameById}
          clusterAddressById={clusterAddressById}
          jobs={opsJobs}
          keyword={opsKeyword}
          loading={opsLoading}
          operatingJobIds={operatingJobIds}
          onCancel={onCancelJob}
          onDelete={onDeleteJob}
          onEdit={onEditJob}
          onBatchCancel={onOpsBatchCancel}
          onBatchRun={onOpsBatchRun}
          onBatchSavepoint={onOpsBatchSavepoint}
          onKeywordChange={onKeywordChange}
          onStatusFilterChange={onOpsStatusFilterChange}
          onTypeFilterChange={onOpsTypeFilterChange}
          onRun={onRunJob}
          onPublish={onOpsPublish}
          onSavepoint={onOpsSavepoint}
          onPageChange={onOpsPageChange}
          onPageSizeChange={onOpsPageSizeChange}
          page={opsPage}
          pageCount={opsPageCount}
          pageSize={opsPageSize}
          selectionMode={opsSelectionMode}
          selectedJobIds={selectedOpsJobIds}
          selectedJobId={selectedJobId}
          selectedJobs={selectedOpsJobs}
          onSelectedJobIdsChange={onSelectedOpsJobIdsChange}
          onSelectionModeChange={onSelectionModeChange}
          statusFilterOptions={opsStatusFilterOptions}
          statusFilterValue={opsStatusFilterValue}
          totalJobs={opsTotal}
          typeFilterOptions={opsTypeFilterOptions}
          typeFilterValue={opsTypeFilterValue}
        />
      ) : !hasJobs ? (
        <section className="flex min-h-0 flex-1 items-center justify-center bg-zinc-50/60 p-8">
          <div className="flex max-w-md flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
              <Folder className="h-7 w-7 text-slate-300" />
            </div>
            <h2 className="text-base font-semibold text-slate-900">还没有作业</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">先创建一个 SQL 或 JAR 作业，再进入编辑器、预览结果和配置面板继续开发。</p>
            <div className="mt-6 flex items-center gap-2">
              <Button onClick={onCreateGroup} type="button">
                <FolderPlus className="h-4 w-4" />
                新建目录
              </Button>
              <Button onClick={onCreateJob} type="button" variant="primary">
                <Plus className="h-4 w-4" />
                新建作业
              </Button>
            </div>
          </div>
        </section>
      ) : (
        <div
          className="grid min-h-0 flex-1 bg-zinc-50/60"
          style={{ gridTemplateColumns: settingsCollapsed ? 'minmax(0, 1fr) 56px' : `minmax(0, 1fr) 5px ${settingsWidth}px` }}
        >
          <section
            className="grid min-h-0 min-w-0 bg-white"
            style={{ gridTemplateRows: showBottomPanel ? `minmax(0, 1fr) ${previewHeight}px` : 'minmax(0, 1fr)' }}
          >
            <div className="min-h-0 min-w-0">
              {isSql ? (
                <SqlEditor
                  content={draft.content ?? ''}
                  placeholders={sqlPlaceholders}
                  unresolvedPlaceholders={unresolvedSqlPlaceholders}
                  sqlSchema={sqlSchema}
                  onChange={(content: string) => onChangeDraft({ ...draft, content })}
                  onFormat={onFormatSql}
                  onQuery={onPreview}
                  onPublish={onPublish}
                  onRun={onRun}
                  onSave={onSave}
                  onValidate={onValidateSql}
                  onCancel={onCancel}
                  queryDisabled={!selectedJob || previewLoading}
                  publishDisabled={!selectedJob || saving || publishPending}
                  runDisabled={!selectedJob || saving}
                  saveDisabled={!selectedJob || saveDisabled}
                  validateDisabled={!selectedJob || validatingSql}
                  validating={validatingSql}
                  validationDiagnostic={sqlValidationDiagnostic}
                  cancelDisabled={cancelDisabled}
                  jobName={draft.jobName || '未命名作业'}
                  jobDescription={jobDescription || ''}
                  status={status}
                  docUrl={draft.docUrl}
                />
              ) : (
                <JarConfigPanel
                  draft={draft}
                  onChange={onChangeDraft}
                  onSave={onSave}
                  onPublish={onPublish}
                  onRun={onRun}
                  onCancel={onCancel}
                  runDisabled={!selectedJob || saving}
                  publishDisabled={!selectedJob || saving || publishPending}
                  saveDisabled={!selectedJob || saveDisabled}
                  cancelDisabled={cancelDisabled}
                  clusterName={draft.clusterId ? clusterNameById.get(draft.clusterId) : undefined}
                  status={status}
                  docUrl={draft.docUrl}
                />
              )}
            </div>
            {showBottomPanel ? (
              <PreviewPanel
                data={previewData}
                loading={previewLoading}
                outputLoading={previewOutputLoading}
                outputText={previewOutputText}
                activeTab={previewTab}
                onActiveTabChange={setPreviewTab}
                showResultTab={isSql}
                onClear={onClearPreview}
                onResizeStart={onPreviewResizeStart}
                onCollapse={onCollapsePreview}
                onExpand={onExpandPreview}
                isCollapsed={previewHeight <= 36}
              />
            ) : null}
          </section>

          {!settingsCollapsed ? (
            <Tooltip content="拖动调整配置面板宽度" side="left" className="w-2 shrink-0 self-stretch">
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="拖动调整配置面板宽度"
                onMouseDown={onSettingsResizeStart}
                className="h-full w-full cursor-col-resize bg-zinc-100 transition hover:bg-primary/20"
              />
            </Tooltip>
          ) : null}

          <DevelopmentSettingsSidebar
            clusterAddress={selectedJob?.clusterId ? clusterAddressById.get(selectedJob.clusterId) : undefined}
            clusterList={clusterList}
            draft={draft}
            groupOptions={groupOptions}
            isRunning={isRunning}
            onChangeDraft={onChangeDraft}
            onPublish={onPublish}
            onToggle={onToggleSettings}
            onTriggerSavepoint={onTriggerSavepoint}
            publishPending={publishPending || saving}
            rightPanelTab={rightPanelTab}
            selectedJob={selectedJob}
            setRightPanelTab={setRightPanelTab}
            settingsCollapsed={settingsCollapsed}
            settingsWidth={settingsWidth}
          />
        </div>
      )}
    </main>
  );
}
