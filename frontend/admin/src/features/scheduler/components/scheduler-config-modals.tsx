'use client';

import { HelpCircle, ShieldAlert, Sliders, Trash2 } from 'lucide-react';
import { Badge, Button, Modal, Select, Field, Textarea } from '@/components/ui';
import type { NotificationChannelResponse } from '@/shared/api/generated';
import type { Workflow, WorkflowNode } from '@/features/scheduler/types';

const CRON_PRESETS = [
  { cron: '0 0/5 * * * ?', label: '每 5 分钟', period: '每5分钟' },
  { cron: '0 0/15 * * * ?', label: '每 15 分钟', period: '每15分钟' },
  { cron: '0 0 * * * ?', label: '每小时', period: '每小时' },
  { cron: '0 0 1 * * ?', label: '每天 01:00', period: '每天 01:00' },
  { cron: '0 0 9 ? * MON-FRI', label: '工作日 09:00', period: '工作日 09:00' },
  { cron: '0 0 4 1 * ?', label: '每月 1 日 04:00', period: '每月1号 04:00' },
];

function parseCronField(field: string, min: number, max: number, aliases?: Record<string, number>) {
  const normalized = field.trim().toUpperCase();
  if (!normalized || normalized === '*' || normalized === '?') {
    return new Set(Array.from({ length: max - min + 1 }, (_, index) => min + index));
  }

  const values = new Set<number>();
  for (const part of normalized.split(',')) {
    const [rangePart, stepPart] = part.split('/');
    const step = stepPart ? Number(stepPart) : 1;
    if (!Number.isInteger(step) || step < 1) return null;

    const resolve = (value: string) => aliases?.[value] ?? Number(value);
    const [startRaw, endRaw] = rangePart === '*' || rangePart === '?' ? [String(min), String(max)] : rangePart.split('-');
    const start = resolve(startRaw);
    const end = endRaw ? resolve(endRaw) : start;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < min || end > max || start > end) return null;

    for (let value = start; value <= end; value += step) {
      values.add(value);
    }
  }

  return values.size ? values : null;
}

function formatDateTime(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function nextCronRunTimes(cron: string, count = 5) {
  const fields = cron.trim().split(/\s+/).filter(Boolean);
  const parts = fields.length === 5 ? ['0', ...fields] : fields;
  if (parts.length !== 6) return { error: '请输入 5 段或 6 段 Cron 表达式', times: [] as Date[] };

  const [secondField, minuteField, hourField, dayField, monthField, weekField] = parts;
  const seconds = parseCronField(secondField, 0, 59);
  const minutes = parseCronField(minuteField, 0, 59);
  const hours = parseCronField(hourField, 0, 23);
  const days = parseCronField(dayField, 1, 31);
  const months = parseCronField(monthField, 1, 12, {
    APR: 4, AUG: 8, DEC: 12, FEB: 2, JAN: 1, JUL: 7, JUN: 6, MAR: 3, MAY: 5, NOV: 11, OCT: 10, SEP: 9,
  });
  const weeks = parseCronField(weekField, 0, 7, {
    FRI: 5, MON: 1, SAT: 6, SUN: 0, THU: 4, TUE: 2, WED: 3,
  });

  if (!seconds || !minutes || !hours || !days || !months || !weeks) {
    return { error: 'Cron 表达式格式暂不支持', times: [] as Date[] };
  }

  const sortedSeconds = Array.from(seconds).sort((a, b) => a - b);
  const result: Date[] = [];
  const now = new Date();
  const cursor = new Date(now);
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() + 1);

  const maxMinutes = 60 * 24 * 366 * 3;
  for (let index = 0; index < maxMinutes && result.length < count; index += 1) {
    const quartzDay = cursor.getDay() === 0 ? 7 : cursor.getDay();
    const weekMatch = weeks.has(cursor.getDay()) || weeks.has(quartzDay);
    if (months.has(cursor.getMonth() + 1) && days.has(cursor.getDate()) && weekMatch && hours.has(cursor.getHours()) && minutes.has(cursor.getMinutes())) {
      for (const second of sortedSeconds) {
        const candidate = new Date(cursor);
        candidate.setSeconds(second, 0);
        if (candidate > now) result.push(candidate);
        if (result.length >= count) break;
      }
    }
    cursor.setMinutes(cursor.getMinutes() + 1);
  }

  return result.length ? { times: result } : { error: '未来 3 年内没有匹配的运行时间', times: [] as Date[] };
}

