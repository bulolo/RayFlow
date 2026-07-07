'use client';

import { useState, type Dispatch, type SetStateAction } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getListFlinkJobVersionsQueryKey,
  getListFlinkSavepointsQueryKey,
  type FlinkJobResponse,
  type FlinkJobRequest,
  type FlinkJobVersionRequest,
  type FlinkJobVersionResponse,
} from '@/shared/api/generated';
import type { DevelopmentConfirmDialogState } from '@/features/development/types';
import { defaultSql, emptyJobForm } from '@/features/development/lib/job-forms';
import { getErrorMessage } from '@/lib/error-message';
import type { ExtendedFlinkJob } from '@/types/extended';

type MutationWithId = {
  mutateAsync: (input: { id: number }) => Promise<unknown>;
};

type UpdateJobMutation = {
  mutateAsync: (input: { data: FlinkJobRequest; id: number }) => Promise<unknown>;
};

type CreateJobMutation = {
  isPending: boolean;
  mutateAsync: (input: { data: FlinkJobRequest }) => Promise<FlinkJobResponse>;
};

type StartJobMutation = {
  mutateAsync: (input: { id: number }) => Promise<FlinkJobResponse>;
};

type DebugJobMutation = {
  mutateAsync: (input: { id: number }) => Promise<FlinkJobResponse>;
};

type PublishJobMutation = {
  isPending: boolean;
  mutateAsync: (input: { data?: FlinkJobVersionRequest; id: number }) => Promise<FlinkJobVersionResponse>;
};

type DeleteJobMutation = {
  isPending: boolean;
  mutateAsync: (input: { id: number }) => Promise<unknown>;
};

type TriggerSavepointMutation = {
  isPending: boolean;
  mutateAsync: (input: {
    data: {
      cancelJob: boolean;
      targetDirectory?: string;
    };
    id: number;
  }) => Promise<unknown>;
};

type OperatingJobAction = 'run' | 'debug' | 'publish' | 'cancel' | 'savepoint' | 'delete' | boolean;

type DeleteJobOptions = {
  notify?: boolean;
  refetch?: boolean;
};

interface UseDevelopmentJobActionsOptions {
  cancelJob: MutationWithId & { isPending: boolean };
  deleteJob: DeleteJobMutation;
  draft: FlinkJobRequest;
  firstClusterId?: number;
  jobsRefetch: () => Promise<unknown>;
  onAfterDelete?: (job: FlinkJobResponse) => void;
  selectedJob: ExtendedFlinkJob | null;
  selectedJobId: number | null;
  setConfirmDialog: Dispatch<SetStateAction<DevelopmentConfirmDialogState | null>>;
  setSelectedJobId: (value: number | null) => void;
  setSelectedOpsJobIds: Dispatch<SetStateAction<number[]>>;
  startJob: StartJobMutation;
  debugJob: DebugJobMutation;
  publishJob: PublishJobMutation;
  createJob: CreateJobMutation;
  triggerSavepoint: TriggerSavepointMutation;
  updateJob: UpdateJobMutation & { isPending: boolean };
}

function withOperatingFlag(
  setOperatingJobIds: Dispatch<SetStateAction<Record<number, OperatingJobAction>>>,
  jobIds: number[],
  value: Exclude<OperatingJobAction, boolean>,
) {
  setOperatingJobIds((prev) => {
    const next = { ...prev };
    for (const jobId of jobIds) {
      next[jobId] = value;
    }
    return next;
  });
}

function clearOperatingFlag(
  setOperatingJobIds: Dispatch<SetStateAction<Record<number, OperatingJobAction>>>,
  jobIds: number[],
) {
  setOperatingJobIds((prev) => {
    const next = { ...prev };
    for (const jobId of jobIds) {
      delete next[jobId];
    }
    return next;
  });
}

