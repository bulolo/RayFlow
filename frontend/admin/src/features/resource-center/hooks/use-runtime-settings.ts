'use client';

import { useState, type FormEvent } from 'react';
import {
  type FlinkRuntimeResponse,
  type FlinkRuntimeRequest,
  useCreateFlinkRuntime,
  useListFlinkRuntimes,
} from '@/shared/api/generated';

const emptyRuntimeForm: FlinkRuntimeResponse = {
  clusterName: '',
  clusterType: 'standalone',
  address: 'http://host.docker.internal:8081',
  gatewayAddress: '',
  description: '',
  status: 'RUNNING',
};

export function useRuntimeSettings(enabled: boolean) {
  const runtimes = useListFlinkRuntimes(undefined, { query: { enabled, refetchOnMount: 'always' } });
  const createRuntime = useCreateFlinkRuntime();
  const [form, setForm] = useState<FlinkRuntimeResponse>(emptyRuntimeForm);

  async function handleCreateRuntime(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data: FlinkRuntimeRequest = {
      clusterName: form.clusterName?.trim() ?? '',
      clusterType: form.clusterType ?? 'standalone',
      address: form.address?.trim() ?? '',
      gatewayAddress: form.gatewayAddress?.trim() || undefined,
      description: form.description?.trim(),
      status: form.status ?? 'RUNNING',
    };
    await createRuntime.mutateAsync({ data });
    setForm(emptyRuntimeForm);
    await runtimes.refetch();
  }

  async function refetchRuntimes() {
    return (await runtimes.refetch()).data?.list ?? [];
  }

  return {
    runtimes,
    createRuntime,
    form,
    setForm,
    handleCreateRuntime,
    refetchRuntimes,
  };
}
