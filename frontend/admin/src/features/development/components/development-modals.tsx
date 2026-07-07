'use client';

import { useMemo } from 'react';
import {
  type FlinkRuntimeResponse,
  type FlinkJobResponse,
  type FlinkJobRequest,
  useListNotificationChannels,
} from '@/shared/api/generated';
import { ConfirmModal, Field, Modal, SelectField } from '@/components/ui';
import type { DevelopmentConfirmDialogState } from '@/features/development/types';
import type { ExtendedFlinkJob } from '@/types/extended';
import { useAuthTokenState } from '@/hooks/use-auth-token-state';

export function DevelopmentModals({
  batchSavepointJobs,
  cancelDeletePending,
  clusterList,
  confirmDialog,
  createGroupOpen,
  createOpen,
  deletePending,
  editGroupName,
  editGroupOpen,
  editGroupParent,
  editingGroupPath,
  groupOptions,
  newGroupName,
  newGroupParent,
  newJob,
  onConfirmDialogOpenChange,
  onConfirmDialogSubmit,
  onCreateGroup,
  onCreateJob,
  onEditGroup,
  onEditGroupNameChange,
  onEditGroupOpenChange,
  onEditGroupParentChange,
  onNewGroupNameChange,
  onNewGroupOpenChange,
  onNewGroupParentChange,
  onNewJobChange,
  onNewJobOpenChange,
  onSavepointCancelChange,
  onSavepointOpenChange,
  onSavepointSubmit,
  onSavepointTargetChange,
  savepointCancel,
  savepointJob,
  savepointTarget,
  submitPending,
  triggerSavepointPending,
  updatePending,
}: {
  batchSavepointJobs: ExtendedFlinkJob[];
  cancelDeletePending: boolean;
  clusterList: FlinkRuntimeResponse[];
  confirmDialog: DevelopmentConfirmDialogState | null;
  createGroupOpen: boolean;
  createOpen: boolean;
  deletePending: boolean;
  editGroupName: string;
  editGroupOpen: boolean;
  editGroupParent: string;
  editingGroupPath: string;
  groupOptions: string[];
  newGroupName: string;
  newGroupParent: string;
  newJob: FlinkJobRequest;
  onConfirmDialogOpenChange: (open: boolean) => void;
  onConfirmDialogSubmit: () => Promise<void>;
  onCreateGroup: () => void;
  onCreateJob: () => void;
  onEditGroup: () => void;
  onEditGroupNameChange: (value: string) => void;
  onEditGroupOpenChange: (open: boolean) => void;
  onEditGroupParentChange: (value: string) => void;
  onNewGroupNameChange: (value: string) => void;
  onNewGroupOpenChange: (open: boolean) => void;
  onNewGroupParentChange: (value: string) => void;
  onNewJobChange: (value: FlinkJobRequest) => void;
  onNewJobOpenChange: (open: boolean) => void;
  onSavepointCancelChange: (checked: boolean) => void;
  onSavepointOpenChange: (open: boolean) => void;
  onSavepointSubmit: () => void;
  onSavepointTargetChange: (value: string) => void;
  savepointCancel: boolean;
  savepointJob: FlinkJobResponse | null;
  savepointTarget: string;
  submitPending: boolean;
  triggerSavepointPending: boolean;
  updatePending: boolean;
}) {
  const hasToken = useAuthTokenState();
  const channels = useListNotificationChannels({ is_pager: 0 }, { query: { enabled: hasToken } });
  const channelOptions = useMemo(
    () => [
      { label: '不启用告警渠道', value: '' },
      ...(channels.data?.list ?? [])
        .filter((channel) => channel.enabled !== false && channel.id)
        .map((channel) => ({
          label: `${channel.name} (${channel.type})`,
          value: String(channel.id),
        })),
    ],
    [channels.data?.list],
  );

  const alertRules = useMemo(
    () => new Set((newJob.alertRule ?? 'FAILED').split(',').map((s) => s.trim()).filter(Boolean)),
    [newJob.alertRule]
  );

  function toggleAlertRule(rule: string) {
    const nextRules = new Set(alertRules);
    if (nextRules.has(rule)) {
      nextRules.delete(rule);
    } else {
      nextRules.add(rule);
    }
    onNewJobChange({ ...newJob, alertRule: Array.from(nextRules).join(',') });
  }

  return (
    <>
      <Modal onOpenChange={onNewJobOpenChange} open={createOpen} submitLabel="创建" title="新建 Flink 作业" onSubmit={onCreateJob} disabled={submitPending}>
        <div className="grid gap-3">
          <Field label="作业名称" placeholder="flink-sql-demo" value={newJob.jobName ?? ''} onChange={(event) => onNewJobChange({ ...newJob, jobName: event.target.value })} />
          <SelectField
            label="所属目录"
            value={newJob.jobGroup || ''}
            onValueChange={(value) => onNewJobChange({ ...newJob, jobGroup: value })}
            options={[{ label: '未分组', value: '' }, ...groupOptions.map((group) => ({ label: group, value: group }))]}
          />
          <Field label="描述" placeholder="说明这个 Flink 作业的用途" value={newJob.description ?? ''} onChange={(event) => onNewJobChange({ ...newJob, description: event.target.value })} />
          <Field label="标签" placeholder="例如：demo,batch,paimon" value={newJob.jobTags ?? ''} onChange={(event) => onNewJobChange({ ...newJob, jobTags: event.target.value })} />
          <Field label="文档链接" placeholder="例如：https://docs.example.com/job-doc" value={newJob.docUrl ?? ''} onChange={(event) => onNewJobChange({ ...newJob, docUrl: event.target.value })} />
          <SelectField
            label="作业类型"
            value={newJob.jobType}
            onValueChange={(value) => onNewJobChange({
              ...newJob,
              jobType: value,
              runtimeMode: value === 'SQL' ? (newJob.runtimeMode || 'STREAMING') : undefined,
            })}
            options={[
              { label: 'SQL', value: 'SQL' },
              { label: 'JAR', value: 'JAR' },
            ]}
          />
          {newJob.jobType === 'SQL' ? (
            <SelectField
              label="运行模式"
              value={newJob.runtimeMode ?? 'STREAMING'}
              onValueChange={(value) => onNewJobChange({ ...newJob, runtimeMode: value })}
              options={[
                { label: '流处理', value: 'STREAMING' },
                { label: '批处理', value: 'BATCH' },
              ]}
            />
          ) : null}
          <SelectField
            label="运行时"
            value={String(newJob.clusterId ?? '')}
            onValueChange={(value) => onNewJobChange({ ...newJob, clusterId: Number(value) || undefined })}
            options={[{ label: '选择运行时', value: '' }, ...clusterList.map((cluster) => ({ label: cluster.clusterName ?? '-', value: String(cluster.id ?? '') }))]}
          />
          <SelectField
            label="告警通知渠道"
            value={String(newJob.alertChannelId ?? '')}
            onValueChange={(value) => {
              const channelId = Number(value) || undefined;
              onNewJobChange({
                ...newJob,
                alertChannelId: channelId,
                alertRule: channelId ? (newJob.alertRule || 'FAILED') : '',
              });
            }}
            options={channelOptions}
          />
          {newJob.alertChannelId ? (
            <div>
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">告警策略</div>
              <div className="flex flex-wrap gap-4 rounded-lg border border-border bg-slate-50/50 p-2.5">
                {[
                  { label: '运行失败', value: 'FAILED' },
                  { label: '作业取消', value: 'CANCELED' },
                  { label: '运行完成', value: 'FINISHED' },
                ].map((item) => (
                  <label key={item.value} className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary/20"
                      checked={alertRules.has(item.value)}
                      onChange={() => toggleAlertRule(item.value)}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal onOpenChange={onEditGroupOpenChange} open={editGroupOpen} submitLabel="保存" title="编辑目录" onSubmit={onEditGroup} disabled={updatePending}>
        <div className="grid gap-3">
          <Field label="目录名称" placeholder="etl" value={editGroupName} onChange={(event) => onEditGroupNameChange(event.target.value)} />
          <SelectField
            label="上级目录"
            value={editGroupParent}
            onValueChange={onEditGroupParentChange}
            options={[{ label: '根目录', value: '' }, ...groupOptions.filter((group) => group !== editingGroupPath && !group.startsWith(`${editingGroupPath}/`)).map((group) => ({ label: group, value: group }))]}
          />
        </div>
      </Modal>

      <Modal onOpenChange={onNewGroupOpenChange} open={createGroupOpen} submitLabel="创建目录" title="新建作业目录" onSubmit={onCreateGroup}>
        <div className="grid gap-3">
          <SelectField label="父目录" value={newGroupParent} onValueChange={onNewGroupParentChange} options={[{ label: '根目录', value: '' }, ...groupOptions.map((group) => ({ label: group, value: group }))]} />
          <Field label="目录名称" placeholder="ods" value={newGroupName} onChange={(event) => onNewGroupNameChange(event.target.value)} />
        </div>
      </Modal>

      <Modal
        onOpenChange={onSavepointOpenChange}
        open={Boolean(savepointJob) || batchSavepointJobs.length > 0}
        submitLabel="触发 Savepoint"
        title={batchSavepointJobs.length ? `批量触发 Savepoint · ${batchSavepointJobs.length} 个作业` : `触发 Savepoint · ${savepointJob?.jobName ?? ''}`}
        onSubmit={onSavepointSubmit}
        disabled={triggerSavepointPending}
      >
        <div className="space-y-4">
          <Field label="Savepoint 保存路径 (目标目录)" placeholder="e.g. hdfs:///flink/savepoints/" value={savepointTarget} onChange={(event) => onSavepointTargetChange(event.target.value)} />
          <label className="mt-2 flex cursor-pointer select-none items-center gap-2">
            <input type="checkbox" className="h-4 w-4 rounded border-zinc-300 text-primary focus:ring-primary/20" checked={savepointCancel} onChange={(event) => onSavepointCancelChange(event.target.checked)} />
            <span className="text-xs font-semibold text-muted-foreground">同时停止作业 (Cancel Job)</span>
          </label>
        </div>
      </Modal>

      <ConfirmModal
        open={Boolean(confirmDialog)}
        title={confirmDialog?.title ?? '确认操作'}
        confirmLabel={confirmDialog?.submitLabel ?? '确认'}
        onClose={() => onConfirmDialogOpenChange(false)}
        onConfirm={() => {
          if (cancelDeletePending || deletePending) return;
          void onConfirmDialogSubmit();
        }}
        description={<p className="text-sm font-medium leading-6 text-muted-foreground">{confirmDialog?.description}</p>}
        tone={(confirmDialog?.submitLabel ?? '').includes('删除') ? 'danger' : 'default'}
      />
    </>
  );
}
