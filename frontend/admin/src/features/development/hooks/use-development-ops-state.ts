'use client';

import { useState } from 'react';

export type OpsStatusFilter = 'all' | 'running' | 'abnormal' | 'created' | 'canceled' | 'finished';
export type OpsTypeFilter = 'all' | 'SQL' | 'JAR' | 'PYTHON';

export function useDevelopmentOpsState() {
  const [opsStatusFilter, setOpsStatusFilter] = useState<OpsStatusFilter>('all');
  const [opsSelectionMode, setOpsSelectionMode] = useState(false);
  const [opsKeyword, setOpsKeyword] = useState('');
  const [opsTypeFilter, setOpsTypeFilter] = useState<OpsTypeFilter>('all');
  const [opsPage, setOpsPage] = useState(1);
  const [opsPageSize, setOpsPageSize] = useState(10);
  const [selectedOpsJobIds, setSelectedOpsJobIds] = useState<number[]>([]);

  function handleOpsSelectionModeChange(enabled: boolean) {
    setOpsSelectionMode(enabled);
    setSelectedOpsJobIds([]);
  }

  function handleOpsFilterChange(filter: string) {
    setOpsStatusFilter(filter as OpsStatusFilter);
    setOpsPage(1);
    setSelectedOpsJobIds([]);
  }

  function handleOpsTypeFilterChange(filter: string) {
    setOpsTypeFilter(filter as OpsTypeFilter);
    setOpsPage(1);
    setSelectedOpsJobIds([]);
  }

  function handleOpsSearchChange(value: string) {
    setOpsKeyword(value);
    setOpsPage(1);
    setSelectedOpsJobIds([]);
  }

  return {
    handleOpsFilterChange,
    handleOpsSearchChange,
    handleOpsSelectionModeChange,
    handleOpsTypeFilterChange,
    opsKeyword,
    opsPage,
    opsPageSize,
    opsSelectionMode,
    opsStatusFilter,
    opsTypeFilter,
    selectedOpsJobIds,
    setOpsPage,
    setOpsPageSize,
    setOpsSelectionMode,
    setSelectedOpsJobIds,
  };
}
