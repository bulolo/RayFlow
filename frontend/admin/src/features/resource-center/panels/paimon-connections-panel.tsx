'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Columns3, Database, Eye, File, FileText, Folder, FolderTree, History, RefreshCw, Search, Table2 } from 'lucide-react';
import {
  type PaimonCatalogResponse,
  type PaimonTableFileContentResponse,
  type PaimonTableDefinitionResponse,
  type PaimonTableFilesResponse,
  useGetPaimonTableFileContent,
  useGetPaimonTableDefinition,
  useGetPaimonTableSchema,
  useCheckPaimonCatalog,
  useCreatePaimonCatalog,
  useDeletePaimonCatalog,
  useListPaimonCatalogs,
  useListPaimonDatabases,
  useListPaimonTableFiles,
  useListPaimonTables,
  useListPaimonTableSnapshots,
  usePreviewPaimonTable,
  useUpdatePaimonCatalog,
} from '@/shared/api/generated';
import { Button, ConfirmModal, Field, Modal, SelectField, Textarea, Tooltip } from '@/components/ui';
import { ConnectionStatusBadge } from '@/features/resource-center/components/connection-status-badge';
import { ResourcePanelSkeleton } from '@/features/resource-center/components/resource-panel-skeleton';
import {
  type PaimonCatalogFormState,
  connectionStatusLabel,
  emptyPaimonForm,
  getPaimonEndpoint,
  getStringOption,
  normalizePaimonForm,
  parseJsonObject,
  toPaimonForm,
} from '@/features/resource-center/lib/resource-center-forms';
import { getErrorMessage } from '@/lib/error-message';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function PaimonConnectionsPanel() {
  const paimon = useListPaimonCatalogs(undefined, { query: { refetchOnMount: 'always' } });
  const createCatalog = useCreatePaimonCatalog();
  const updateCatalog = useUpdatePaimonCatalog();
  const deleteCatalog = useDeletePaimonCatalog();
  const checkCatalog = useCheckPaimonCatalog();
  const rows = useMemo(() => paimon.data?.list ?? [], [paimon.data?.list]);
  const [keyword, setKeyword] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingCatalog, setEditingCatalog] = useState<PaimonCatalogResponse | null>(null);
  const [browsingCatalog, setBrowsingCatalog] = useState<PaimonCatalogResponse | null>(null);
  const [pendingDeleteCatalog, setPendingDeleteCatalog] = useState<PaimonCatalogResponse | null>(null);
  const [form, setForm] = useState<PaimonCatalogFormState>(emptyPaimonForm);
  const filteredRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (!normalizedKeyword) return rows;
    return rows.filter((row) =>
      [row.catalogName, row.metastoreType, row.warehouse, getPaimonEndpoint(row.options), row.status]
        .join(' ')
        .toLowerCase()
        .includes(normalizedKeyword),
    );
  }, [keyword, rows]);
  const selectedCatalog = filteredRows.find((row) => row.id === selectedId) ?? filteredRows[0];
  const saving = createCatalog.isPending || updateCatalog.isPending || deleteCatalog.isPending || checkCatalog.isPending;
  const metastoreTypes = useMemo(() => new Set(rows.map((row) => row.metastoreType).filter(Boolean)), [rows]);
  const initialLoading = !paimon.data && (paimon.isLoading || paimon.isFetching);

  function resetForm() {
    setForm(emptyPaimonForm);
  }

  function openCreate() {
    resetForm();
    setCreateOpen(true);
  }

  function openEdit(catalog: PaimonCatalogResponse) {
    setForm(toPaimonForm(catalog));
    setEditingCatalog(catalog);
  }

  async function handleCreate() {
    try {
      await createCatalog.mutateAsync({ data: normalizePaimonForm(form) });
      toast.success(`Paimon Catalog「${form.catalogName}」已添加`);
      setCreateOpen(false);
      resetForm();
      await paimon.refetch();
    } catch (error) {
      toast.error(getErrorMessage(error, '添加 Paimon Catalog 失败'));
    }
  }

  async function handleUpdate() {
    if (!editingCatalog?.id) return;
    try {
      await updateCatalog.mutateAsync({ id: editingCatalog.id, data: normalizePaimonForm(form) });
      toast.success(`Paimon Catalog「${form.catalogName}」已更新`);
      setEditingCatalog(null);
      resetForm();
      await paimon.refetch();
    } catch (error) {
      toast.error(getErrorMessage(error, '更新 Paimon Catalog 失败'));
    }
  }

  async function handleDelete() {
    if (!pendingDeleteCatalog?.id) return;
    try {
      await deleteCatalog.mutateAsync({ id: pendingDeleteCatalog.id });
      toast.success(`Paimon Catalog「${pendingDeleteCatalog.catalogName}」已删除`);
      setPendingDeleteCatalog(null);
      if (selectedId === pendingDeleteCatalog.id) {
        setSelectedId(null);
      }
      await paimon.refetch();
    } catch (error) {
      toast.error(getErrorMessage(error, '删除 Paimon Catalog 失败'));
    }
  }

  async function handleCheck() {
    if (!selectedCatalog?.id) return;
    try {
      const ok = await checkCatalog.mutateAsync({ id: selectedCatalog.id });
      await paimon.refetch();
      if (ok) {
        toast.success(`Paimon Catalog「${selectedCatalog.catalogName}」S3 连通正常`);
        return;
      }
      toast.error(`Paimon Catalog「${selectedCatalog.catalogName}」S3 连通失败`);
    } catch (error) {
      await paimon.refetch();
      toast.error(getErrorMessage(error, '检测 Paimon Catalog 失败'));
    }
  }

  return (
    initialLoading ? <ResourcePanelSkeleton /> :
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 border border-border-subtle bg-white">
        <div className="flex flex-col gap-3 border-b border-border-subtle px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            <h3 className="text-base font-bold text-foreground">Paimon Catalog</h3>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" disabled={!selectedCatalog || saving} onClick={handleCheck}>测试 S3</Button>
            <Button size="sm" variant="primary" onClick={openCreate}>添加 Paimon Catalog</Button>
          </div>
        </div>
        <div className="grid gap-3 border-b border-border-subtle p-5 md:grid-cols-3">
          {[
            ['Catalog', String(rows.length)],
            ['启用', String(rows.filter((row) => row.status === 'ACTIVE').length)],
            ['Metastore', String(metastoreTypes.size)],
          ].map(([label, value]) => (
            <div key={label} className="bg-slate-50 px-4 py-3">
              <div className="text-[11px] font-bold text-muted-foreground">{label}</div>
              <div className="mt-1 text-xl font-bold text-slate-900">{value}</div>
            </div>
          ))}
        </div>
        <div className="border-b border-border-subtle p-4">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索 Paimon Catalog"
              className="h-9 w-full rounded-lg border border-border bg-white pl-9 pr-3 text-sm placeholder-slate-400 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[880px]">
            <div className="grid grid-cols-[1fr_0.8fr_1.4fr_1.5fr_6rem] bg-slate-50 px-4 py-2.5 text-xs font-bold text-muted-foreground">
              <span>名称</span>
              <span>Metastore</span>
              <span>S3 Endpoint</span>
              <span>Warehouse</span>
              <span className="text-right">状态</span>
            </div>
            {filteredRows.length > 0 ? (
              filteredRows.map((row) => {
                const selected = selectedCatalog?.id === row.id;
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setSelectedId(row.id ?? null)}
                    className={cn(
                      'grid w-full grid-cols-[1fr_0.8fr_1.4fr_1.5fr_6rem] border-t border-border-subtle px-4 py-3 text-left text-sm transition-colors',
                      selected ? 'bg-primary/5' : 'hover:bg-slate-50',
                    )}
                  >
                    <div className="min-w-0 flex flex-col justify-center">
                      <span className="truncate font-bold text-slate-900">{row.catalogName}</span>
                      {row.description ? (
                        <span className="truncate text-xs text-slate-400 font-medium mt-0.5" title={row.description}>
                          {row.description}
                        </span>
                      ) : null}
                    </div>
                    <span className="min-w-0 truncate text-slate-600">{row.metastoreType}</span>
                    <span className="min-w-0 truncate text-slate-600">{getPaimonEndpoint(row.options) ?? '-'}</span>
                    <span className="min-w-0 truncate text-slate-600">{row.warehouse}</span>
                    <span className="text-right"><ConnectionStatusBadge status={connectionStatusLabel(row.status)} /></span>
                  </button>
                );
              })
            ) : (
              <div className="border-t border-border-subtle px-4 py-10 text-center text-sm font-medium text-muted-foreground">
                {rows.length === 0 ? '暂无 Paimon Catalog，请添加真实连接。' : '没有匹配的 Catalog'}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border border-border-subtle bg-white p-5">
        <div className="flex items-center justify-between gap-3 border-b border-border-subtle pb-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">当前选择</div>
            <div className="mt-1 text-base font-bold text-foreground">{selectedCatalog?.catalogName ?? '-'}</div>
          </div>
          {selectedCatalog ? <ConnectionStatusBadge status={connectionStatusLabel(selectedCatalog.status)} /> : null}
        </div>
        <div className="mt-4 space-y-3">
          {[
            ['描述', selectedCatalog?.description ?? '-'],
            ['Metastore', selectedCatalog?.metastoreType ?? '-'],
            ['S3 Endpoint', getPaimonEndpoint(selectedCatalog?.options) ?? '-'],
            ['Warehouse', selectedCatalog?.warehouse ?? '-'],
            ['Access Key', getStringOption(parseJsonObject(selectedCatalog?.options), 's3.access-key') ? '已配置' : '-'],
            ['Path Style', getStringOption(parseJsonObject(selectedCatalog?.options), 's3.path.style.access') || '-'],
          ].map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-4 text-sm">
              <span className="shrink-0 text-muted-foreground">{label}</span>
              <span className="min-w-0 break-words text-right font-semibold text-slate-700">{value}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <Button size="sm" variant="primary" disabled={!selectedCatalog} onClick={() => selectedCatalog && setBrowsingCatalog(selectedCatalog)}>浏览</Button>
          <Button size="sm" disabled={!selectedCatalog} onClick={() => selectedCatalog && openEdit(selectedCatalog)}>编辑</Button>
          <Button size="sm" variant="ghost" disabled={!selectedCatalog} onClick={() => selectedCatalog && setPendingDeleteCatalog(selectedCatalog)}>删除</Button>
        </div>
      </div>

      <PaimonFormModal
        disabled={saving}
        form={form}
        onFormChange={setForm}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
        open={createOpen}
        submitLabel="添加"
        title="添加 Paimon Catalog"
      />
      <PaimonFormModal
        disabled={saving}
        form={form}
        onFormChange={setForm}
        onOpenChange={(open) => {
          if (!open) setEditingCatalog(null);
        }}
        onSubmit={handleUpdate}
        open={Boolean(editingCatalog)}
        submitLabel="保存"
        title={`编辑 ${editingCatalog?.catalogName ?? ''}`}
      />
      <Modal
        bodyClassName="flex min-h-0 p-0"
        cancelLabel="关闭"
        className="h-[92vh] max-w-[96vw]"
        onOpenChange={(open) => {
          if (!open) setBrowsingCatalog(null);
        }}
        open={Boolean(browsingCatalog)}
        showSubmit={false}
        title={`浏览 Paimon Catalog · ${browsingCatalog?.catalogName ?? ''}`}
      >
        <PaimonBrowserSection catalog={browsingCatalog ?? undefined} />
      </Modal>
      <ConfirmModal
        confirmLabel="删除"
        description={`删除后将移除 Paimon Catalog「${pendingDeleteCatalog?.catalogName ?? ''}」。`}
        onClose={() => setPendingDeleteCatalog(null)}
        onConfirm={handleDelete}
        open={Boolean(pendingDeleteCatalog)}
        title="删除 Paimon Catalog"
        tone="danger"
      />
    </div>
  );
}

