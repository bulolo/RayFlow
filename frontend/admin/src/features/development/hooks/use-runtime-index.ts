import { useMemo } from 'react';
import type { FlinkRuntimeResponse } from '@/shared/api/generated';

export function useRuntimeIndex(clusterList: FlinkRuntimeResponse[]) {
  const clusterNameById = useMemo(
    () => new Map(clusterList.map((cluster) => [cluster.id, cluster.clusterName])),
    [clusterList],
  );
  const clusterAddressById = useMemo(
    () => new Map(clusterList.map((cluster) => [cluster.id, cluster.address])),
    [clusterList],
  );

  return {
    clusterAddressById,
    clusterNameById,
  };
}
