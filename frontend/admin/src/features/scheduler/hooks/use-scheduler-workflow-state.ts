'use client';

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getListSchedulerWorkflowsQueryKey,
  useCreateSchedulerWorkflow,
  useDeleteSchedulerWorkflow,
  useListSchedulerWorkflows,
  useUpdateSchedulerWorkflow,
} from '@/shared/api/generated';
import { toWorkflow, toWorkflowRequest } from '@/features/scheduler/api-adapters';
import { getErrorMessage } from '@/lib/error-message';
import type { Workflow } from '@/features/scheduler/types';

interface UseSchedulerWorkflowStateOptions {
  selectedWorkflow: Workflow | null;
  setSelectedWorkflow: (workflow: Workflow | null) => void;
  showToast: (message: string) => void;
}

export function useSchedulerWorkflowState({
  selectedWorkflow,
  setSelectedWorkflow,
  showToast,
}: UseSchedulerWorkflowStateOptions) {
  const queryClient = useQueryClient();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [newWorkflowDesc, setNewWorkflowDesc] = useState('');
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [workflowKeyword, setWorkflowKeyword] = useState('');
  const [workflowPage, setWorkflowPage] = useState(1);
  const [workflowPageSize, setWorkflowPageSize] = useState(10);
  const [workflowToConfig, setWorkflowToConfig] = useState<Workflow | null>(null);
  const [workflowToDelete, setWorkflowToDelete] = useState<Workflow | null>(null);
  const workflowsQuery = useListSchedulerWorkflows({
    is_pager: 1,
    keyword: workflowKeyword || undefined,
    page: workflowPage,
    size: workflowPageSize,
  });
  const createWorkflowMutation = useCreateSchedulerWorkflow();
  const updateWorkflowMutation = useUpdateSchedulerWorkflow();
  const deleteWorkflowMutation = useDeleteSchedulerWorkflow();

  const workflowsList = useMemo(
    () => (workflowsQuery.data?.list ?? []).map(toWorkflow),
    [workflowsQuery.data?.list],
  );

  const workflowTotal = workflowsQuery.data?.pagination?.total ?? workflowsList.length;
  const workflowPageCount = Math.max(1, workflowsQuery.data?.pagination?.pages ?? 1);
  const workflowRows = workflowsList;

  function invalidateWorkflows() {
    void queryClient.invalidateQueries({ queryKey: getListSchedulerWorkflowsQueryKey() });
  }

  function handleOpenCreateModal() {
    setNewWorkflowName('');
    setNewWorkflowDesc('');
    setCreateModalOpen(true);
  }

  async function handleConfirmCreateWorkflow() {
    if (!newWorkflowName.trim()) {
      showToast('请填写工作流名称');
      return;
    }

    const newWorkflow: Workflow = {
      id: 0,
      name: newWorkflowName.trim(),
      description: newWorkflowDesc.trim(),
      cron: '0 0 12 * * ?',
      period: '每天 12:00',
      status: 'PAUSED',
      latestExecutionStatus: 'UNKNOWN',
      nodeCount: 0,
      lastRunTime: '-',
      nextRunTime: '-',
      executionMode: 'TOPOLOGY',
      failureStrategy: 'BLOCK_ALL',
      concurrentPolicy: 'SERIAL_RUNS',
      variables: [],
    };

    try {
      await createWorkflowMutation.mutateAsync({ data: toWorkflowRequest(newWorkflow) });
      invalidateWorkflows();
      setCreateModalOpen(false);
      showToast('新建工作流成功');
    } catch (error) {
      showToast(getErrorMessage(error, '新建工作流失败'));
    }
  }

  function handleRequestDelete(workflow: Workflow) {
    setWorkflowToDelete(workflow);
    setDeleteConfirmOpen(true);
  }

  async function handleConfirmDeleteWorkflow() {
    if (!workflowToDelete) return;
    try {
      await deleteWorkflowMutation.mutateAsync({ id: workflowToDelete.id });
      invalidateWorkflows();
      if (selectedWorkflow?.id === workflowToDelete.id) {
        setSelectedWorkflow(null);
      }
      setDeleteConfirmOpen(false);
      setWorkflowToDelete(null);
      showToast('工作流已成功删除！');
    } catch (error) {
      showToast(getErrorMessage(error, '删除工作流失败'));
    }
  }

  async function handleToggleWorkflowStatus(workflow: Workflow) {
    const nextStatus = workflow.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      const updated = await updateWorkflowMutation.mutateAsync({
        id: workflow.id,
        data: toWorkflowRequest({ ...workflow, status: nextStatus }),
      });
      invalidateWorkflows();
      if (selectedWorkflow?.id === workflow.id) {
        setSelectedWorkflow({ ...toWorkflow(updated), variables: selectedWorkflow.variables });
      }
      showToast(nextStatus === 'ACTIVE' ? '工作流已启用' : '工作流已暂停');
    } catch (error) {
      showToast(getErrorMessage(error, '切换工作流状态失败'));
    }
  }

  function handleWorkflowSearchChange(value: string) {
    setWorkflowKeyword(value);
    setWorkflowPage(1);
  }

  function handleWorkflowPageSizeChange(size: number) {
    setWorkflowPage(1);
    setWorkflowPageSize(size);
  }

  function handleOpenScheduleConfig(workflow: Workflow) {
    setWorkflowToConfig({ ...workflow });
    setScheduleModalOpen(true);
  }

  async function handleSaveScheduleConfig() {
    if (!workflowToConfig) return;
    try {
      const updated = await updateWorkflowMutation.mutateAsync({
        id: workflowToConfig.id,
        data: toWorkflowRequest(workflowToConfig),
      });
      invalidateWorkflows();
      if (selectedWorkflow?.id === workflowToConfig.id) {
        setSelectedWorkflow({ ...toWorkflow(updated), variables: workflowToConfig.variables });
      }
      setScheduleModalOpen(false);
      showToast('运行配置与变量参数保存成功');
    } catch (error) {
      showToast(getErrorMessage(error, '保存调度配置失败'));
    }
  }

  return {
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
    workflowsLoading: workflowsQuery.isLoading,
    workflowKeyword,
    workflowPage,
    workflowPageCount,
    workflowPageSize,
    workflowRows,
    workflowToConfig,
    workflowToDelete,
    workflowTotal,
    workflowsList,
  };
}
