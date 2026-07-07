import { ChevronDown, ChevronRight, Folder } from 'lucide-react';
import { JobTreeItem } from '@/features/development/components/job-tree-item';
import { collectGroupRows, type GroupTreeNode } from '@/features/development/lib/job-groups';
import type { ExtendedFlinkJob } from '@/types/extended';

type JobGroupNodeProps = {
  collapsedGroups: Record<string, boolean>;
  dragOverGroupKey: string | null;
  draggingJobId: number | null;
  draggingGroupKey: string | null;
  level?: number;
  node: GroupTreeNode;
  onDragLeaveGroup: (group: string) => void;
  onDragOverGroup: (group: string) => void;
  onDragEnd: () => void;
  onGroupDragEnd: () => void;
  onGroupDragStart: (event: React.DragEvent, group: string) => void;
  onDragStart: (event: React.DragEvent, job: ExtendedFlinkJob) => void;
  onDrop: (event: React.DragEvent, group: string) => void;
  onGroupContextMenu: (event: React.MouseEvent, group: string, rows: ExtendedFlinkJob[]) => void;
  onJobContextMenu: (event: React.MouseEvent, job: ExtendedFlinkJob) => void;
  onJobSelect: (job: ExtendedFlinkJob) => void;
  onToggle: (key: string) => void;
  selectedJobId?: number;
};

export function JobGroupNode({
  collapsedGroups,
  dragOverGroupKey,
  draggingJobId,
  draggingGroupKey,
  level = 0,
  node,
  onDragLeaveGroup,
  onDragOverGroup,
  onDragEnd,
  onGroupDragEnd,
  onGroupDragStart,
  onDragStart,
  onDrop,
  onGroupContextMenu,
  onJobContextMenu,
  onJobSelect,
  onToggle,
  selectedJobId,
}: JobGroupNodeProps) {
  const collapsed = collapsedGroups[node.key];
  const canExpand = node.children.length > 0 || node.rows.length > 0;
  const isDropTarget = dragOverGroupKey === node.key;
  const isDraggingGroup = draggingGroupKey === node.key;

  return (
    <div
      className={`mb-1 rounded-lg transition ${isDropTarget ? 'bg-primary/5 ring-1 ring-primary/25' : ''}`}
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onDragOverGroup(node.key);
      }}
      onDragLeave={(event) => {
        event.stopPropagation();
        const related = event.relatedTarget as Node | null;
        if (!related || !event.currentTarget.contains(related)) {
          onDragLeaveGroup(node.key);
        }
      }}
      onDrop={(event) => onDrop(event, node.key)}
    >
      <button
        type="button"
        draggable
        onClick={() => canExpand && onToggle(node.key)}
        onContextMenu={(event) => onGroupContextMenu(event, node.key, collectGroupRows(node))}
        onDragStart={(event) => onGroupDragStart(event, node.key)}
        onDragEnd={onGroupDragEnd}
        className={`mb-1 flex h-7 w-full min-w-0 items-center justify-between overflow-hidden rounded-md pr-2 text-left text-xs font-semibold transition ${
          isDropTarget
            ? 'bg-white text-primary ring-1 ring-primary/20'
            : isDraggingGroup
              ? 'bg-white text-primary ring-1 ring-primary/10 opacity-70'
              : draggingJobId
                ? 'bg-white text-primary/80'
                : 'text-muted-foreground hover:bg-white hover:text-foreground'
        }`}
        style={{ paddingLeft: `${8 + level * 14}px` }}
      >
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          {canExpand ? (
            collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <span className="h-3.5 w-3.5" />
          )}
          <Folder className="h-3.5 w-3.5" />
          <span className="min-w-0 truncate">{node.label}</span>
        </span>
        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{node.total}</span>
      </button>
      {!collapsed && (
        <div className="space-y-1">
          {node.children.map((child) => (
            <JobGroupNode
              key={child.key}
              collapsedGroups={collapsedGroups}
              dragOverGroupKey={dragOverGroupKey}
              draggingJobId={draggingJobId}
              draggingGroupKey={draggingGroupKey}
              level={level + 1}
              node={child}
              onDragLeaveGroup={onDragLeaveGroup}
              onDragOverGroup={onDragOverGroup}
              onDragEnd={onDragEnd}
              onGroupDragEnd={onGroupDragEnd}
              onGroupDragStart={onGroupDragStart}
              onDragStart={onDragStart}
              onDrop={onDrop}
              onGroupContextMenu={onGroupContextMenu}
              onJobContextMenu={onJobContextMenu}
              onJobSelect={onJobSelect}
              onToggle={onToggle}
              selectedJobId={selectedJobId}
            />
          ))}
          {node.rows.map((job) => (
            <JobTreeItem
              key={job.id ?? job.jobName}
              active={job.id === selectedJobId}
              job={job}
              level={level + 1}
              onContextMenu={onJobContextMenu}
              onDragEnd={onDragEnd}
              onDragStart={onDragStart}
              onSelect={onJobSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