export function useDevelopmentJobActions({
  cancelJob,
  deleteJob,
  draft,
  firstClusterId,
  jobsRefetch,
  onAfterDelete,
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
}: UseDevelopmentJobActionsOptions) {
  const queryClient = useQueryClient();
  const [batchSavepointJobs, setBatchSavepointJobs] = useState<ExtendedFlinkJob[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [newJob, setNewJob] = useState<FlinkJobRequest>(emptyJobForm());
  const [operatingJobIds, setOperatingJobIds] = useState<Record<number, OperatingJobAction>>({});
  const [savepointCancel, setSavepointCancel] = useState(false);
  const [savepointJob, setSavepointJob] = useState<FlinkJobResponse | null>(null);
  const [savepointTarget, setSavepointTarget] = useState('');

  async function deleteJobImmediately(job: FlinkJobResponse, options: DeleteJobOptions = {}) {
    if (!job.id) return;
    const { notify = true, refetch = true } = options;
    withOperatingFlag(setOperatingJobIds, [job.id], 'delete');
    try {
      await deleteJob.mutateAsync({ id: job.id });
      if (refetch) await jobsRefetch();
      if (selectedJobId === job.id) setSelectedJobId(null);
      onAfterDelete?.(job);
      if (notify) toast.success(`作业「${job.jobName ?? job.id}」已删除`);
    } finally {
      clearOperatingFlag(setOperatingJobIds, [job.id]);
    }
  }

  function openCreateJob(group = '') {
    const clusterId = firstClusterId ? Number(firstClusterId) : undefined;
    setNewJob({
      ...emptyJobForm(clusterId),
      clusterId,
      content: defaultSql,
      jobGroup: group,
    });
    setCreateOpen(true);
  }

  async function handleCreate() {
    if (!newJob.jobName?.trim()) {
      toast.error('作业名称不能为空');
      return;
    }
    if (!newJob.clusterId) {
      toast.error('请选择运行时');
      return;
    }
    try {
      const created = await createJob.mutateAsync({ data: newJob });
      await jobsRefetch();
      if (created.id) setSelectedJobId(created.id);
      setCreateOpen(false);
      toast.success(`作业「${newJob.jobName}」已创建`);
    } catch (error) {
      toast.error(getErrorMessage(error, '创建作业失败'));
    }
  }

  async function handleSave() {
    if (!selectedJob?.id) {
      toast.error('请先选择作业');
      return false;
    }
    if (!draft.jobName?.trim()) {
      toast.error('作业名称不能为空');
      return false;
    }
    try {
      await updateJob.mutateAsync({ id: selectedJob.id, data: draft });
      await jobsRefetch();
      toast.success(`作业「${draft.jobName}」已保存`);
      return true;
    } catch (error) {
      toast.error(getErrorMessage(error, '保存作业失败'));
      return false;
    }
  }

  async function handleRun() {
    if (!selectedJob?.id) return { errorMessage: '请先选择作业', job: null };
    const saved = await handleSave();
    if (!saved) return { errorMessage: '保存作业失败', job: null };
    try {
      const runningJob = await debugJob.mutateAsync({ id: selectedJob.id });
      await jobsRefetch();
      toast.success(`作业「${draft.jobName}」已运行草稿`);
      return { errorMessage: null, job: runningJob };
    } catch (error) {
      const errorMessage = getErrorMessage(error, '运行草稿失败');
      await jobsRefetch();
      toast.error(errorMessage);
      return { errorMessage, job: null };
    }
  }

  async function handlePublish(remark?: string) {
    if (!selectedJob?.id) {
      toast.error('请先选择作业');
      return;
    }
    const saved = await handleSave();
    if (!saved) return;
    try {
      const normalizedRemark = typeof remark === 'string' ? remark.trim() : '';
      const version = await publishJob.mutateAsync({
        id: selectedJob.id,
        data: { remark: normalizedRemark || undefined },
      });
      await queryClient.invalidateQueries({ queryKey: getListFlinkJobVersionsQueryKey(selectedJob.id) });
      await queryClient.refetchQueries({ exact: true, queryKey: getListFlinkJobVersionsQueryKey(selectedJob.id) });
      await jobsRefetch();
      toast.success(`作业「${draft.jobName || selectedJob.jobName || selectedJob.id}」已发布 ${version.versionName ?? ''}`.trim());
    } catch (error) {
      toast.error(getErrorMessage(error, '发布作业版本失败'));
    }
  }

  async function handleRunJob(job: FlinkJobResponse) {
    if (!job.id) return;
    withOperatingFlag(setOperatingJobIds, [job.id], 'run');
    try {
      await startJob.mutateAsync({ id: job.id });
      await jobsRefetch();
      toast.success(`作业「${job.jobName ?? job.id}」已运行发布版本`);
    } catch (error) {
      await jobsRefetch();
      toast.error(getErrorMessage(error, '运行发布版本失败'));
    } finally {
      clearOperatingFlag(setOperatingJobIds, [job.id]);
    }
  }

  async function handlePublishJob(job: FlinkJobResponse) {
    if (!job.id) return;
    withOperatingFlag(setOperatingJobIds, [job.id], 'publish');
    try {
      const version = await publishJob.mutateAsync({ id: job.id, data: undefined });
      await queryClient.invalidateQueries({ queryKey: getListFlinkJobVersionsQueryKey(job.id) });
      await queryClient.refetchQueries({ exact: true, queryKey: getListFlinkJobVersionsQueryKey(job.id) });
      await jobsRefetch();
      toast.success(`作业「${job.jobName ?? job.id}」已发布 ${version.versionName ?? ''}`.trim());
    } catch (error) {
      toast.error(getErrorMessage(error, '发布作业版本失败'));
    } finally {
      clearOperatingFlag(setOperatingJobIds, [job.id]);
    }
  }

  async function handleBatchRunJobs(rows: ExtendedFlinkJob[]) {
    const runnable = rows.filter((job) => job.id && job.status !== 'RUNNING' && job.publishStatus === 'PUBLISHED');
    if (!runnable.length) return;
    try {
      await Promise.all(runnable.map((job) => startJob.mutateAsync({ id: job.id! })));
      setSelectedOpsJobIds([]);
      await jobsRefetch();
      toast.success(`已运行 ${runnable.length} 个发布版本`);
    } catch (error) {
      toast.error(getErrorMessage(error, '批量运行发布版本失败'));
    }
  }

  async function handleDelete(job: FlinkJobResponse) {
    if (!job.id) return;
    setConfirmDialog({
      title: '删除 Flink 作业',
      description: `确认删除 Flink 作业「${job.jobName ?? job.id}」？此操作只删除 RayFlow 内的作业配置。`,
      submitLabel: '删除作业',
      onConfirm: async () => {
        try {
          await deleteJobImmediately(job);
          setConfirmDialog(null);
        } catch (error) {
          toast.error(getErrorMessage(error, '删除作业失败'));
        }
      },
    });
  }

  async function handleCancel() {
    if (!selectedJob?.id) return;
    setConfirmDialog({
      title: '停止 Flink 作业',
      description: `确认停止并取消运行 Flink 作业「${selectedJob.jobName}」？`,
      submitLabel: '停止作业',
      onConfirm: async () => {
        try {
          await cancelJob.mutateAsync({ id: selectedJob.id! });
          await jobsRefetch();
          toast.success(`作业「${selectedJob.jobName}」已取消`);
          setConfirmDialog(null);
        } catch (error) {
          toast.error(getErrorMessage(error, '停止作业失败，请确认 Flink Job ID 已配置且运行时在线'));
        }
      },
    });
  }

  async function handleCancelJob(job: FlinkJobResponse) {
    if (!job.id) return;
    setConfirmDialog({
      title: '停止 Flink 作业',
      description: `确认停止并取消运行 Flink 作业「${job.jobName ?? job.id}」？`,
      submitLabel: '停止作业',
      onConfirm: async () => {
        withOperatingFlag(setOperatingJobIds, [job.id!], 'cancel');
        try {
          await cancelJob.mutateAsync({ id: job.id! });
          await jobsRefetch();
          toast.success(`作业「${job.jobName ?? job.id}」已取消`);
          setConfirmDialog(null);
        } catch (error) {
          toast.error(getErrorMessage(error, '停止作业失败，请确认 Flink Job ID 已配置且运行时在线'));
        } finally {
          clearOperatingFlag(setOperatingJobIds, [job.id!]);
        }
      },
    });
  }

  function handleBatchCancelJobs(rows: ExtendedFlinkJob[]) {
    const runningRows = rows.filter((job) => job.id && job.status === 'RUNNING');
    if (!runningRows.length) return;
    setConfirmDialog({
      title: '批量取消作业',
      description: `确认取消 ${runningRows.length} 个运行中的作业？`,
      submitLabel: '确认取消',
      onConfirm: async () => {
        await Promise.all(runningRows.map((job) => cancelJob.mutateAsync({ id: job.id! })));
        setSelectedOpsJobIds([]);
        await jobsRefetch();
        toast.success(`已取消 ${runningRows.length} 个作业`);
      },
    });
  }

  function openBatchSavepoint(rows: ExtendedFlinkJob[]) {
    const runningRows = rows.filter((job) => job.id && job.status === 'RUNNING');
    if (!runningRows.length) return;
    setBatchSavepointJobs(runningRows);
    setSavepointJob(null);
    setSavepointTarget('');
    setSavepointCancel(false);
  }

  function openJobSavepoint(job: FlinkJobResponse) {
    setBatchSavepointJobs([]);
    setSavepointJob(job);
  }

  function closeSavepointDialog() {
    setSavepointJob(null);
    setBatchSavepointJobs([]);
  }

  async function handleTriggerSavepoint() {
    const targetJobs = (batchSavepointJobs.length ? batchSavepointJobs : savepointJob ? [savepointJob] : []).filter(
      (job): job is FlinkJobResponse & { id: number } => Boolean(job.id),
    );
    if (!targetJobs.length) return;
    withOperatingFlag(
      setOperatingJobIds,
      targetJobs.map((job) => job.id),
      'savepoint',
    );
    try {
      await Promise.all(
        targetJobs.map((job) =>
          triggerSavepoint.mutateAsync({
            id: job.id,
            data: {
              targetDirectory: savepointTarget.trim() || undefined,
              cancelJob: savepointCancel,
            },
          }),
        ),
      );
      closeSavepointDialog();
      setSelectedOpsJobIds([]);
      setSavepointTarget('');
      setSavepointCancel(false);
      await Promise.all(targetJobs.map((job) => queryClient.invalidateQueries({ queryKey: getListFlinkSavepointsQueryKey(job.id) })));
      await jobsRefetch();
      toast.success(targetJobs.length > 1 ? `已触发 ${targetJobs.length} 个 Savepoint` : 'Savepoint 触发成功');
    } catch (error) {
      toast.error(getErrorMessage(error, '触发 Savepoint 失败'));
    } finally {
      clearOperatingFlag(
        setOperatingJobIds,
        targetJobs.map((job) => job.id),
      );
    }
  }

  function handleEditJob(job: FlinkJobResponse, onViewModeChange: (mode: 'develop') => void) {
    if (job.id) setSelectedJobId(job.id);
    onViewModeChange('develop');
  }

  return {
    batchSavepointJobs,
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
    closeSavepointDialog,
    submitPending: createJob.isPending,
    publishPending: publishJob.isPending,
    triggerSavepointPending: triggerSavepoint.isPending,
    updatePending: updateJob.isPending,
  };
}
