'use client';

import { useMemo, useState } from 'react';
import { Braces, Copy, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button, Modal, Field, Textarea } from '@/components/ui';
import { normalizeVariableName } from '@/features/development/lib/variables';
import type { VariableDraft } from '@/features/development/types';
import type { VariableResponse } from '@/shared/api/generated';
import { toast } from 'sonner';

const EMPTY_DRAFT: VariableDraft = {
  name: '',
  value: '',
  description: '',
};

interface VariablesPanelProps {
  currentPlaceholders: string[];
  deleting: boolean;
  isLoading: boolean;
  onCreate: (draft: VariableDraft) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onUpdate: (id: number, draft: VariableDraft) => Promise<void>;
  variables: VariableResponse[];
}

export function VariablesPanel({
  currentPlaceholders,
  deleting,
  isLoading,
  onCreate,
  onDelete,
  onUpdate,
  variables,
}: VariablesPanelProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<VariableDraft>(EMPTY_DRAFT);
  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const unresolved = useMemo(
    () => currentPlaceholders.filter((name) => !variables.some((item) => item.variableName === name)),
    [currentPlaceholders, variables],
  );

  const duplicateName = variables.some(
    (item) => item.id !== editingId && item.variableName === normalizeVariableName(draft.name),
  );

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
  }

  function openCreate() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setModalOpen(true);
  }

  function openEdit(variable: VariableResponse) {
    if (!variable.id) return;
    setEditingId(variable.id);
    setDraft({
      name: variable.variableName ?? '',
      value: variable.variableValue ?? '',
      description: variable.description ?? '',
    });
    setModalOpen(true);
  }

  async function handleSubmit() {
    const normalizedName = normalizeVariableName(draft.name);
    if (!normalizedName || duplicateName) return;

    setSubmitting(true);
    try {
      if (editingId) {
        await onUpdate(editingId, draft);
      } else {
        await onCreate(draft);
      }
      closeModal();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopy(variableName?: string) {
    if (!variableName) return;
    try {
      await navigator.clipboard.writeText(`\${${variableName}}`);
      toast.success(`已复制 \${${variableName}}`);
    } catch {
      toast.error('复制失败');
    }
  }

  return (
    <>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-14 min-w-0 shrink-0 items-center justify-between gap-2 border-b border-border bg-white px-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-foreground">变量</div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">使用 `${'{var_name}'}` 在 SQL 中占位</div>
          </div>
          <Button
            onClick={openCreate}
            variant="secondary"
            size="icon"
            className="h-8 w-8 shrink-0"
            title="新增变量"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-white p-3">
              <div className="mb-3 flex items-center gap-2">
                <div className="rounded-md bg-primary/10 p-1.5 text-primary">
                  <Braces className="h-3.5 w-3.5" />
                </div>
                <div className="text-xs font-bold text-foreground">当前 SQL 引用</div>
              </div>
              {currentPlaceholders.length === 0 ? (
                <div className="text-xs text-muted-foreground">当前 SQL 未使用变量。</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {currentPlaceholders.map((name) => {
                    const resolved = variables.some((item) => item.variableName === name);
                    return (
                      <span
                        key={name}
                        className={`inline-flex items-center rounded-md px-2 py-1 text-[11px] font-semibold ${
                          resolved ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {`\${${name}}`}
                      </span>
                    );
                  })}
                </div>
              )}
              {unresolved.length > 0 ? (
                <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-700">
                  未定义变量：{unresolved.map((name) => `\${${name}}`).join('、')}
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              {isLoading ? (
                <div className="flex items-center justify-center rounded-lg border border-border bg-white px-4 py-8 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : variables.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-zinc-50/80 px-4 py-8 text-center text-xs text-muted-foreground">
                  还没有变量
                </div>
              ) : (
                variables.map((variable) => (
                  <div key={variable.id ?? variable.variableName ?? 'variable'} className="overflow-hidden rounded-lg border border-border bg-white px-3 py-2.5 shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-bold leading-5 text-foreground" title={variable.variableName ?? '-'}>
                          {variable.variableName ?? '-'}
                        </div>
                        <div className="mt-1">
                          <span
                            className="inline-flex max-w-full overflow-hidden rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground"
                            title={`\${${variable.variableName ?? ''}}`}
                          >
                            <span className="truncate">{`\${${variable.variableName ?? ''}}`}</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-0.5">
                        <Button onClick={() => void handleCopy(variable.variableName)} variant="secondary" size="icon" className="h-7 w-7" title="复制占位符">
                          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button onClick={() => openEdit(variable)} variant="secondary" size="icon" className="h-7 w-7" title="编辑">
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button
                          onClick={() => variable.id && void onDelete(variable.id)}
                          disabled={deleting || !variable.id}
                          variant="secondary"
                          size="icon"
                          className="h-7 w-7"
                          title="删除"
                        >
                          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/60" /> : <Trash2 className="h-3.5 w-3.5 text-rose-500" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onOpenChange={(open) => {
          if (!open) closeModal();
        }}
        title={editingId ? '编辑变量' : '新增变量'}
        submitLabel={editingId ? '保存变量' : '创建变量'}
        onSubmit={() => void handleSubmit()}
        disabled={submitting || !normalizeVariableName(draft.name) || duplicateName}
        className="max-w-3xl"
      >
        <div className="space-y-4">
          <Field
            label="变量名"
            placeholder="catalog_name"
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
          />

          <Textarea
            label="变量值"
            placeholder="支持较长文本、JSON 或 SQL 片段"
            value={draft.value}
            onChange={(event) => setDraft((current) => ({ ...current, value: event.target.value }))}
            className="min-h-40"
          />

          <Textarea
            label="说明"
            placeholder="可选，用于解释变量用途"
            value={draft.description}
            onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
            className="min-h-24"
          />

          {duplicateName ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-700">
              变量名已存在，请更换
            </div>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
