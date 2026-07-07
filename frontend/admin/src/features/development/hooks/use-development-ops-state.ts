'use client';

import { useState } from 'react';

export type OpsStatusFilter = 'all' | 'running' | 'abnormal' | 'created' | 'canceled' | 'finished';
export type OpsTypeFilter = 'all' | 'SQL' | 'JAR' | 'PYTHON';
export type OpsRuntimeModeFilter = 'all' | 'STREAMING' | 'BATCH';

export function useDevelopmentOpsState() {
  const [opsStatusFilter, setOpsStatusFilter] = useState<OpsStatusFilter>('all');
  const [opsSelectionMode, setOpsSelectionMode] = useState(false);
  const [opsJobNameKeyword, setOpsJobNameKeyword] = useState('');
  const [opsTagKeyword, setOpsTagKeyword] = useState('');
  const [opsTypeFilter, setOpsTypeFilter] = useState<OpsTypeFilter>('all');
  const [opsRuntimeModeFilter, setOpsRuntimeModeFilter] = useState<OpsRuntimeModeFilter>('all');
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

  function handleOpsRuntimeModeFilterChange(filter: string) {
    setOpsRuntimeModeFilter(filter as OpsRuntimeModeFilter);
    setOpsPage(1);
    setSelectedOpsJobIds([]);
  }

  function handleOpsJobNameSearchChange(value: string) {
    setOpsJobNameKeyword(value);
    setOpsPage(1);
    setSelectedOpsJobIds([]);
  }

  function handleOpsTagSearchChange(value: string) {
    setOpsTagKeyword(value);
    setOpsPage(1);
    setSelectedOpsJobIds([]);
  }

  return {
    handleOpsFilterChange,
    handleOpsJobNameSearchChange,
    handleOpsRuntimeModeFilterChange,
    handleOpsTagSearchChange,
    handleOpsSelectionModeChange,
    handleOpsTypeFilterChange,
    opsJobNameKeyword,
    opsPage,
    opsPageSize,
    opsRuntimeModeFilter,
    opsSelectionMode,
    opsStatusFilter,
    opsTagKeyword,
    opsTypeFilter,
    selectedOpsJobIds,
    setOpsPage,
    setOpsPageSize,
    setOpsSelectionMode,
    setSelectedOpsJobIds,
  };
}