export function ScheduleConfigModal({
  open,
  workflow,
  channelsList,
  onWorkflowChange,
  onClose,
  onSave,
}: {
  open: boolean;
  workflow: Workflow | null;
  channelsList: NotificationChannelResponse[];
  onWorkflowChange: (workflow: Workflow) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  if (!open || !workflow) return null;
  const cronPreview = nextCronRunTimes(workflow.cron);

  return (
    <Modal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      title="运行配置与变量设置"
      titleExtra={<Badge tone="neutral" className="text-xs font-bold">Workflow ID: {workflow.id}</Badge>}
      submitLabel="保存配置策略"
      onSubmit={onSave}
      className="max-w-4xl"
      bodyClassName="p-6"
    >
      <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="工作流名称" value={workflow.name} onChange={(event) => onWorkflowChange({ ...workflow, name: event.target.value })} />
            <Field label="周期描述（预留）" value={workflow.period} onChange={(event) => onWorkflowChange({ ...workflow, period: event.target.value })} placeholder="e.g. 每天 01:00" />
          </div>

          <div className="grid grid-cols-2 items-center gap-4">
            <Field label="Cron 表达式（预留）" value={workflow.cron} onChange={(event) => onWorkflowChange({ ...workflow, cron: event.target.value })} className="font-mono font-bold" />
            <div>
              <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">启用状态</span>
              <Select
                value={workflow.status}
                onValueChange={(value) => onWorkflowChange({ ...workflow, status: value as Workflow['status'] })}
                options={[
                  { label: '启用工作流 (ACTIVE)', value: 'ACTIVE' },
                  { label: '暂停工作流 (PAUSED)', value: 'PAUSED' },
                ]}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-semibold text-muted-foreground">快捷选择</span>
            {CRON_PRESETS.map((preset) => (
              <button
                key={preset.cron}
                type="button"
                onClick={() => onWorkflowChange({ ...workflow, cron: preset.cron, period: preset.period })}
                className={`h-7 rounded-md border px-2.5 text-xs font-semibold transition-colors ${
                  workflow.cron === preset.cron ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border bg-white text-slate-500 hover:border-primary/30 hover:text-primary'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-border-subtle bg-slate-50/70 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-foreground">Cron 预览时间</span>
              <span className="font-mono text-[11px] font-semibold text-slate-400">{workflow.cron || '-'}</span>
            </div>
            {cronPreview.error ? (
              <div className="text-xs font-medium text-rose-600">{cronPreview.error}</div>
            ) : (
              <div className="grid gap-1.5 sm:grid-cols-2">
                {cronPreview.times.map((time, index) => (
                  <div key={time.getTime()} className="flex items-center gap-2 rounded-md bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-border-subtle">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/8 text-[10px] font-bold text-primary">{index + 1}</span>
                    <span className="font-mono">{formatDateTime(time)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-2 border-t border-border-subtle pt-4">
            <span className="mb-3 flex items-center gap-1.5 text-xs font-bold text-foreground">
              <ShieldAlert className="h-4 w-4 text-primary" />
              工作流控制与容错策略
            </span>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="mb-1.5 flex cursor-help items-center gap-1 text-xs font-semibold text-muted-foreground" title="重复提交同一工作流时，如何处理两个相同的运行实例">
                  并发运行策略
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
                </span>
                <Select
                  value={workflow.concurrentPolicy}
                  onValueChange={(value) => onWorkflowChange({ ...workflow, concurrentPolicy: value as Workflow['concurrentPolicy'] })}
                  options={[
                    { label: '禁止并发 (排队等待上一个结束)', value: 'SERIAL_RUNS' },
                    { label: '允许并发 (多个实例同时运行)', value: 'CONCURRENT' },
                  ]}
                />
              </div>

              <div>
                <span className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-muted-foreground">执行拓扑模式</span>
                <Select
                  value={workflow.executionMode}
                  onValueChange={(value) => onWorkflowChange({ ...workflow, executionMode: value as Workflow['executionMode'] })}
                  options={[
                    { label: '拓扑模式 (满足依赖的节点并行起)', value: 'TOPOLOGY' },
                    { label: '强串行模式 (按节点ID绝对依次执行)', value: 'SERIAL_QUEUE' },
                  ]}
                />
              </div>
            </div>

            <div className="mt-3">
              <span className="mb-1.5 flex cursor-help items-center gap-1 text-xs font-semibold text-muted-foreground" title="若前置有任务运行失败，后续任务如何流转">
                全局上游失败策略
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
              </span>
              <Select
                value={workflow.failureStrategy}
                onValueChange={(value) => onWorkflowChange({ ...workflow, failureStrategy: value as Workflow['failureStrategy'] })}
                options={[
                  { label: '强行阻断 (BLOCK_ALL - 默认安全策略)', value: 'BLOCK_ALL' },
                  { label: '忽略失败继续 (CONTINUE_NEXT - 顺延起下一个)', value: 'CONTINUE_NEXT' },
                ]}
              />
            </div>

            <div className="mt-3">
              <span className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-muted-foreground">关联系统告警渠道</span>
              <Select
                value={String(workflow.alertChannelId ?? '')}
                onValueChange={(value) => onWorkflowChange({ ...workflow, alertChannelId: value ? Number(value) : undefined })}
                options={[
                  { label: '-- 不绑定告警渠道 --', value: '' },
                  ...channelsList.map((channel) => ({
                    label: `${channel.name} (${channel.type === 'wecom' ? '企业微信' : channel.type === 'dingtalk' ? '钉钉' : channel.type === 'feishu' ? '飞书' : channel.type === 'inapp' ? '站内信' : 'Webhook'})`,
                    value: String(channel.id ?? ''),
                  })),
                ]}
              />
            </div>
          </div>

          <div className="mt-2 border-t border-border-subtle pt-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Sliders className="h-4 w-4 text-primary" />
                工作流全局上下文参数
              </span>
              <Button
                onClick={() => onWorkflowChange({ ...workflow, variables: [...workflow.variables, { key: `param_${Date.now().toString().slice(-4)}`, value: '' }] })}
                variant="secondary"
                size="sm"
              >
                + 添加参数
              </Button>
            </div>

            {workflow.variables.length === 0 ? (
              <div className="py-2 text-center text-xs italic text-muted-foreground">未定义全局参数，可在下方或 SQL 内部通过 {'${变量名}'} 引用参数。</div>
            ) : (
              <div className="max-h-[120px] space-y-2 overflow-y-auto pr-1">
                {workflow.variables.map((variable, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={variable.key}
                      onChange={(event) => {
                        const variables = [...workflow.variables];
                        variables[index].key = event.target.value;
                        onWorkflowChange({ ...workflow, variables });
                      }}
                      placeholder="键名 (e.g. dt)"
                      className="h-8 flex-1 rounded-lg border border-border bg-white px-2 text-xs font-bold text-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10"
                    />
                    <span className="text-xs text-muted-foreground/60">=</span>
                    <input
                      type="text"
                      value={variable.value}
                      onChange={(event) => {
                        const variables = [...workflow.variables];
                        variables[index].value = event.target.value;
                        onWorkflowChange({ ...workflow, variables });
                      }}
                      placeholder="键值 (e.g. ${yyyy-MM-dd})"
                      className="h-8 flex-1 rounded-lg border border-border bg-white px-2 text-xs text-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10"
                    />
                    <button
                      onClick={() => onWorkflowChange({ ...workflow, variables: workflow.variables.filter((_, currentIndex) => currentIndex !== index) })}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground/60 transition-colors hover:bg-rose-50/50 hover:text-rose-500"
                      title="删除参数"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        <Textarea label="工作流描述" value={workflow.description} onChange={(event) => onWorkflowChange({ ...workflow, description: event.target.value })} rows={2} />
      </div>
    </Modal>
  );
}

export function NodeConfigModal({
  node,
  onClose,
  onNodeChange,
  onSave,
  open,
}: {
  node: WorkflowNode | null;
  onClose: () => void;
  onNodeChange: (node: WorkflowNode) => void;
  onSave: () => void;
  open: boolean;
}) {
  if (!open || !node) return null;

  return (
    <Modal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      title="节点运行策略配置"
      titleExtra={<Badge tone="info" className="text-xs font-bold">节点 ID: {node.id}</Badge>}
      submitLabel="保存配置"
      onSubmit={onSave}
      className="max-w-md"
      bodyClassName="p-6"
    >
      <div className="space-y-4">
          <Field label="原子作业名称" value={node.jobName} disabled />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">最大容错重试次数</span>
              <Select
                value={String(node.maxRetries)}
                onValueChange={(value) => onNodeChange({ ...node, maxRetries: Number(value) })}
                options={[
                  { label: '0 次 (失败不重试)', value: '0' },
                  { label: '1 次', value: '1' },
                  { label: '3 次 (推荐策略)', value: '3' },
                  { label: '5 次', value: '5' },
                ]}
              />
            </div>
            <Field label="重试间隔时长 (秒)" type="number" value={node.retryInterval} onChange={(event) => onNodeChange({ ...node, retryInterval: Number(event.target.value) })} min={10} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="超时判定时间 (分钟)" type="number" value={node.timeoutMinutes} onChange={(event) => onNodeChange({ ...node, timeoutMinutes: Number(event.target.value) })} placeholder="0 代表不限" min={0} />
            <div>
              <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">超时处理策略</span>
              <Select
                value={node.onTimeout}
                onValueChange={(value) => onNodeChange({ ...node, onTimeout: value as WorkflowNode['onTimeout'] })}
                options={[
                  { label: '仅警报通知 (ALARM)', value: 'ALARM_ONLY' },
                  { label: '警报并自动强杀 (KILL)', value: 'KILL_AND_ALARM' },
                ]}
              />
            </div>
          </div>
      </div>
    </Modal>
  );
}

export function CreateWorkflowModal({
  description,
  name,
  onClose,
  onConfirm,
  onDescriptionChange,
  onNameChange,
  open,
}: {
  description: string;
  name: string;
  onClose: (open: boolean) => void;
  onConfirm: () => void;
  onDescriptionChange: (value: string) => void;
  onNameChange: (value: string) => void;
  open: boolean;
}) {
  return (
    <Modal open={open} onOpenChange={onClose} title="新建调度工作流" submitLabel="创建" onSubmit={onConfirm}>
      <div className="space-y-4">
        <Field label="工作流名称" placeholder="例如：user_log_analysis_workflow" value={name} onChange={(event) => onNameChange(event.target.value)} />
        <Textarea label="描述说明" placeholder="请输入此数据调度工作流的具体业务背景和上下游职责..." value={description} onChange={(event) => onDescriptionChange(event.target.value)} />
      </div>
    </Modal>
  );
}
