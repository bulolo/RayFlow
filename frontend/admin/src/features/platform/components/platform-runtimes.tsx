'use client';

import { useCallback, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Activity } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/data-display/data-table';
import { Button, Badge, SectionCard, SectionHeader } from '@/components/ui';
import { getErrorMessage } from '@/lib/error-message';
import {
  type FlinkRuntimeResponse,
  useCheckFlinkRuntime,
  useListFlinkRuntimes,
} from '@/shared/api/generated';

function statusTone(status?: string): 'success' | 'danger' | 'warning' | 'neutral' {
  if (status === 'RUNNING') return 'success';
  if (status === 'UNREACHABLE') return 'danger';
  if (status === 'STOPPED') return 'warning';
  return 'neutral';
}

function statusLabel(status?: string) {
  if (status === 'RUNNING') return '正常';
  if (status === 'UNREACHABLE') return '不可达';
  if (status === 'STOPPED') return '已停止';
  return '未知';
}

export function PlatformRuntimes() {
  const clusters = useListFlinkRuntimes();
  const checkCluster = useCheckFlinkRuntime();

  const data = useMemo(
    () => (clusters.data?.list ?? []).filter((item) => item.clusterScope === 'PLATFORM'),
    [clusters.data],
  );

  const handleCheck = useCallback(async (cluster: FlinkRuntimeResponse) => {
    if (!cluster.id) return;
    try {
      const result = await checkCluster.mutateAsync({ id: cluster.id });
      void clusters.refetch();
      if (result.clusterReachable) {
        if (result.gatewayStatus === 'RUNNING') {
          toast.success(`平台运行时「${cluster.clusterName}」和 SQL Gateway 连接正常`);
        } else if (result.gatewayStatus === 'UNREACHABLE') {
          toast.warning(`平台运行时「${cluster.clusterName}」连接正常，但 SQL Gateway 不可用`);
        } else {
          toast.success(`平台运行时「${cluster.clusterName}」连接正常，未配置 SQL Gateway`);
        }
      } else {
        toast.error(`平台运行时「${cluster.clusterName}」连接失败，请检查服务地址`);
      }
    } catch (error) {
      toast.error(getErrorMessage(error, '检查平台运行时失败'));
    }
  }, [checkCluster, clusters]);

  const columns = useMemo<ColumnDef<FlinkRuntimeResponse>[]>(
    () => [
      {
        accessorKey: 'clusterName',
        header: '运行时名称',
        cell: ({ row }) => <span className="font-semibold text-foreground">{row.original.clusterName || '-'}</span>,
      },
      { accessorKey: 'clusterType', header: '部署类型' },
      {
        accessorKey: 'address',
        header: 'Flink 服务地址',
        cell: ({ row }) => (
          <code className="block max-w-[320px] truncate rounded border border-border/40 bg-zinc-50 px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
            {row.original.address}
          </code>
        ),
      },
      {
        accessorKey: 'status',
        header: '状态',
        cell: ({ row }) => (
          <Badge tone={statusTone(row.original.status)} className="font-semibold">
            {statusLabel(row.original.status)}
          </Badge>
        ),
      },
      {
        accessorKey: 'gatewayStatus',
        header: 'SQL Gateway',
        cell: ({ row }) => (
          <Badge tone={statusTone(row.original.gatewayStatus)} className="font-semibold">
            {statusLabel(row.original.gatewayStatus)}
          </Badge>
        ),
      },
      { accessorKey: 'flinkVersion', header: 'Flink 版本' },
      {
        id: 'actions',
        header: '操作',
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <Button
              onClick={() => void handleCheck(row.original)}
              disabled={checkCluster.isPending}
              variant="secondary"
              size="icon"
              className="h-8 w-8"
              title="测试连通性"
            >
              <Activity className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        ),
      },
    ],
    [checkCluster.isPending, handleCheck],
  );

  return (
    <div className="w-full space-y-6">
      <SectionHeader
        title="内置运行时"
        description="平台共享运行时在此统一查看和巡检，租户侧只读引用，不在这里做日常编辑。"
      />
      <SectionCard title="平台共享运行时">
        <div className="p-5">
          <DataTable columns={columns} data={data} searchPlaceholder="搜索平台运行时" />
        </div>
      </SectionCard>
    </div>
  );
}
