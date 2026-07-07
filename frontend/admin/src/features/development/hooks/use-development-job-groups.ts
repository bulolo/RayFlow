'use client';

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { toast } from 'sonner';
import type { FlinkJobRequest } from '@/shared/api/generated';
import type {
  DevelopmentConfirmDialogState,
  DevelopmentGroupContextMenuState,
  DevelopmentJobContextMenuState,
} from '@/features/development/types';
import { formFromJob } from '@/features/development/lib/job-forms';
import {
  CUSTOM_GROUPS_KEY,
  DEFAULT_JOB_GROUP,
  groupPathChain,
  normalizeGroupPath,
} from '@/features/development/lib/job-groups';
import { getErrorMessage } from '@/lib/error-message';
import type { ExtendedFlinkJob } from '@/types/extended';

type UpdateJobInput = {
  data: FlinkJobRequest;
  id: number;
};

interface UseDevelopmentJobGroupsOptions {
  confirmDialog: DevelopmentConfirmDialogState | null;
  currentJobs: ExtendedFlinkJob[];
  firstClusterId?: number;
  groupKeys: string[];
  jobsRefetch: () => Promise<unknown>;
  deleteJobImmediately: (job: ExtendedFlinkJob, options?: { notify?: boolean; refetch?: boolean }) => Promise<void>;
  onDeleteJob: (job: ExtendedFlinkJob) => Promise<void>;
  onOpenCreateJob: (group?: string) => void;
  selectedJobId: number | null;
  setConfirmDialog: Dispatch<SetStateAction<DevelopmentConfirmDialogState | null>>;
  setSelectedJobId: (value: number | null) => void;
  setJobGroupOverrides: Dispatch<SetStateAction<Record<number, string>>>;
  updateJob: {
    mutateAsync: (input: UpdateJobInput) => Promise<unknown>;
  };
}

function remapGroupPath(value: string | undefined, sourceGroup: string, targetGroup: string) {
  const normalized = normalizeGroupPath(value);
  if (!normalized) return normalized;
  if (normalized === sourceGroup) return targetGroup;
  if (normalized.startsWith(`${sourceGroup}/`)) {
    return `${targetGroup}${normalized.slice(sourceGroup.length)}`;
  }
  return normalized;
}

function loadStoredCustomGroups() {
  if (typeof window === 'undefined') return [];
  try {
    const stored = JSON.parse(window.localStorage.getItem(CUSTOM_GROUPS_KEY) || '[]');
    if (!Array.isArray(stored)) return [];
    return stored.filter((item): item is string => typeof item === 'string').map(normalizeGroupPath).filter(Boolean);
  } catch {
    return [];
  }
}

