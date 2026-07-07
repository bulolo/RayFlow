'use client';

import { FolderPlus, Plus, RefreshCw, Search } from 'lucide-react';
import { Button, Tooltip } from '@/components/ui';
import { JobGroupNode } from '@/features/development/components/job-group-node';
import { JobTreeItem } from '@/features/development/components/job-tree-item';
import type { GroupTreeNode } from '@/features/development/lib/job-groups';
import type { ExtendedFlinkJob } from '@/types/extended';

const treeSkeletonRows = Array.from({ length: 8 });

interface DevelopmentJobSidebarProps {
  collapsedGroups: Record<string, boolean>;
  dragOverGroupKey: string | null;
  dragOverRoot: boolean;
  draggingGroupKey: string | null;
  draggingJobId: number | null;
  groupTree: GroupTreeNode[];
  isRefreshing: boolean;
  jobSearch: string;
  loading: boolean;
  onCreateGroup: () => void;
  onCreateJob: () => void;
  onDragLeaveGroup: (groupKey: string) => void;
  onDragOverGroup: (groupKey: string) => void;
  onDragStartGroup: (event: React.DragEvent, groupKey: string) => void;
  onDropGroup: (event: React.DragEvent, groupKey: string) => void;
  onDropRoot: (event: React.DragEvent) => void;
  onGroupContextMenu: (event: React.MouseEvent, group: string, rows: ExtendedFlinkJob[]) => void;
  onJobContextMenu: (event: React.MouseEvent, job: ExtendedFlinkJob) => void;
  onJobSearchChange: (value: string) => void;
  onRefresh: () => void;
  onRootDragOver: () => void;
  onRootDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
  onSelectJob: (job: ExtendedFlinkJob) => void;
  onToggleGroup: (key: string) => void;
  selectedJobId?: number;
  setDraggingGroupKey: (value: string | null) => void;
  setDraggingJobId: (value: number | null) => void;
  setDragOverGroupKey: (value: string | null | ((prev: string | null) => string | null)) => void;
  setDragOverRoot: (value: boolean) => void;
  ungroupedJobs: ExtendedFlinkJob[];
}

