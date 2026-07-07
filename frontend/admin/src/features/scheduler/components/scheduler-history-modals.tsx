'use client';

import { Badge, Button, Modal, Textarea } from '@/components/ui';
import type { VersionSnapshot, Workflow } from '@/features/scheduler/types';

export function HistoryVersionsModal({
  open,
  workflow,
  versions,
  onRollback,
  onClose,
}: {
  open: boolean;
  workflow: Workflow | null;
  versions: VersionSnapshot[];
  onRollback: (snapshot: VersionSnapshot) => void;
  onClose: () => void;
}) {
  if (!open || !workflow) return null;

  return (
    <Modal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      title="工作流历史版本快照"
      titleExtra={<span className="truncate rounded-md border border-border-subtle bg-slate-50 px-2 py-1 text-xs font-bold text-slate-500">{workflow.name}</span>}
      cancelLabel="关闭"
      showSubmit={false}
      className="max-w-lg"
      bodyClassName="p-6"
    >
      <div className="max-h-[320px] space-y-3 overflow-y-auto pr-1">
          {versions.length === 0 ? (
            <div className="py-8 text-center text-xs italic text-muted-foreground">暂无历史保存的版本快照记录</div>
          ) : (
            versions.map((snapshot, index) => (
              <div key={index} className="flex items-center justify-between gap-4 rounded-lg border border-border-subtle bg-zinc-50/50 p-3 transition-all hover:bg-white">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge tone="info" className="text-xs font-bold">{snapshot.version}</Badge>
                    <span className="text-xs font-semibold text-muted-foreground">{snapshot.time}</span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-foreground">{snapshot.remark}</p>
                  <span className="mt-1 block text-[11px] font-medium text-muted-foreground">包含节点数: {snapshot.nodes.length} 个 | 连线数: {snapshot.edges.length} 条</span>
                </div>
                <Button onClick={() => onRollback(snapshot)} variant="secondary" size="sm" className="shrink-0">
                  回滚此版本
                </Button>
              </div>
            ))
          )}
      </div>
    </Modal>
  );
}

export function SaveVersionModal({
  open,
  versionRemark,
  onRemarkChange,
  onClose,
  onConfirm,
}: {
  open: boolean;
  versionRemark: string;
  onRemarkChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <Modal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      title="保存新版本快照"
      submitLabel="保存并创建版本"
      onSubmit={onConfirm}
      className="max-w-sm"
      bodyClassName="p-6"
    >
      <div className="space-y-4">
        <p className="text-xs leading-relaxed text-muted-foreground">
          本次保存将生成新的快照节点记录，请输入备注以记录本次工作流拓扑的修改背景。
        </p>
        <Textarea
          label="版本修改备注"
          value={versionRemark}
          onChange={(event) => onRemarkChange(event.target.value)}
          placeholder="例如：添加了支付流水明细层作业，配置了容错重试"
          rows={2}
        />
      </div>
    </Modal>
  );
}
