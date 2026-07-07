'use client';

import { ConfirmModal } from '@/components/ui';
import type { Workflow } from '@/features/scheduler/types';

export function DeleteWorkflowModal({
  open,
  workflow,
  onClose,
  onConfirm,
}: {
  open: boolean;
  workflow: Workflow | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ConfirmModal
      open={open && Boolean(workflow)}
      title="确认删除工作流"
      confirmLabel="确认删除"
      tone="danger"
      onClose={onClose}
      onConfirm={onConfirm}
      description={workflow ? <>确定要删除工作流 <span className="font-bold text-foreground">“{workflow.name}”</span> 吗？此操作不可撤销，且会清除其名下的节点、依赖连线、版本与运行记录。</> : null}
    />
  );
}
