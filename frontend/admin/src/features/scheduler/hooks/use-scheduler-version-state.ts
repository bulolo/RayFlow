'use client';

import { useState } from 'react';
import {
  getListSchedulerWorkflowVersionsQueryKey,
  getListSchedulerWorkflowsQueryKey,
  useListSchedulerWorkflowVersions,
  usePublishSchedulerWorkflow,
} from '@/shared/api/generated';
import { useQueryClient } from '@tanstack/react-query';
import { toVersionSnapshot } from '@/features/scheduler/api-adapters';
import type { VersionSnapshot, Workflow, WorkflowEdge, WorkflowNode } from '@/features/scheduler/types';

interface UseSchedulerVersionStateOptions {
  designerEdges: WorkflowEdge[];
  designerNodes: WorkflowNode[];
  selectedWorkflow: Workflow | null;
  setSelectedWorkflow: (workflow: Workflow | null) => void;
  showToast: (message: string) => void;
}

export function useSchedulerVersionState({
  designerEdges,
  designerNodes,
  selectedWorkflow,
  setSelectedWorkflow,
  showToast,
}: UseSchedulerVersionStateOptions) {
  const queryClient = useQueryClient();
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [saveRemarkModalOpen, setSaveRemarkModalOpen] = useState(false);
  const [versionRemark, setVersionRemark] = useState('');
  const versionsQuery = useListSchedulerWorkflowVersions(selectedWorkflow?.id ?? 0, {
    query: { enabled: Boolean(selectedWorkflow?.id) },
  });
  const publishMutation = usePublishSchedulerWorkflow();

  const workflowVersions: Record<number, VersionSnapshot[]> = selectedWorkflow?.id
    ? { [selectedWorkflow.id]: (versionsQuery.data ?? []).map(toVersionSnapshot) }
    : {};

  function handleSaveClick() {
    setVersionRemark('');
    setSaveRemarkModalOpen(true);
  }

  async function handleConfirmSaveVersion() {
    if (!selectedWorkflow) return;
    if (designerNodes.length === 0) {
      showToast('请先添加至少一个作业节点');
      return;
    }
    try {
      const version = await publishMutation.mutateAsync({
        id: selectedWorkflow.id,
        data: { remark: versionRemark.trim() || `发布编排版本（${designerNodes.length} 个节点，${designerEdges.length} 条依赖）` },
      });
      void queryClient.invalidateQueries({ queryKey: getListSchedulerWorkflowVersionsQueryKey(selectedWorkflow.id) });
      void queryClient.invalidateQueries({ queryKey: getListSchedulerWorkflowsQueryKey() });
      setSelectedWorkflow({ ...selectedWorkflow, nodeCount: designerNodes.length });
      setSaveRemarkModalOpen(false);
      showToast(`版本 ${version.versionName ?? ''} 发布成功`);
    } catch {
      showToast('发布版本失败，请先保存 DAG 并检查依赖');
    }
  }

  return {
    handleConfirmSaveVersion,
    handleSaveClick,
    historyModalOpen,
    saveRemarkModalOpen,
    setHistoryModalOpen,
    setSaveRemarkModalOpen,
    setVersionRemark,
    versionRemark,
    workflowVersions,
  };
}
