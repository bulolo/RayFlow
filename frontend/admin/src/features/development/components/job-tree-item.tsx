import { FileCode2 } from 'lucide-react';
import type { ExtendedFlinkJob } from '@/types/extended';

type JobTreeItemProps = {
  active: boolean;
  job: ExtendedFlinkJob;
  level: number;
  onContextMenu: (event: React.MouseEvent, job: ExtendedFlinkJob) => void;
  onDragEnd: () => void;
  onDragStart: (event: React.DragEvent, job: ExtendedFlinkJob) => void;
  onSelect: (job: ExtendedFlinkJob) => void;
};

export function JobTreeItem({
  active,
  job,
  level,
  onContextMenu,
  onDragEnd,
  onDragStart,
  onSelect,
}: JobTreeItemProps) {
  const statusMeta = getJobStatusMeta(job.status);

  return (
    <button
      type="button"
      draggable={Boolean(job.id)}
      onClick={() => onSelect(job)}
      onContextMenu={(event) => onContextMenu(event, job)}
      onDragStart={(event) => onDragStart(event, job)}
      onDragEnd={onDragEnd}
      title={job.description || job.jobName || ''}
      className={`group flex w-full min-w-0 items-start gap-2 overflow-hidden rounded-lg border py-1.5 pr-3 text-left transition ${
        active ? 'border-primary bg-primary text-white shadow-sm' : 'border-border-subtle bg-white hover:border-primary/20 hover:shadow-sm'
      }`}
      style={{ paddingLeft: `${12 + level * 14}px` }}
    >
      <FileCode2 className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${active ? 'text-white' : 'text-primary'}`} />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center justify-between gap-2">
          <span className="block min-w-0 flex-1 truncate text-[12px] font-bold leading-5">{job.jobName || '-'}</span>
          <span className={`inline-flex max-w-[4.5rem] shrink-0 items-center gap-1.5 truncate text-[10px] font-semibold ${active ? 'text-white/80' : 'text-muted-foreground'}`}>
            <span className="truncate">{job.jobType}</span>
            <span
              className={`h-1.5 w-1.5 rounded-full ${active ? statusMeta.activeDotClass : statusMeta.dotClass}`}
              title={statusMeta.label}
            />
          </span>
        </span>
        <span className={`block truncate text-[10px] leading-4 ${active ? 'text-white/75' : 'text-muted-foreground'}`}>
          {job.description || '暂无描述'}
        </span>
      </span>
    </button>
  );
}

function getJobStatusMeta(status?: string) {
  if (status === 'RUNNING') {
    return {
      label: '运行中',
      dotClass: 'bg-emerald-500',
      activeDotClass: 'bg-white',
    };
  }

  if (status === 'FAILED' || status === 'ERROR') {
    return {
      label: '失败',
      dotClass: 'bg-rose-500',
      activeDotClass: 'bg-white',
    };
  }

  if (status === 'FINISHED') {
    return {
      label: '已完成',
      dotClass: 'bg-sky-500',
      activeDotClass: 'bg-white',
    };
  }

  if (status === 'CANCELED' || status === 'STOPPED') {
    return {
      label: '已停止',
      dotClass: 'bg-zinc-400',
      activeDotClass: 'bg-white/90',
    };
  }

  if (status === 'CREATED' || status === 'PENDING') {
    return {
      label: '未启动',
      dotClass: 'bg-amber-500',
      activeDotClass: 'bg-white',
    };
  }

  return {
    label: status || '未知状态',
    dotClass: 'bg-zinc-300',
    activeDotClass: 'bg-white/80',
  };
}