export function DevelopmentJobSidebar({
  collapsedGroups,
  dragOverGroupKey,
  dragOverRoot,
  draggingGroupKey,
  draggingJobId,
  groupTree,
  isRefreshing,
  jobSearch,
  loading,
  onCreateGroup,
  onCreateJob,
  onDragLeaveGroup,
  onDragOverGroup,
  onDragStartGroup,
  onDropGroup,
  onDropRoot,
  onGroupContextMenu,
  onJobContextMenu,
  onJobSearchChange,
  onRefresh,
  onRootDragOver,
  onRootDragLeave,
  onSelectJob,
  onToggleGroup,
  selectedJobId,
  setDraggingGroupKey,
  setDraggingJobId,
  setDragOverGroupKey,
  setDragOverRoot,
  ungroupedJobs,
}: DevelopmentJobSidebarProps) {
  const isEmpty = groupTree.length === 0 && ungroupedJobs.length === 0;

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <div className="flex h-14 min-w-0 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3">
        <div className="flex h-9 min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-slate-200 bg-zinc-50/80 px-2.5">
          <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <input
            value={jobSearch}
            onChange={(event) => onJobSearchChange(event.target.value)}
            placeholder="搜索作业..."
            className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-slate-400"
          />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Tooltip content="刷新">
            <Button
              onClick={onRefresh}
              className="h-8 w-8 shrink-0 rounded-lg border border-slate-200 bg-white p-0 text-slate-650 shadow-sm transition-all hover:bg-slate-50 active:scale-95"
              aria-label="刷新"
              disabled={loading || isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </Tooltip>
          <Tooltip content="新建目录">
            <Button
              onClick={onCreateGroup}
              className="h-8 w-8 shrink-0 rounded-lg border border-slate-200 bg-white p-0 text-slate-650 shadow-sm transition-all hover:bg-slate-50 active:scale-95"
              aria-label="新建目录"
            >
              <FolderPlus className="h-4 w-4" />
            </Button>
          </Tooltip>
          <Tooltip content="新建作业">
            <Button
              onClick={onCreateJob}
              className="h-8 w-8 shrink-0 rounded-lg border border-slate-200 bg-white p-0 text-slate-650 shadow-sm transition-all hover:bg-slate-50 active:scale-95"
              aria-label="新建作业"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </Tooltip>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="space-y-2 p-1.5" aria-label="作业列表加载中">
            <div className="mb-3 h-9 animate-pulse rounded-lg border border-dashed border-slate-200 bg-slate-50" />
            {treeSkeletonRows.map((_, index) => (
              <div
                key={index}
                className="flex h-10 animate-pulse items-center gap-2 rounded-lg bg-white px-3"
                style={{ marginLeft: index > 2 && index < 6 ? 16 : 0 }}
              >
                <div className="h-4 w-4 shrink-0 rounded bg-slate-200" />
                <div className="h-3 flex-1 rounded bg-slate-100" />
                <div className="h-3 w-10 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : isEmpty ? (
          <div className="flex h-48 animate-in flex-col items-center justify-center p-4 text-center text-slate-400 fade-in-50 duration-200 select-none">
            <Search className="mb-2 h-6 w-6 stroke-[1.5] text-slate-300" />
            <span className="text-xs font-semibold">未找到匹配作业</span>
            <span className="mt-1 text-[10px] text-slate-400">请尝试更换搜索词，或新建作业</span>
          </div>
        ) : (
          <>
            <div
              className={`mb-3 rounded-lg border border-dashed px-3 py-2 text-xs font-semibold transition ${
                dragOverRoot
                  ? 'border-primary bg-primary/5 text-primary'
                  : draggingJobId || draggingGroupKey
                    ? 'border-slate-300 bg-white text-slate-500'
                    : 'border-slate-200 bg-zinc-50/70 text-slate-400'
              }`}
              onDragOver={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onRootDragOver();
              }}
              onDragLeave={onRootDragLeave}
              onDrop={onDropRoot}
            >
              根目录
            </div>
            {ungroupedJobs.length > 0 ? (
              <div className="mb-3 space-y-1">
                {ungroupedJobs.map((job) => (
                  <JobTreeItem
                    key={job.id ?? job.jobName}
                    active={job.id === selectedJobId}
                    job={job}
                    level={0}
                    onContextMenu={onJobContextMenu}
                    onDragEnd={() => {
                      setDraggingJobId(null);
                      setDragOverRoot(false);
                    }}
                    onDragStart={(event, targetJob) => {
                      if (!targetJob.id) return;
                      setDraggingJobId(targetJob.id);
                      setDragOverGroupKey(null);
                      setDragOverRoot(false);
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', String(targetJob.id));
                    }}
                    onSelect={onSelectJob}
                  />
                ))}
              </div>
            ) : null}
            {groupTree.map((group) => (
              <JobGroupNode
                key={group.key}
                collapsedGroups={collapsedGroups}
                dragOverGroupKey={dragOverGroupKey}
                draggingJobId={draggingJobId}
                draggingGroupKey={draggingGroupKey}
                node={group}
                selectedJobId={selectedJobId}
                onDragLeaveGroup={onDragLeaveGroup}
                onDragOverGroup={onDragOverGroup}
                onGroupDragEnd={() => {
                  setDraggingGroupKey(null);
                  setDragOverGroupKey(null);
                  setDragOverRoot(false);
                }}
                onGroupDragStart={(event, groupKey) => {
                  onDragStartGroup(event, groupKey);
                }}
                onDrop={onDropGroup}
                onJobContextMenu={onJobContextMenu}
                onJobSelect={onSelectJob}
                onGroupContextMenu={onGroupContextMenu}
                onToggle={onToggleGroup}
                onDragEnd={() => setDraggingJobId(null)}
                onDragStart={(event, job) => {
                  if (!job.id) return;
                  setDraggingJobId(job.id);
                  setDragOverGroupKey(null);
                  setDragOverRoot(false);
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', String(job.id));
                }}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
