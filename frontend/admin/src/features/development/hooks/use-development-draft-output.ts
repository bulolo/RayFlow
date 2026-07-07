'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  type FlinkJobExecutionResponse,
  type FlinkJobResponse,
  useListFlinkJobExecutions,
} from '@/shared/api/generated';
import {
  buildExecutionOutputText,
  buildFallbackExecutionOutputText,
  isActiveExecutionStatus,
} from '@/features/development/lib/job-executions';
import type { ExtendedFlinkJob } from '@/types/extended';

type DraftRunResult = {
  errorMessage: string | null;
  job: FlinkJobResponse | null;
};

function latestExecutionId(rows: FlinkJobExecutionResponse[] | undefined) {
  return Math.max(0, ...(rows ?? []).map((row) => row.id ?? 0));
}

function findDraftRunExecution(rows: FlinkJobExecutionResponse[] | undefined, executionId: number | null, baselineExecutionId: number) {
  if (!rows?.length) return null;
  if (executionId) {
    return rows.find((row) => row.id === executionId) ?? null;
  }
  return rows.reduce<FlinkJobExecutionResponse | null>((latest, row) => {
    const rowId = row.id ?? 0;
    if (rowId <= baselineExecutionId) return latest;
    if (!latest || rowId > (latest.id ?? 0)) return row;
    return latest;
  }, null);
}

export function useDevelopmentDraftOutput({
  enabled,
  selectedJob,
}: {
  enabled: boolean;
  selectedJob: ExtendedFlinkJob | null;
}) {
  const [executionId, setExecutionId] = useState<number | null>(null);
  const [baselineExecutionId, setBaselineExecutionId] = useState(0);
  const [lookupDeadline, setLookupDeadline] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [fallbackErrorText, setFallbackErrorText] = useState('');

  const executions = useListFlinkJobExecutions(selectedJob?.id ?? 0, {
    query: {
      enabled: enabled && Boolean(selectedJob?.id),
      refetchInterval: (query) => {
        const rows = query.state.data as Array<{ id?: number; status?: string }> | undefined;
        if (!executionId && syncing) {
          const fallback = findDraftRunExecution(rows, null, baselineExecutionId);
          return fallback || Date.now() > lookupDeadline ? false : 1000;
        }
        if (!executionId) return false;
        const row = rows?.find((item) => item.id === executionId);
        return isActiveExecutionStatus(row?.status) ? 3000 : false;
      },
      refetchOnMount: 'always',
    },
  });

  const draftRunExecution = findDraftRunExecution(executions.data, executionId, baselineExecutionId);
  const outputText = draftRunExecution
    ? buildExecutionOutputText(draftRunExecution, selectedJob)
    : fallbackErrorText
      ? buildFallbackExecutionOutputText(fallbackErrorText, selectedJob)
      : '';
  const outputLoading = syncing || Boolean(executionId && !draftRunExecution);

  const reset = useCallback(() => {
    setExecutionId(null);
    setBaselineExecutionId(0);
    setLookupDeadline(0);
    setSyncing(false);
    setFallbackErrorText('');
  }, []);

  const runWithOutput = useCallback(
    async (runDraft: () => Promise<DraftRunResult>) => {
      const nextBaselineExecutionId = latestExecutionId(executions.data);
      setExecutionId(null);
      setBaselineExecutionId(nextBaselineExecutionId);
      setLookupDeadline(Date.now() + 15000);
      setFallbackErrorText('');
      setSyncing(true);
      try {
        const result = await runDraft();
        const nextExecutionId = result.job?.currentExecutionId ?? null;
        setExecutionId(nextExecutionId);
        const refreshed = await executions.refetch();
        const fallbackExecution = findDraftRunExecution(refreshed.data, nextExecutionId, nextBaselineExecutionId);
        setExecutionId(nextExecutionId ?? fallbackExecution?.id ?? null);
        if (!nextExecutionId && !fallbackExecution && result.errorMessage) {
          setFallbackErrorText(result.errorMessage);
        }
      } finally {
        setSyncing(false);
      }
    },
    [executions],
  );

  useEffect(() => {
    if (executionId || !syncing) return;
    const fallbackExecution = findDraftRunExecution(executions.data, null, baselineExecutionId);
    if (!fallbackExecution?.id) return;
    const timer = window.setTimeout(() => {
      setExecutionId(fallbackExecution.id ?? null);
      setFallbackErrorText('');
      setSyncing(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [baselineExecutionId, executionId, executions.data, syncing]);

  return {
    outputLoading,
    outputText,
    reset,
    runWithOutput,
  };
}
