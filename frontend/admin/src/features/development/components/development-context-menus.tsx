'use client';

import { Folder, FolderPlus, Plus, Trash2 } from 'lucide-react';
import type {
  DevelopmentGroupContextMenuState,
  DevelopmentJobContextMenuState,
} from '@/features/development/types';
import { DEFAULT_JOB_GROUP } from '@/features/development/lib/job-groups';

export function DevelopmentContextMenus({
  groupContextMenu,
  jobContextMenu,
  onContextDelete,
  onCreateJobInGroup,
  onCreateSubGroup,
  onDeleteGroup,
  onOpenEditGroup,
}: {
  groupContextMenu: DevelopmentGroupContextMenuState | null;
  jobContextMenu: DevelopmentJobContextMenuState | null;
  onContextDelete: () => void;
  onCreateJobInGroup: () => void;
  onCreateSubGroup: () => void;
  onDeleteGroup: () => void;
  onOpenEditGroup: () => void;
}) {
  return (
    <>
      {jobContextMenu ? (
        <div
          className="fixed z-[60] w-44 overflow-hidden rounded-lg border border-border-subtle bg-white p-1.5 shadow-[var(--shadow-card-hover)]"
          style={{ left: jobContextMenu.x, top: jobContextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={onContextDelete}
            disabled={jobContextMenu.job.status === 'RUNNING'}
            className="flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
          >
            <Trash2 className="h-3.5 w-3.5" />
            删除作业
          </button>
          {jobContextMenu.job.status === 'RUNNING' ? (
            <div className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-400">运行中作业需先停止</div>
          ) : null}
        </div>
      ) : null}

      {groupContextMenu ? (
        <div
          className="fixed z-[60] w-44 overflow-hidden rounded-lg border border-border-subtle bg-white p-1.5 shadow-[var(--shadow-card-hover)]"
          style={{ left: groupContextMenu.x, top: groupContextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={onCreateSubGroup}
            className="flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-xs font-bold text-foreground transition hover:bg-zinc-50"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            新建目录
          </button>
          <button
            type="button"
            onClick={onCreateJobInGroup}
            className="flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-xs font-bold text-foreground transition hover:bg-zinc-50"
          >
            <Plus className="h-3.5 w-3.5" />
            新建作业
          </button>
          <button
            type="button"
            onClick={onOpenEditGroup}
            className="flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-xs font-bold text-foreground transition hover:bg-zinc-50"
          >
            <Folder className="h-3.5 w-3.5" />
            编辑目录
          </button>
          <button
            type="button"
            onClick={onDeleteGroup}
            disabled={groupContextMenu.group === DEFAULT_JOB_GROUP}
            className="mt-1 flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-muted-foreground/30 disabled:hover:bg-transparent"
          >
            <Trash2 className="h-3.5 w-3.5" />
            删除目录
          </button>
          {groupContextMenu.rows.length > 0 && groupContextMenu.group !== DEFAULT_JOB_GROUP ? (
            <div className="px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground">目录内作业会一起删除</div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