export function useDevelopmentJobGroups({
  confirmDialog,
  currentJobs,
  firstClusterId,
  groupKeys,
  jobsRefetch,
  deleteJobImmediately,
  onDeleteJob,
  onOpenCreateJob,
  selectedJobId,
  setConfirmDialog,
  setSelectedJobId,
  setJobGroupOverrides,
  updateJob,
}: UseDevelopmentJobGroupsOptions) {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [customGroups, setCustomGroups] = useState<string[]>(loadStoredCustomGroups);
  const [draggingGroupKey, setDraggingGroupKey] = useState<string | null>(null);
  const [draggingJobId, setDraggingJobId] = useState<number | null>(null);
  const [dragOverGroupKey, setDragOverGroupKey] = useState<string | null>(null);
  const [dragOverRoot, setDragOverRoot] = useState(false);
  const [groupContextMenu, setGroupContextMenu] = useState<DevelopmentGroupContextMenuState | null>(null);
  const [jobContextMenu, setJobContextMenu] = useState<DevelopmentJobContextMenuState | null>(null);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupParent, setNewGroupParent] = useState('');
  const [editGroupOpen, setEditGroupOpen] = useState(false);
  const [editingGroupPath, setEditingGroupPath] = useState('');
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupParent, setEditGroupParent] = useState('');
  useEffect(() => {
    if (!jobContextMenu && !groupContextMenu) return;
    const closeAllMenus = () => {
      setJobContextMenu(null);
      setGroupContextMenu(null);
    };
    window.addEventListener('click', closeAllMenus);
    window.addEventListener('scroll', closeAllMenus, true);
    return () => {
      window.removeEventListener('click', closeAllMenus);
      window.removeEventListener('scroll', closeAllMenus, true);
    };
  }, [groupContextMenu, jobContextMenu]);

  function persistCustomGroups(groups: string[]) {
    setCustomGroups(groups);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(CUSTOM_GROUPS_KEY, JSON.stringify(groups));
    }
  }

  function resetDragState() {
    setDraggingJobId(null);
    setDraggingGroupKey(null);
    setDragOverGroupKey(null);
    setDragOverRoot(false);
  }

  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function openCreateGroup(parentGroup = '') {
    setNewGroupName('');
    setNewGroupParent(parentGroup);
    setCreateGroupOpen(true);
  }

  function openJobContextMenu(event: React.MouseEvent, job: ExtendedFlinkJob) {
    event.preventDefault();
    setGroupContextMenu(null);
    if (job.id) setSelectedJobId(job.id);
    setJobContextMenu({
      job,
      x: event.clientX,
      y: event.clientY,
    });
  }

  function openGroupContextMenu(event: React.MouseEvent, group: string, rows: ExtendedFlinkJob[]) {
    event.preventDefault();
    setJobContextMenu(null);
    setGroupContextMenu({
      group,
      rows,
      x: event.clientX,
      y: event.clientY,
    });
  }

  function handleCreateJobInGroup() {
    if (!groupContextMenu) return;
    const targetGroup = normalizeGroupPath(groupContextMenu.group);
    setGroupContextMenu(null);
    onOpenCreateJob(targetGroup);
  }

  function handleCreateSubGroup() {
    if (!groupContextMenu) return;
    const targetGroup = normalizeGroupPath(groupContextMenu.group);
    setGroupContextMenu(null);
    openCreateGroup(targetGroup);
  }

  function handleOpenEditGroup() {
    if (!groupContextMenu) return;
    const sourceGroup = normalizeGroupPath(groupContextMenu.group);
    const segments = sourceGroup.split('/');
    const currentName = segments.pop() ?? sourceGroup;
    setEditingGroupPath(sourceGroup);
    setEditGroupName(currentName);
    setEditGroupParent(segments.join('/'));
    setGroupContextMenu(null);
    setEditGroupOpen(true);
  }

  function handleCreateGroup() {
    const groupName = normalizeGroupPath(newGroupName);
    if (!groupName) {
      toast.error('目录名称不能为空');
      return;
    }
    if (groupName.includes('/')) {
      toast.error('目录名称不能包含 /，请通过父目录创建子目录');
      return;
    }

    const parentGroup = normalizeGroupPath(newGroupParent);
    const fullGroupName = parentGroup ? `${parentGroup}/${groupName}` : groupName;
    if (fullGroupName === DEFAULT_JOB_GROUP) {
      toast.error('该目录名称为系统保留名称');
      return;
    }
    if (customGroups.includes(fullGroupName) || groupKeys.includes(fullGroupName)) {
      toast.error('目录已存在');
      return;
    }

    const nextGroups = Array.from(new Set([...customGroups, parentGroup, fullGroupName].filter(Boolean))).sort((a, b) =>
      a.localeCompare(b),
    );
    persistCustomGroups(nextGroups);
    setCollapsedGroups((prev) => {
      const next = { ...prev };
      for (const key of groupPathChain(fullGroupName)) {
        next[key] = false;
      }
      return next;
    });
    setNewGroupName('');
    setNewGroupParent('');
    setCreateGroupOpen(false);
  }

  async function moveJobToGroup(job: ExtendedFlinkJob, group: string) {
    if (!job.id) return;
    const nextGroup = group === DEFAULT_JOB_GROUP ? '' : group;
    if ((job.jobGroup ?? '') === nextGroup) {
      resetDragState();
      return;
    }

    try {
      const jobId = job.id;
      await updateJob.mutateAsync({
        id: jobId,
        data: {
          ...formFromJob(job, firstClusterId),
          jobGroup: nextGroup,
        },
      });
      setJobGroupOverrides((prev) => ({ ...prev, [jobId]: nextGroup }));
      await jobsRefetch();
      toast.success(`作业「${job.jobName}」已移动到「${nextGroup || '根目录'}」`);
    } catch (error) {
      toast.error(getErrorMessage(error, '移动作业失败'));
    } finally {
      resetDragState();
    }
  }

  async function moveGroupToGroup(sourceGroup: string, targetGroup: string) {
    const normalizedSource = normalizeGroupPath(sourceGroup);
    const normalizedTarget = normalizeGroupPath(targetGroup);
    if (!normalizedSource || !normalizedTarget || normalizedSource === normalizedTarget) {
      resetDragState();
      return;
    }
    if (normalizedTarget.startsWith(`${normalizedSource}/`)) {
      toast.error('不能将目录移动到自己的子目录中');
      resetDragState();
      return;
    }

    const groupName = normalizedSource.split('/').pop() ?? normalizedSource;
    const destinationRoot = `${normalizedTarget}/${groupName}`;
    const allGroups = new Set([...groupKeys, ...customGroups]);
    const hasConflict = Array.from(allGroups).some((group) => {
      if (group === normalizedSource || group === normalizedTarget) return false;
      if (group.startsWith(`${normalizedSource}/`)) return false;
      return group === destinationRoot || group.startsWith(`${destinationRoot}/`);
    });
    if (hasConflict || currentJobs.some((job) => normalizeGroupPath(job.jobGroup) === destinationRoot)) {
      toast.error('目标目录下已存在同名目录');
      resetDragState();
      return;
    }

    const affectedJobs = currentJobs.filter((job) => {
      const group = normalizeGroupPath(job.jobGroup);
      return group === normalizedSource || group.startsWith(`${normalizedSource}/`);
    });

    try {
      await Promise.all(
        affectedJobs
          .filter((job) => job.id)
          .map((job) =>
            updateJob.mutateAsync({
              id: job.id!,
              data: {
                ...formFromJob(job, firstClusterId),
                jobGroup: remapGroupPath(job.jobGroup, normalizedSource, destinationRoot),
              },
            }),
          ),
      );

      setJobGroupOverrides((prev) => {
        const next = { ...prev };
        for (const job of affectedJobs) {
          if (!job.id) continue;
          next[job.id] = remapGroupPath(job.jobGroup, normalizedSource, destinationRoot);
        }
        return next;
      });

      persistCustomGroups(
        Array.from(
          new Set(customGroups.map((group) => remapGroupPath(group, normalizedSource, destinationRoot)).filter(Boolean)),
        ).sort((a, b) => a.localeCompare(b)),
      );

      setCollapsedGroups((prev) => {
        const next: Record<string, boolean> = {};
        for (const [key, value] of Object.entries(prev)) {
          const remapped = remapGroupPath(key, normalizedSource, destinationRoot);
          if (remapped) next[remapped] = value;
        }
        next[normalizedTarget] = false;
        next[destinationRoot] = false;
        return next;
      });

      await jobsRefetch();
      toast.success(`目录「${groupName}」已移动到「${normalizedTarget}」`);
    } catch (error) {
      toast.error(getErrorMessage(error, '移动目录失败'));
    } finally {
      resetDragState();
    }
  }

  async function moveGroupToRoot(sourceGroup: string) {
    const normalizedSource = normalizeGroupPath(sourceGroup);
    if (!normalizedSource || !normalizedSource.includes('/')) {
      resetDragState();
      return;
    }

    const destinationRoot = normalizedSource.split('/').pop() ?? normalizedSource;
    const allGroups = new Set([...groupKeys, ...customGroups]);
    const hasConflict = Array.from(allGroups).some((group) => {
      if (group === normalizedSource || group.startsWith(`${normalizedSource}/`)) return false;
      return group === destinationRoot || group.startsWith(`${destinationRoot}/`);
    });
    if (hasConflict) {
      toast.error('根目录已存在同名目录');
      resetDragState();
      return;
    }

    const affectedJobs = currentJobs.filter((job) => {
      const group = normalizeGroupPath(job.jobGroup);
      return group === normalizedSource || group.startsWith(`${normalizedSource}/`);
    });

    try {
      await Promise.all(
        affectedJobs
          .filter((job) => job.id)
          .map((job) =>
            updateJob.mutateAsync({
              id: job.id!,
              data: {
                ...formFromJob(job, firstClusterId),
                jobGroup: remapGroupPath(job.jobGroup, normalizedSource, destinationRoot),
              },
            }),
          ),
      );

      setJobGroupOverrides((prev) => {
        const next = { ...prev };
        for (const job of affectedJobs) {
          if (!job.id) continue;
          next[job.id] = remapGroupPath(job.jobGroup, normalizedSource, destinationRoot);
        }
        return next;
      });

      persistCustomGroups(
        Array.from(
          new Set(customGroups.map((group) => remapGroupPath(group, normalizedSource, destinationRoot)).filter(Boolean)),
        ).sort((a, b) => a.localeCompare(b)),
      );

      setCollapsedGroups((prev) => {
        const next: Record<string, boolean> = {};
        for (const [key, value] of Object.entries(prev)) {
          const remapped = remapGroupPath(key, normalizedSource, destinationRoot);
          if (remapped) next[remapped] = value;
        }
        next[destinationRoot] = false;
        return next;
      });

      await jobsRefetch();
      toast.success(`目录「${destinationRoot}」已移动到根目录`);
    } catch (error) {
      toast.error(getErrorMessage(error, '移动目录失败'));
    } finally {
      resetDragState();
    }
  }

  async function handleEditGroup() {
    const sourceGroup = normalizeGroupPath(editingGroupPath);
    const nextGroupName = normalizeGroupPath(editGroupName);
    if (!sourceGroup) {
      toast.error('未找到要编辑的目录');
      return;
    }
    if (!nextGroupName) {
      toast.error('目录名称不能为空');
      return;
    }
    if (nextGroupName.includes('/')) {
      toast.error('目录名称不能包含 /，请通过上级目录调整层级');
      return;
    }

    const nextParentGroup = normalizeGroupPath(editGroupParent);
    if (nextParentGroup === sourceGroup || nextParentGroup.startsWith(`${sourceGroup}/`)) {
      toast.error('不能将目录移动到自己或自己的子目录中');
      return;
    }

    const targetGroup = nextParentGroup ? `${nextParentGroup}/${nextGroupName}` : nextGroupName;
    if (targetGroup === DEFAULT_JOB_GROUP) {
      toast.error('该目录名称为系统保留名称');
      return;
    }
    if (targetGroup === sourceGroup) {
      setEditGroupOpen(false);
      return;
    }

    const allGroups = new Set([...groupKeys, ...customGroups]);
    const hasConflict = Array.from(allGroups).some((group) => {
      if (group === sourceGroup || group.startsWith(`${sourceGroup}/`)) return false;
      return group === targetGroup || group.startsWith(`${targetGroup}/`);
    });
    if (hasConflict) {
      toast.error('目标位置已存在同名目录');
      return;
    }

    const affectedJobs = currentJobs.filter((job) => {
      const group = normalizeGroupPath(job.jobGroup);
      return group === sourceGroup || group.startsWith(`${sourceGroup}/`);
    });

    try {
      await Promise.all(
        affectedJobs
          .filter((job) => job.id)
          .map((job) =>
            updateJob.mutateAsync({
              id: job.id!,
              data: {
                ...formFromJob(job, firstClusterId),
                jobGroup: remapGroupPath(job.jobGroup, sourceGroup, targetGroup),
              },
            }),
          ),
      );

      setJobGroupOverrides((prev) => {
        const next = { ...prev };
        for (const job of affectedJobs) {
          if (!job.id) continue;
          next[job.id] = remapGroupPath(job.jobGroup, sourceGroup, targetGroup);
        }
        return next;
      });

      persistCustomGroups(
        Array.from(
          new Set(customGroups.map((group) => remapGroupPath(group, sourceGroup, targetGroup)).filter(Boolean)),
        ).sort((a, b) => a.localeCompare(b)),
      );

      setCollapsedGroups((prev) => {
        const next: Record<string, boolean> = {};
        for (const [key, value] of Object.entries(prev)) {
          const remapped = remapGroupPath(key, sourceGroup, targetGroup);
          if (remapped) next[remapped] = value;
        }
        for (const key of groupPathChain(targetGroup)) {
          next[key] = false;
        }
        return next;
      });

      setEditGroupOpen(false);
      setEditingGroupPath('');
      setEditGroupName('');
      setEditGroupParent('');
      await jobsRefetch();
      toast.success('目录已更新');
    } catch (error) {
      toast.error(getErrorMessage(error, '更新目录失败'));
    }
  }

  function handleGroupDrop(event: React.DragEvent, group: string) {
    event.preventDefault();
    event.stopPropagation();
    const groupKey = event.dataTransfer.getData('application/x-rayflow-group');
    if (groupKey || draggingGroupKey) {
      void moveGroupToGroup(groupKey || draggingGroupKey || '', group);
      return;
    }
    const jobId = Number(event.dataTransfer.getData('text/plain') || draggingJobId);
    const job = currentJobs.find((item) => item.id === jobId);
    if (!job) {
      resetDragState();
      return;
    }
    void moveJobToGroup(job, group);
  }

  function handleRootDrop(event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    const groupKey = event.dataTransfer.getData('application/x-rayflow-group');
    if (groupKey || draggingGroupKey) {
      void moveGroupToRoot(groupKey || draggingGroupKey || '');
      return;
    }
    const jobId = Number(event.dataTransfer.getData('text/plain') || draggingJobId);
    const job = currentJobs.find((item) => item.id === jobId);
    if (!job) {
      resetDragState();
      return;
    }
    void moveJobToGroup(job, '');
  }

  function handleContextDelete() {
    if (!jobContextMenu) return;
    const { job } = jobContextMenu;
    setJobContextMenu(null);
    if (job.status === 'RUNNING') {
      toast.error('运行中的作业请先停止后再删除');
      return;
    }
    void onDeleteJob(job);
  }

  function handleDeleteGroup() {
    if (!groupContextMenu) return;
    const { group, rows } = groupContextMenu;
    setGroupContextMenu(null);
    if (group === DEFAULT_JOB_GROUP) {
      toast.error('未分组目录不能删除');
      return;
    }

    setConfirmDialog({
      title: '删除作业目录',
      description: rows.length
        ? `确认删除目录「${group}」及其子目录？目录内 ${rows.length} 个作业也会一起删除。`
        : `确认删除空目录「${group}」？`,
      submitLabel: '删除目录',
      onConfirm: async () => {
        try {
          const deletableRows = rows.filter((job) => job.id);
          await Promise.all(deletableRows.map((job) => deleteJobImmediately(job, { notify: false, refetch: false })));
          setJobGroupOverrides((prev) => {
            const next = { ...prev };
            for (const job of deletableRows) {
              if (job.id) delete next[job.id];
            }
            return next;
          });
          persistCustomGroups(customGroups.filter((item) => item !== group && !item.startsWith(`${group}/`)));
          setCollapsedGroups((prev) => {
            const next = { ...prev };
            for (const key of Object.keys(next)) {
              if (key === group || key.startsWith(`${group}/`)) delete next[key];
            }
            return next;
          });
          if (selectedJobId && deletableRows.some((job) => job.id === selectedJobId)) {
            setSelectedJobId(null);
          }
          await jobsRefetch();
          toast.success(rows.length ? `目录「${group}」及 ${rows.length} 个作业已删除` : `目录「${group}」已删除`);
          setConfirmDialog(null);
        } catch (error) {
          toast.error(getErrorMessage(error, '删除目录失败'));
        }
      },
    });
  }

  function handleConfirmDialogOpenChange(open: boolean) {
    if (!open) setConfirmDialog(null);
  }

  async function handleConfirmSubmit() {
    if (!confirmDialog) return;
    await confirmDialog.onConfirm();
  }

  function handleEditGroupOpenChange(open: boolean) {
    setEditGroupOpen(open);
    if (open) return;
    setEditingGroupPath('');
    setEditGroupName('');
    setEditGroupParent('');
  }

  return {
    collapsedGroups,
    confirmDialog,
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
  };
}