function PaimonBrowserSection({ catalog }: { catalog?: PaimonCatalogResponse }) {
  const catalogId = catalog?.id ?? 0;
  const [selectedDatabase, setSelectedDatabase] = useState('');
  const [selectedTable, setSelectedTable] = useState('');
  const [activeDetail, setActiveDetail] = useState<'definition' | 'schema' | 'snapshots' | 'files' | 'preview'>('definition');
  const [filesPath, setFilesPath] = useState('');
  const [selectedFilePath, setSelectedFilePath] = useState('');
  const [refreshVersion, setRefreshVersion] = useState(0);
  const refreshParams = refreshVersion > 0 ? { refresh: true } : undefined;

  const databases = useListPaimonDatabases(catalogId, refreshParams, {
    query: {
      enabled: Boolean(catalogId),
      retry: false,
    },
  });
  const databaseRows = databases.data ?? [];
  const selectedDatabaseExists = databaseRows.some((database) => database.databaseName === selectedDatabase);
  const resolvedDatabase = selectedDatabaseExists ? selectedDatabase : '';

  const tables = useListPaimonTables(catalogId, resolvedDatabase, refreshParams, {
    query: {
      enabled: Boolean(catalogId && resolvedDatabase),
      retry: false,
    },
  });
  const tableRows = tables.data ?? [];
  const selectedTableExists = tableRows.some((table) => table.tableName === selectedTable);
  const resolvedTable = selectedTableExists ? selectedTable : '';

  const schema = useGetPaimonTableSchema(catalogId, resolvedDatabase, resolvedTable, refreshParams, {
    query: {
      enabled: Boolean(catalogId && resolvedDatabase && resolvedTable),
      retry: false,
    },
  });
  const definition = useGetPaimonTableDefinition(catalogId, resolvedDatabase, resolvedTable, refreshParams, {
    query: {
      enabled: Boolean(catalogId && resolvedDatabase && resolvedTable),
      retry: false,
    },
  });
  const snapshots = useListPaimonTableSnapshots(catalogId, resolvedDatabase, resolvedTable, {
    query: {
      enabled: Boolean(catalogId && resolvedDatabase && resolvedTable && activeDetail === 'snapshots'),
      retry: false,
    },
  });
  const files = useListPaimonTableFiles(catalogId, resolvedDatabase, resolvedTable, { path: filesPath, ...refreshParams }, {
    query: {
      enabled: Boolean(catalogId && resolvedDatabase && resolvedTable && activeDetail === 'files'),
      retry: false,
    },
  });
  const fileContent = useGetPaimonTableFileContent(catalogId, resolvedDatabase, resolvedTable, { path: selectedFilePath }, {
    query: {
      enabled: Boolean(catalogId && resolvedDatabase && resolvedTable && activeDetail === 'files' && selectedFilePath),
      retry: false,
    },
  });
  const preview = usePreviewPaimonTable(catalogId, resolvedDatabase, resolvedTable, { limit: 100 }, {
    query: {
      enabled: false,
      retry: false,
    },
  });

  useEffect(() => {
    if (refreshVersion === 0) return;
    void databases.refetch();
    if (resolvedDatabase) void tables.refetch();
    if (resolvedDatabase && resolvedTable && activeDetail === 'definition') void definition.refetch();
    if (resolvedDatabase && resolvedTable && activeDetail === 'schema') void schema.refetch();
    if (resolvedDatabase && resolvedTable && activeDetail === 'snapshots') void snapshots.refetch();
    if (resolvedDatabase && resolvedTable && activeDetail === 'files') void files.refetch();
    if (resolvedDatabase && resolvedTable && activeDetail === 'preview') void preview.refetch();
    // React Query refetch functions are intentionally omitted so refreshVersion
    // is the only manual refresh trigger after refresh=true is in the query key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshVersion]);

  useEffect(() => {
    if (!catalogId || refreshVersion > 0 || databases.isLoading || databases.isFetching || databases.error || databaseRows.length > 0) {
      return;
    }
    const timer = window.setTimeout(() => {
      setRefreshVersion((version) => version + 1);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [catalogId, databaseRows.length, databases.error, databases.isFetching, databases.isLoading, refreshVersion]);

  if (!catalog) {
    return (
      <div className="border border-border-subtle bg-white p-8 text-center text-sm font-medium text-muted-foreground xl:col-span-2">
        请选择一个 Paimon Catalog 后浏览库表资源。
      </div>
    );
  }

  const loadingTree = databases.isFetching || tables.isFetching;
  const detailLoading = (activeDetail === 'definition' && definition.isFetching)
    || (activeDetail === 'schema' && schema.isFetching)
    || (activeDetail === 'snapshots' && snapshots.isFetching)
    || (activeDetail === 'files' && files.isFetching)
    || (activeDetail === 'preview' && preview.isFetching);
  const detailError = databases.error
    || (resolvedDatabase ? tables.error : null)
    || (resolvedDatabase && resolvedTable && activeDetail === 'definition' ? definition.error : null)
    || (resolvedDatabase && resolvedTable && activeDetail === 'schema' ? schema.error : null)
    || (resolvedDatabase && resolvedTable && activeDetail === 'snapshots' ? snapshots.error : null)
    || (resolvedDatabase && resolvedTable && activeDetail === 'files' ? files.error : null)
    || (resolvedDatabase && resolvedTable && activeDetail === 'files' ? fileContent.error : null)
    || (resolvedDatabase && resolvedTable && activeDetail === 'preview' ? preview.error : null);
  const currentPreview = preview.data?.databaseName === resolvedDatabase && preview.data?.tableName === resolvedTable ? preview.data : undefined;
  const previewColumns = currentPreview?.columns ?? [];
  const previewRows = currentPreview?.data ?? [];
  const previewQueried = Boolean(currentPreview);
  const snapshotColumns = snapshots.data?.columns ?? [];
  const snapshotRows = snapshots.data?.rows ?? [];

  function refreshBrowser() {
    setRefreshVersion((version) => version + 1);
  }

  return (
    <div className="grid min-h-0 w-full flex-1 grid-rows-[auto_minmax(0,1fr)] bg-slate-50/60">
      <div className="flex items-center justify-between gap-4 border-b border-border-subtle bg-white px-5 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Database className="h-4 w-4 text-primary" />
            {catalog.catalogName}
          </div>
          <div className="mt-1 truncate text-xs font-semibold text-slate-400">{catalog.warehouse || '未配置 Warehouse'}</div>
        </div>
        <Tooltip
          content="绕过 3 小时缓存，重新读取 Database、Table 和当前详情"
          side="left"
          tooltipClassName="whitespace-normal w-60 text-left leading-4"
        >
          <Button size="sm" variant="ghost" className="h-8 px-3" onClick={refreshBrowser} disabled={loadingTree || detailLoading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loadingTree || detailLoading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </Tooltip>
      </div>

      <div className="grid min-h-0 gap-0 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] border-r border-border-subtle bg-white">
          <div className="flex h-11 items-center justify-between border-b border-border-subtle px-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <FolderTree className="h-4 w-4 text-primary" />
              库表目录
            </div>
            <span className="text-xs font-bold text-slate-400">{databaseRows.length} DB</span>
          </div>
          <div className="min-h-0 overflow-auto p-3">
            {databases.isLoading ? (
              <div className="px-2 py-8 text-center text-xs font-semibold text-slate-400">正在加载 Database...</div>
            ) : databaseRows.length ? (
              <div className="space-y-2">
                {databaseRows.map((database) => {
                  const databaseName = database.databaseName ?? '';
                  const activeDatabase = resolvedDatabase === databaseName;
                  return (
                    <div key={databaseName} className={cn('rounded-lg border bg-white transition', activeDatabase ? 'border-primary/30 shadow-sm' : 'border-slate-200')}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDatabase((current) => (current === databaseName ? '' : databaseName));
                          setSelectedTable('');
                          setFilesPath('');
                          setSelectedFilePath('');
                        }}
                        className={`flex h-9 w-full items-center justify-between px-3 text-left text-xs font-bold transition ${
                          activeDatabase ? 'bg-primary/5 text-primary' : 'text-slate-700 hover:bg-slate-50 hover:text-primary'
                        }`}
                      >
                        <span className="truncate">{databaseName}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-400">{activeDatabase ? '收起' : '展开'}</span>
                      </button>
                      {activeDatabase ? (
                        <div className="border-t border-slate-100 p-1.5">
                          {tables.isFetching ? (
                            <div className="px-2 py-3 text-xs font-semibold text-slate-400">加载表...</div>
                          ) : tableRows.length ? (
                            tableRows.map((table) => {
                              const tableName = table.tableName ?? '';
                              const activeTable = resolvedTable === tableName;
                              return (
                                <button
                                  key={`${databaseName}.${tableName}`}
                                  type="button"
                                  onClick={() => {
                                    setSelectedTable(tableName);
                                    setFilesPath('');
                                    setSelectedFilePath('');
                                  }}
                                  className={`flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs font-semibold transition ${
                                    activeTable ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                  }`}
                                >
                                  <Table2 className="h-3.5 w-3.5 shrink-0" />
                                  <span className="min-w-0 truncate">{tableName}</span>
                                </button>
                              );
                            })
                          ) : (
                            <div className="px-2 py-3 text-xs font-semibold text-slate-400">暂无表</div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-2 py-8 text-center text-xs font-semibold text-slate-400">暂无 Database</div>
            )}
          </div>
        </div>

        <div className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] bg-white">
          <div className="flex flex-col gap-3 border-b border-border-subtle px-5 py-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">当前表</div>
              <div className="mt-1 truncate text-sm font-bold text-slate-900">
                {resolvedDatabase && resolvedTable ? `${catalog.catalogName}.${resolvedDatabase}.${resolvedTable}` : '请选择表'}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1 rounded-lg bg-slate-100 p-1">
              {[
                { key: 'definition', label: '定义', icon: FileText },
                { key: 'schema', label: 'Schema', icon: Columns3 },
                { key: 'snapshots', label: '快照', icon: History },
                { key: 'files', label: '文件', icon: Folder },
                { key: 'preview', label: '预览', icon: Eye },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActiveDetail(item.key as 'definition' | 'schema' | 'snapshots' | 'files' | 'preview')}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-bold transition ${
                      activeDetail === item.key ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-h-0 overflow-auto p-5">
            {detailError ? (
              <div className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                Paimon 浏览失败：{getErrorMessage(detailError, '请检查 Paimon Catalog 配置、后端 Paimon 依赖；预览功能还需检查内置 SQL Gateway')}
              </div>
            ) : !resolvedDatabase || !resolvedTable ? (
              <div className="flex h-full min-h-[360px] items-center justify-center text-sm font-medium text-muted-foreground">请选择左侧库表。</div>
            ) : detailLoading ? (
              <div className="flex h-full min-h-[360px] items-center justify-center text-sm font-medium text-muted-foreground">正在加载 Paimon 元数据...</div>
            ) : activeDetail === 'definition' ? (
              <TableDefinitionPanel definition={definition.data} />
            ) : activeDetail === 'schema' ? (
              <SimpleTable
                columns={['字段', '类型', '可空', '键', '扩展']}
                rows={(schema.data?.columns ?? []).map((column) => [
                  column.name ?? '-',
                  column.type ?? '-',
                  column.nullable ?? '-',
                  column.key ?? '-',
                  column.extras || column.watermark || '-',
                ])}
                empty="暂无 Schema 信息"
              />
            ) : activeDetail === 'snapshots' ? (
              snapshotRows.length ? (
                <ObjectTable columns={snapshotColumns} rows={snapshotRows} />
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center text-sm font-medium text-slate-400">
                  {snapshots.data?.message || '暂无快照信息'}
                </div>
              )
            ) : activeDetail === 'files' ? (
              <TableFilesPanel
                files={files.data}
                fileContent={fileContent.data}
                fileContentLoading={fileContent.isFetching}
                loading={files.isFetching}
                onChangePath={(nextPath) => {
                  setFilesPath(nextPath);
                  setSelectedFilePath('');
                }}
                onOpenFile={(path) => setSelectedFilePath(path)}
              />
            ) : activeDetail === 'preview' ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-xs font-semibold text-slate-500">数据预览会向 Flink SQL Gateway 发送 SELECT 查询，默认限制 100 行。</div>
                  <Button size="sm" variant="primary" disabled={preview.isFetching} onClick={() => void preview.refetch()}>
                    {preview.isFetching ? '查询中...' : '查询预览'}
                  </Button>
                </div>
                {previewRows.length ? (
                  <ObjectTable columns={previewColumns.map((column) => column.name ?? '-')} rows={previewRows as Array<Record<string, unknown>>} />
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center text-sm font-medium text-slate-400">
                    {previewQueried ? '查询完成，暂无数据' : '点击「查询预览」读取前 100 行数据'}
                  </div>
                )}
              </div>
            ) : null}
          </div>
      </div>
    </div>
    </div>
  );
}

function TableDefinitionPanel({ definition }: { definition?: PaimonTableDefinitionResponse }) {
  if (!definition) {
    return <div className="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center text-sm font-medium text-slate-400">暂无表定义信息</div>;
  }
  const tableDefinition = definition;
  const options = Object.entries(definition.options ?? {}).map(([key, value]) => ({ key, value }));

  async function copySql() {
    try {
      await navigator.clipboard.writeText(tableDefinition.createTableSql ?? '');
      toast.success('表定义 SQL 已复制');
    } catch {
      toast.error('复制失败，请手动复制');
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DefinitionCard label="表名" value={definition.qualifiedName || `${definition.databaseName}.${definition.tableName}`} />
        <DefinitionCard label="Schema" value={`ID ${definition.schemaId ?? '-'} / V${definition.schemaVersion ?? '-'}`} />
        <DefinitionCard label="主键" value={(definition.primaryKeys ?? []).join(', ') || '-'} />
        <DefinitionCard label="分区" value={(definition.partitionKeys ?? []).join(', ') || '-'} />
        <DefinitionCard label="Bucket" value={definition.numBuckets == null ? '-' : String(definition.numBuckets)} />
        <DefinitionCard label="Bucket Key" value={(definition.bucketKeys ?? []).join(', ') || '-'} />
        <DefinitionCard label="注释" value={definition.comment || '-'} className="md:col-span-2" />
      </div>

      <div className="rounded-lg border border-border-subtle bg-slate-950 shadow-sm">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
          <div className="text-xs font-bold uppercase tracking-widest text-slate-400">CREATE TABLE</div>
          <Button size="sm" variant="ghost" className="h-7 text-slate-200 hover:bg-white/10 hover:text-white" onClick={copySql}>
            复制 SQL
          </Button>
        </div>
        <pre className="max-h-[360px] overflow-auto p-4 text-xs leading-5 text-slate-100">
          <code>{definition.createTableSql || '-- 暂无 DDL'}</code>
        </pre>
      </div>

      <div>
        <div className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Options</div>
        {options.length ? (
          <ObjectTable columns={['key', 'value']} rows={options} />
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm font-medium text-slate-400">暂无 Options</div>
        )}
      </div>
    </div>
  );
}

function DefinitionCard({ className, label, value }: { className?: string; label: string; value: string }) {
  return (
    <div className={cn('min-w-0 rounded-lg border border-border-subtle bg-slate-50 px-3 py-2.5', className)}>
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</div>
      <div className="mt-1 truncate text-xs font-bold text-slate-800" title={value}>{value}</div>
    </div>
  );
}

function TableFilesPanel({
  fileContent,
  fileContentLoading,
  files,
  loading,
  onChangePath,
  onOpenFile,
}: {
  fileContent?: PaimonTableFileContentResponse;
  fileContentLoading: boolean;
  files?: PaimonTableFilesResponse;
  loading: boolean;
  onChangePath: (path: string) => void;
  onOpenFile: (path: string) => void;
}) {
  const entries = files?.entries ?? [];
  const currentPath = files?.currentPath ?? '';

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border-subtle bg-slate-50 px-3 py-2">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Table Path</div>
        <div className="mt-1 truncate font-mono text-xs font-semibold text-slate-700" title={files?.tablePath}>{files?.tablePath || '-'}</div>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-white p-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">当前目录</div>
          <div className="mt-1 truncate font-mono text-xs font-bold text-slate-800">{currentPath || '/'}</div>
        </div>
        <Button size="sm" variant="ghost" className="h-8 shrink-0" disabled={!currentPath || loading} onClick={() => onChangePath(files?.parentPath ?? '')}>
          <ChevronLeft className="h-3.5 w-3.5" />
          返回上级
        </Button>
      </div>

      {entries.length ? (
        <div className="overflow-auto rounded-lg border border-border-subtle">
          <table className="min-w-full text-left text-xs">
            <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2 font-bold">名称</th>
                <th className="px-3 py-2 font-bold">类型</th>
                <th className="px-3 py-2 font-bold">大小</th>
                <th className="px-3 py-2 font-bold">修改时间</th>
                <th className="px-3 py-2 font-bold">路径</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle bg-white">
              {entries.map((entry) => {
                const isDirectory = entry.type === 'directory';
                return (
                  <tr
                    key={entry.path}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => (isDirectory ? onChangePath(entry.path ?? '') : onOpenFile(entry.path ?? ''))}
                  >
                    <td className="max-w-[280px] px-3 py-2 font-bold text-slate-800">
                      <span className="inline-flex min-w-0 items-center gap-2">
                        {isDirectory ? <Folder className="h-3.5 w-3.5 shrink-0 text-amber-500" /> : <File className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                        <span className="truncate">{entry.name ?? '-'}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-600">{isDirectory ? '目录' : '文件'}</td>
                    <td className="px-3 py-2 font-medium text-slate-600">{isDirectory ? '-' : formatBytes(entry.size)}</td>
                    <td className="px-3 py-2 font-medium text-slate-600">{formatDateTime(entry.lastModified)}</td>
                    <td className="max-w-[360px] truncate px-3 py-2 font-mono text-[11px] font-medium text-slate-500" title={entry.path ?? ''}>{entry.path ?? '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center text-sm font-medium text-slate-400">
          {loading ? '正在读取目录...' : '当前目录暂无文件'}
        </div>
      )}

      <FileContentPreview content={fileContent} loading={fileContentLoading} />
    </div>
  );
}

function FileContentPreview({ content, loading }: { content?: PaimonTableFileContentResponse; loading: boolean }) {
  if (loading) {
    return <div className="rounded-lg border border-border-subtle bg-slate-50 px-4 py-6 text-sm font-medium text-slate-500">正在读取文件内容...</div>;
  }
  if (!content) {
    return <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm font-medium text-slate-400">点击文件后在这里查看内容。</div>;
  }
  const structuredRows = content.rows ?? [];
  const structuredColumns = content.columns ?? [];
  return (
    <div className="rounded-lg border border-border-subtle bg-white">
      <div className="flex flex-col gap-2 border-b border-border-subtle px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-slate-900">{content.name || content.path}</div>
          <div className="mt-1 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-400">
            <span>{formatBytes(content.size)}</span>
            <span>{content.contentType || 'unknown'}</span>
            {content.truncated ? <span>已截断显示前 256KB</span> : null}
          </div>
        </div>
      </div>
      {structuredRows.length ? (
        <div className="p-4">
          <ObjectTable columns={structuredColumns} rows={structuredRows} />
        </div>
      ) : content.viewable ? (
        <pre className="max-h-[420px] overflow-auto bg-slate-950 p-4 text-xs leading-5 text-slate-100">
          <code>{content.content || ''}</code>
        </pre>
      ) : (
        <div className="px-4 py-10 text-center text-sm font-medium text-slate-400">
          {content.message || '当前文件不是可直接预览的文本文件'}
        </div>
      )}
    </div>
  );
}

function SimpleTable({ columns, empty, rows }: { columns: string[]; empty: string; rows: Array<Array<string>> }) {
  if (!rows.length) {
    return <div className="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center text-sm font-medium text-slate-400">{empty}</div>;
  }
  return (
    <div className="overflow-auto rounded-lg border border-border-subtle">
      <table className="min-w-full text-left text-xs">
        <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500">
          <tr>{columns.map((column) => <th key={column} className="px-3 py-2 font-bold">{column}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border-subtle bg-white">
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((value, valueIndex) => <td key={valueIndex} className="max-w-[280px] truncate px-3 py-2 font-medium text-slate-700">{value}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ObjectTable({ columns, rows }: { columns: string[]; rows: Array<Record<string, unknown>> }) {
  const resolvedColumns = columns.length ? columns : Object.keys(rows[0] ?? {});
  return (
    <div className="overflow-auto rounded-lg border border-border-subtle">
      <table className="min-w-full text-left text-xs">
        <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500">
          <tr>{resolvedColumns.map((column) => <th key={column} className="px-3 py-2 font-bold">{column}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border-subtle bg-white">
          {rows.map((row, index) => (
            <tr key={index}>
              {resolvedColumns.map((column) => (
                <td key={column} className="max-w-[280px] truncate px-3 py-2 font-medium text-slate-700">
                  {formatCell(row[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(value: unknown) {
  if (value == null) return '-';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function formatBytes(value?: number | null) {
  if (value == null) return '-';
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = value / 1024;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index++;
  }
  return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[index]}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function PaimonFormModal({
  disabled,
  form,
  onFormChange,
  onOpenChange,
  onSubmit,
  open,
  submitLabel,
  title,
}: {
  disabled?: boolean;
  form: PaimonCatalogFormState;
  onFormChange: (form: PaimonCatalogFormState) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
  open: boolean;
  submitLabel: string;
  title: string;
}) {
  return (
    <Modal disabled={disabled} onOpenChange={onOpenChange} open={open} submitLabel={submitLabel} title={title} onSubmit={onSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="Catalog 名称"
          value={form.catalogName}
          onChange={(event) => onFormChange({ ...form, catalogName: event.target.value })}
          placeholder="paimon"
        />
        <SelectField
          label="Metastore"
          value={form.metastoreType}
          onValueChange={(value) => onFormChange({ ...form, metastoreType: value })}
          options={[
            { label: 'filesystem', value: 'filesystem' },
            { label: 'hive', value: 'hive' },
            { label: 'jdbc', value: 'jdbc' },
            { label: 'rest', value: 'rest' },
          ]}
        />
        <div className="md:col-span-2">
          <Field
            label="Warehouse"
            value={form.warehouse}
            onChange={(event) => onFormChange({ ...form, warehouse: event.target.value })}
            placeholder="s3://rayflow-lake/paimon"
          />
        </div>
        <div className="md:col-span-2">
          <Field
            label="S3 Endpoint"
            value={form.s3Endpoint}
            onChange={(event) => onFormChange({ ...form, s3Endpoint: event.target.value })}
            placeholder="http://rustfs:9000"
          />
        </div>
        <Field
          label="S3 Access Key"
          value={form.s3AccessKey}
          onChange={(event) => onFormChange({ ...form, s3AccessKey: event.target.value })}
          placeholder="access key"
        />
        <Field
          label="S3 Secret Key"
          type="password"
          value={form.s3SecretKey}
          onChange={(event) => onFormChange({ ...form, s3SecretKey: event.target.value })}
          placeholder="secret key"
        />
        <SelectField
          label="Path Style Access"
          value={form.s3PathStyleAccess}
          onValueChange={(value) => onFormChange({ ...form, s3PathStyleAccess: value })}
          options={[
            { label: 'true', value: 'true' },
            { label: 'false', value: 'false' },
          ]}
        />
        <SelectField
          label="状态"
          value={form.status}
          onValueChange={(value) => onFormChange({ ...form, status: value })}
          options={[
            { label: '启用', value: 'ACTIVE' },
            { label: '停用', value: 'INACTIVE' },
          ]}
        />
        <div className="md:col-span-2">
          <Field
            label="描述"
            value={form.description ?? ''}
            onChange={(event) => onFormChange({ ...form, description: event.target.value })}
            placeholder="测试 Paimon Catalog"
          />
        </div>
        <div className="md:col-span-2">
          <Textarea
            className="min-h-32 resize-y font-mono text-[13px]"
            label="高级 Options(JSON)"
            value={form.advancedOptions}
            onChange={(event) => onFormChange({ ...form, advancedOptions: event.target.value })}
            placeholder={'{\n  "fs.s3a.connection.timeout": "600"\n}'}
            spellCheck={false}
          />
        </div>
      </div>
    </Modal>
  );
}
