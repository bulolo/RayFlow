'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button, Toggle, SectionCard, SectionHeader, SectionRow } from '@/components/ui';
import {
  getGetSystemDefaultsQueryKey,
  type SystemDefaultsRequest,
  useGetSystemDefaults,
  useUpdateSystemDefaults,
} from '@/shared/api/generated';
import { getErrorMessage } from '@/lib/error-message';

const fallbackDefaults: Required<SystemDefaultsRequest> = {
  defaultParallelism: 1,
  failureAlertEnabled: true,
  jobExecutionRetention: 10,
  jobVersionRetention: 5,
  savepointRetention: 5,
};

function normalizeNumber(value: number | undefined, fallback: number) {
  return Number.isFinite(value) && value && value > 0 ? Math.floor(value) : fallback;
}

function toDefaults(source?: SystemDefaultsRequest): Required<SystemDefaultsRequest> {
  return {
    defaultParallelism: normalizeNumber(source?.defaultParallelism, fallbackDefaults.defaultParallelism),
    failureAlertEnabled: source?.failureAlertEnabled ?? fallbackDefaults.failureAlertEnabled,
    jobExecutionRetention: normalizeNumber(source?.jobExecutionRetention, fallbackDefaults.jobExecutionRetention),
    jobVersionRetention: normalizeNumber(source?.jobVersionRetention, fallbackDefaults.jobVersionRetention),
    savepointRetention: normalizeNumber(source?.savepointRetention, fallbackDefaults.savepointRetention),
  };
}

export function DefaultSettings() {
  const queryClient = useQueryClient();
  const defaults = useGetSystemDefaults({ query: { refetchOnWindowFocus: false } });
  const updateDefaults = useUpdateSystemDefaults();
  const [draft, setDraft] = useState<Required<SystemDefaultsRequest> | null>(null);
  const current = draft ?? toDefaults(defaults.data);

  function setNumber(key: keyof Omit<Required<SystemDefaultsRequest>, 'failureAlertEnabled'>, value: string) {
    setDraft((current) => ({
      ...(current ?? toDefaults(defaults.data)),
      [key]: normalizeNumber(Number(value), fallbackDefaults[key]),
    }));
  }

  async function handleSave() {
    try {
      const saved = await updateDefaults.mutateAsync({ data: current });
      setDraft(toDefaults(saved));
      await queryClient.invalidateQueries({ queryKey: getGetSystemDefaultsQueryKey() });
      toast.success('默认设置已保存');
    } catch (error) {
      toast.error(getErrorMessage(error, '保存默认设置失败'));
    }
  }

  const saving = updateDefaults.isPending;
  const loading = defaults.isLoading;

  return (
    <div className="w-full space-y-6">
      <SectionHeader
        action={<Button variant="primary" onClick={() => void handleSave()} disabled={saving || loading}>{saving ? '保存中...' : '保存更改'}</Button>}
        description="配置系统级默认值，影响创建资源和运维流程。"
        title="默认设置"
      />
      <SectionCard title="运行默认值">
        <SectionRow label="默认并行度" description="创建 Flink 作业未显式配置时采用的并行度。">
          <NumberInput value={current.defaultParallelism} onChange={(value) => setNumber('defaultParallelism', value)} disabled={loading || saving} />
        </SectionRow>
        <SectionRow label="Savepoint 保留数量" description="每个作业保留最近的 Savepoint 记录数。">
          <NumberInput value={current.savepointRetention} onChange={(value) => setNumber('savepointRetention', value)} disabled={loading || saving} />
        </SectionRow>
        <SectionRow label="作业版本保留数量" description="每个作业最多保留最近发布的版本快照，超出后自动清理更早版本。">
          <NumberInput value={current.jobVersionRetention} onChange={(value) => setNumber('jobVersionRetention', value)} disabled={loading || saving} />
        </SectionRow>
        <SectionRow label="执行记录保留数量" description="每个作业最多保留最近的运行草稿和运行发布版本记录。">
          <NumberInput value={current.jobExecutionRetention} onChange={(value) => setNumber('jobExecutionRetention', value)} disabled={loading || saving} />
        </SectionRow>
        <SectionRow label="失败自动告警" description="作业失败或运行时不可达时自动发送告警。">
          <Toggle checked={current.failureAlertEnabled} onChange={(checked) => setDraft((current) => ({ ...(current ?? toDefaults(defaults.data)), failureAlertEnabled: checked }))} disabled={loading || saving} />
        </SectionRow>
      </SectionCard>
    </div>
  );
}

function NumberInput({
  disabled,
  onChange,
  value,
}: {
  disabled?: boolean;
  onChange: (value: string) => void;
  value: number;
}) {
  return (
    <input
      className="h-9 w-28 rounded-lg border border-border bg-white px-3 text-right text-sm outline-none transition duration-200 focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
      disabled={disabled}
      min={1}
      onChange={(event) => onChange(event.target.value)}
      type="number"
      value={value}
    />
  );
}
