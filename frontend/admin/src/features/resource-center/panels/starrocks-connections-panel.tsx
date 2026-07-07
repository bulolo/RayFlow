'use client';

import { type ReactNode, useMemo, useState } from 'react';
import { Columns3, Database, DatabaseZap, Eye, FileText, Play, RefreshCw, Search, Table2 } from 'lucide-react';
import {
  type StarRocksConnectionRequest,
  type StarRocksConnectionResponse,
  type StarRocksObjectDefinitionResponse,
  useCheckStarRocksConnection,
  useCreateStarRocksConnection,
  useDeleteStarRocksConnection,
  useExecuteStarRocksQuery,
  useGetStarRocksObjectDefinition,
  useGetStarRocksObjectSchema,
  useListStarRocksConnections,
  useListStarRocksDatabases,
  useListStarRocksObjectPartitions,
  useListStarRocksObjects,
  usePreviewStarRocksObject,
  useUpdateStarRocksConnection,
} from '@/shared/api/generated';
import { Button, ConfirmModal, Field, Modal, Tooltip, SqlCodeEditor } from '@/components/ui';
import { ConnectionStatusBadge } from '@/features/resource-center/components/connection-status-badge';
import { ResourcePanelSkeleton } from '@/features/resource-center/components/resource-panel-skeleton';
import {
  connectionStatusLabel,
  emptyStarRocksForm,
  normalizeStarRocksForm,
} from '@/features/resource-center/lib/resource-center-forms';
import { getErrorMessage } from '@/lib/error-message';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function StarRocksConnectionsPanel() {
  const starrocks = useListStarRocksConnections(undefined, { query: { refetchOnMount: 'always' } });
  const createConnection = useCreateStarRocksConnection();
  const updateConnection = useUpdateStarRocksConnection();
  const deleteConnection = useDeleteStarRocksConnection();
  const checkConnection = useCheckStarRocksConnection();
  const rows = useMemo(() => starrocks.data?.list ?? [], [starrocks.data?.list]);
  const [keyword, setKeyword] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<StarRocksConnectionResponse | null>(null);
  const [browsingConnection, setBrowsingConnection] = useState<StarRocksConnectionResponse | null>(null);
  const [pendingDeleteConnection, setPendingDeleteConnection] = useState<StarRocksConnectionResponse | null>(null);
  const [form, setForm] = useState<StarRocksConnectionRequest>(emptyStarRocksForm);
  const filteredRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (!normalizedKeyword) return rows;
    return rows.filter((row) =>
      [row.connectionName, row.feAddress, row.defaultDatabase, row.username, row.status]
        .join(' ')
        .toLowerCase()
        .includes(normalizedKeyword),
    );
  }, [keyword, rows]);
  const selectedConnection = filteredRows.find((row) => row.id === selectedId) ?? filteredRows[0];
  const saving = createConnection.isPending || updateConnection.isPending || deleteConnection.isPending || checkConnection.isPending;
  const initialLoading = !starrocks.data && (starrocks.isLoading || starrocks.isFetching);

  function resetForm() {
    setForm(emptyStarRocksForm);
  }

  function openCreate() {
    resetForm();
    setCreateOpen(true);
  }

  function openEdit(connection: StarRocksConnectionResponse) {
    setForm({
      connectionName: connection.connectionName ?? '',
      defaultDatabase: connection.defaultDatabase ?? 'scm',
      feAddress: connection.feAddress ?? '',
      password: '',
      queryPort: connection.queryPort ?? 9030,
      status: connection.status ?? 'ACTIVE',
      username: connection.username ?? '',
    });
    setEditingConnection(connection);
  }

  async function handleCreate() {
    try {
      await createConnection.mutateAsync({ data: normalizeStarRocksForm(form) });
      toast.success(`StarRocks 连接「${form.connectionName}」已添加`);
      setCreateOpen(false);
      resetForm();
      await starrocks.refetch();
    } catch (error) {
      toast.error(getErrorMessage(error, '添加 StarRocks 连接失败'));
    }
  }

  async function handleUpdate() {
    if (!editingConnection?.id) return;
    try {
      await updateConnection.mutateAsync({ id: editingConnection.id, data: normalizeStarRocksForm(form) });
      toast.success(`StarRocks 连接「${form.connectionName}」已更新`);
      setEditingConnection(null);
      resetForm();
      await starrocks.refetch();
    } catch (error) {
      toast.error(getErrorMessage(error, '更新 StarRocks 连接失败'));
    }
  }

  async function handleDelete() {
    if (!pendingDeleteConnection?.id) return;
    try {
      await deleteConnection.mutateAsync({ id: pendingDeleteConnection.id });
      toast.success(`StarRocks 连接「${pendingDeleteConnection.connectionName}」已删除`);
      setPendingDeleteConnection(null);
      if (selectedId === pendingDeleteConnection.id) {
        setSelectedId(null);
      }
      await starrocks.refetch();
    } catch (error) {
      toast.error(getErrorMessage(error, '删除 StarRocks 连接失败'));
    }
  }

  async function handleCheck() {
    if (!selectedConnection?.id) return;
    try {
      const ok = await checkConnection.mutateAsync({ id: selectedConnection.id });
      await starrocks.refetch();
      if (ok) {
        toast.success(`StarRocks 连接「${selectedConnection.connectionName}」连通正常`);
        return;
      }
      toast.error(`StarRocks 连接「${selectedConnection.connectionName}」连通失败`);
    } catch (error) {
      await starrocks.refetch();
      toast.error(getErrorMessage(error, '检测 StarRocks 连接失败'));
    }
  }

  return (
    initialLoading ? <ResourcePanelSkeleton /> :
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 border border-border-subtle bg-white">
        <div className="flex flex-col gap-3 border-b border-border-subtle px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <DatabaseZap className="h-4 w-4 text-primary" />
            <h3 className="text-base font-bold text-foreground">StarRocks</h3>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" disabled={!selectedConnection || saving} onClick={handleCheck}>测试连接</Button>
            <Button size="sm" disabled={!selectedConnection} onClick={() => selectedConnection && setBrowsingConnection(selectedConnection)}>浏览资源</Button>
            <Button size="sm" variant="primary" onClick={openCreate}>添加 StarRocks 连接</Button>
          </div>
        </div>
        <div className="grid gap-3 border-b border-border-subtle p-5 md:grid-cols-3">
          {[
            ['连接', String(rows.length)],
            ['启用', String(rows.filter((row) => row.status === 'ACTIVE').length)],
            ['默认端口', '9030'],
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
              placeholder="搜索 StarRocks 连接"
              className="h-9 w-full rounded-lg border border-border bg-white pl-9 pr-3 text-sm placeholder-slate-400 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-5 bg-slate-50 px-4 py-2.5 text-xs font-bold text-muted-foreground">
              <span>名称</span>
              <span>FE 地址</span>
              <span>端口</span>
              <span>默认库</span>
              <span className="text-right">状态</span>
            </div>
            {filteredRows.length > 0 ? (
              filteredRows.map((row) => {
                const selected = selectedConnection?.id === row.id;
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setSelectedId(row.id ?? null)}
                    className={cn(
                      'grid w-full grid-cols-5 border-t border-border-subtle px-4 py-3 text-left text-sm transition-colors',
                      selected ? 'bg-primary/5' : 'hover:bg-slate-50',
                    )}
                  >
                    <span className="min-w-0 truncate font-bold text-slate-900">{row.connectionName}</span>
                    <span className="min-w-0 truncate text-slate-600">{row.feAddress}</span>
                    <span className="min-w-0 truncate text-slate-600">{row.queryPort}</span>
                    <span className="min-w-0 truncate text-slate-600">{row.defaultDatabase}</span>
                    <span className="text-right"><ConnectionStatusBadge status={connectionStatusLabel(row.status)} /></span>
                  </button>
                );
              })
            ) : (
              <div className="border-t border-border-subtle px-4 py-10 text-center text-sm font-medium text-muted-foreground">
                {rows.length === 0 ? '暂无 StarRocks 连接，请添加真实连接。' : '没有匹配的连接'}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border border-border-subtle bg-white p-5">
        <div className="flex items-center justify-between gap-3 border-b border-border-subtle pb-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">当前选择</div>
            <div className="mt-1 text-base font-bold text-foreground">{selectedConnection?.connectionName ?? '-'}</div>
          </div>
          {selectedConnection ? <ConnectionStatusBadge status={connectionStatusLabel(selectedConnection.status)} /> : null}
        </div>
        <div className="mt-4 space-y-3">
          {[
            ['FE 地址', selectedConnection?.feAddress ?? '-'],
            ['查询端口', String(selectedConnection?.queryPort ?? '-')],
            ['用户名', selectedConnection?.username ?? '-'],
            ['默认库', selectedConnection?.defaultDatabase ?? '-'],
            ['连接类型', 'StarRocks FE'],
          ].map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-4 text-sm">
              <span className="shrink-0 text-muted-foreground">{label}</span>
              <span className="min-w-0 break-words text-right font-semibold text-slate-700">{value}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button size="sm" variant="primary" disabled={!selectedConnection} onClick={() => selectedConnection && setBrowsingConnection(selectedConnection)}>浏览</Button>
          <Button size="sm" disabled={!selectedConnection} onClick={() => selectedConnection && openEdit(selectedConnection)}>编辑</Button>
          <Button size="sm" variant="ghost" className="col-span-2" disabled={!selectedConnection} onClick={() => selectedConnection && setPendingDeleteConnection(selectedConnection)}>删除</Button>
        </div>
      </div>

      <Modal
        bodyClassName="flex min-h-0 p-0"
        cancelLabel="关闭"
        className="h-[92vh] max-w-[96vw]"
        onOpenChange={(open) => {
          if (!open) setBrowsingConnection(null);
        }}
        open={Boolean(browsingConnection)}
        showSubmit={false}
        title={`浏览 StarRocks · ${browsingConnection?.connectionName ?? ''}`}
      >
        <StarRocksBrowserSection connection={browsingConnection ?? undefined} />
      </Modal>

      <StarRocksFormModal
        form={form}
        onFormChange={setForm}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
        open={createOpen}
        submitLabel="添加"
        title="添加 StarRocks 连接"
        disabled={saving}
      />
      <StarRocksFormModal
        form={form}
        onFormChange={setForm}
        onOpenChange={(open) => {
          if (!open) setEditingConnection(null);
        }}
        onSubmit={handleUpdate}
        open={Boolean(editingConnection)}
        submitLabel="保存"
        title={`编辑 ${editingConnection?.connectionName ?? ''}`}
        disabled={saving}
      />
      <ConfirmModal
        confirmLabel="删除"
        description={`删除后将移除 StarRocks 连接「${pendingDeleteConnection?.connectionName ?? ''}」。`}
        onClose={() => setPendingDeleteConnection(null)}
        onConfirm={handleDelete}
        open={Boolean(pendingDeleteConnection)}
        title="删除 StarRocks 连接"
        tone="danger"
      />
    </div>
  );
}

function StarRocksBrowserSection({ connection }: { connection?: StarRocksConnectionResponse }) {
  const connectionId = connection?.id ?? 0;
  const [selectedDatabase, setSelectedDatabase] = useState('');
  const [selectedObject, setSelectedObject] = useState('');
  const [browserMode, setBrowserMode] = useState<'browse' | 'sql'>('browse');
  const [activeDetail, setActiveDetail] = useState<'definition' | 'schema' | 'partitions' | 'preview' | 'operations'>('definition');
  const [querySql, setQuerySql] = useState('');
  const [refreshVersion, setRefreshVersion] = useState(0);
  const refreshParams = refreshVersion > 0 ? { refresh: true } : undefined;
  const executeQuery = useExecuteStarRocksQuery();

  const databases = useListStarRocksDatabases(connectionId, refreshParams, {
    query: {
      enabled: Boolean(connectionId),
      retry: false,
    },
  });
  const databaseRows = databases.data ?? [];
  const selectedDatabaseExists = databaseRows.some((database) => database.databaseName === selectedDatabase);
  const resolvedDatabase = selectedDatabaseExists ? selectedDatabase : '';

  const objects = useListStarRocksObjects(connectionId, resolvedDatabase, refreshParams, {
    query: {
      enabled: Boolean(connectionId && resolvedDatabase),
      retry: false,
    },
  });
  const objectRows = objects.data ?? [];
  const selectedObjectExists = objectRows.some((object) => object.objectName === selectedObject);
  const resolvedObject = selectedObjectExists ? selectedObject : '';
  const selectedObjectInfo = objectRows.find((object) => object.objectName === resolvedObject);

  const schema = useGetStarRocksObjectSchema(connectionId, resolvedDatabase, resolvedObject, refreshParams, {
    query: {
      enabled: Boolean(connectionId && resolvedDatabase && resolvedObject && activeDetail === 'schema'),
      retry: false,
    },
  });
  const definition = useGetStarRocksObjectDefinition(connectionId, resolvedDatabase, resolvedObject, refreshParams, {
    query: {
      enabled: Boolean(connectionId && resolvedDatabase && resolvedObject && activeDetail === 'definition'),
      retry: false,
    },
  });
  const preview = usePreviewStarRocksObject(connectionId, resolvedDatabase, resolvedObject, { limit: 100 }, {
    query: {
      enabled: false,
      retry: false,
    },
  });
  const partitions = useListStarRocksObjectPartitions(connectionId, resolvedDatabase, resolvedObject, refreshParams, {
    query: {
      enabled: Boolean(connectionId && resolvedDatabase && resolvedObject && activeDetail === 'partitions'),
      retry: false,
    },
  });

  if (!connection) {
    return <div className="p-8 text-center text-sm font-medium text-muted-foreground">请选择 StarRocks 连接。</div>;
  }

  const loadingTree = databases.isFetching || objects.isFetching;
  const detailLoading = (activeDetail === 'definition' && definition.isFetching)
    || (activeDetail === 'schema' && schema.isFetching)
    || (activeDetail === 'partitions' && partitions.isFetching)
    || (activeDetail === 'preview' && preview.isFetching);
  const detailError = databases.error
    || (resolvedDatabase ? objects.error : null)
    || (resolvedDatabase && resolvedObject && activeDetail === 'definition' ? definition.error : null)
    || (resolvedDatabase && resolvedObject && activeDetail === 'schema' ? schema.error : null)
    || (resolvedDatabase && resolvedObject && activeDetail === 'partitions' ? partitions.error : null)
    || (resolvedDatabase && resolvedObject && activeDetail === 'preview' ? preview.error : null);
  const currentPreview = preview.data?.databaseName === resolvedDatabase && preview.data?.objectName === resolvedObject ? preview.data : undefined;
  const previewRows = currentPreview?.data ?? [];
  const previewColumns = currentPreview?.columns?.map((column) => column.name ?? '-') ?? [];
  const previewQueried = Boolean(currentPreview);
  const queryResult = executeQuery.data;
  const queryRows = queryResult?.data ?? [];
  const queryColumns = queryResult?.columns?.map((column) => column.name ?? '-') ?? [];
  const partitionRows = partitions.data?.data ?? [];
  const partitionColumns = partitions.data?.columns?.map((column) => column.name ?? '-') ?? [];

  function refreshBrowser() {
    setRefreshVersion((version) => version + 1);
    void databases.refetch();
    if (resolvedDatabase) void objects.refetch();
    if (resolvedDatabase && resolvedObject && activeDetail === 'definition') void definition.refetch();
    if (resolvedDatabase && resolvedObject && activeDetail === 'schema') void schema.refetch();
    if (resolvedDatabase && resolvedObject && activeDetail === 'partitions') void partitions.refetch();
    if (resolvedDatabase && resolvedObject && activeDetail === 'preview') void preview.refetch();
  }

  async function handleExecuteQuery() {
    if (!connectionId || !querySql.trim()) return;
    try {
      await executeQuery.mutateAsync({ id: connectionId, data: { sql: querySql, limit: 1000 } });
      if (!/^\s*(select|with|show|desc|describe|explain)\b/i.test(querySql)) {
        refreshBrowser();
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'StarRocks SQL 命令执行失败'));
    }
  }

  async function executeObjectCommand(sql: string, successMessage: string) {
    if (!connectionId) return;
    try {
      await executeQuery.mutateAsync({ id: connectionId, data: { sql, limit: 1000 } });
      toast.success(successMessage);
      refreshBrowser();
    } catch (error) {
      toast.error(getErrorMessage(error, 'StarRocks 对象操作失败'));
    }
  }

  return (
    <div className="grid min-h-0 h-full w-full flex-1 grid-rows-[auto_minmax(0,1fr)] bg-slate-50/60">
      <div className="flex items-center justify-between gap-4 border-b border-border-subtle bg-white px-5 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <DatabaseZap className="h-4 w-4 text-primary" />
            {connection.connectionName}
          </div>
          <div className="mt-1 truncate text-xs font-semibold text-slate-400">
            {connection.feAddress}:{connection.queryPort ?? 9030} / 默认库 {connection.defaultDatabase || 'scm'}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            variant={browserMode === 'browse' ? 'primary' : 'ghost'}
            className="h-8 px-3"
            onClick={() => setBrowserMode('browse')}
          >
            <Database className="h-3.5 w-3.5" />
            浏览
          </Button>
          <Button
            size="sm"
            variant={browserMode === 'sql' ? 'primary' : 'ghost'}
            className="h-8 px-3"
            onClick={() => setBrowserMode('sql')}
          >
            <Play className="h-3.5 w-3.5" />
            SQL 命令
          </Button>
          <Tooltip
            content="绕过 3 小时缓存，重新读取 Database、对象列表和当前详情"
            side="left"
            tooltipClassName="whitespace-normal w-60 text-left leading-4"
          >
            <Button size="sm" variant="ghost" className="h-8 px-3" onClick={refreshBrowser} disabled={loadingTree || detailLoading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loadingTree || detailLoading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </Tooltip>
        </div>
      </div>

      {browserMode === 'sql' ? (
        <div className="min-h-0 overflow-auto bg-white p-5">
          <StarRocksSqlCommandPanel
            columns={queryColumns}
            disabled={executeQuery.isPending}
            onChangeSql={setQuerySql}
            onSubmit={handleExecuteQuery}
            quickCommands={buildStarRocksQuickCommands(resolvedDatabase, resolvedObject)}
            queried={Boolean(queryResult)}
            rows={queryRows as Array<Record<string, unknown>>}
            sql={querySql}
          />
        </div>
      ) : (
      <div className="grid min-h-0 gap-0 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] border-r border-border-subtle bg-white">
          <div className="flex h-11 items-center justify-between border-b border-border-subtle px-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Database className="h-4 w-4 text-primary" />
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
                          setSelectedObject('');
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
                          {objects.isFetching ? (
                            <div className="px-2 py-3 text-xs font-semibold text-slate-400">加载对象...</div>
                          ) : objectRows.length ? (
                            objectRows.map((object) => {
                              const objectName = object.objectName ?? '';
                              const activeObject = resolvedObject === objectName;
                              return (
                                <button
                                  key={`${databaseName}.${objectName}`}
                                  type="button"
                                  onClick={() => setSelectedObject(objectName)}
                                  className={`flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs font-semibold transition ${
                                    activeObject ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                  }`}
                                >
                                  <Table2 className="h-3.5 w-3.5 shrink-0" />
                                  <span className="min-w-0 flex-1 truncate">{objectName}</span>
                                  <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-400">{objectTypeLabel(object.objectType)}</span>
                                </button>
                              );
                            })
                          ) : (
                            <div className="px-2 py-3 text-xs font-semibold text-slate-400">暂无对象</div>
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
              <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">当前对象</div>
              <div className="mt-1 truncate text-sm font-bold text-slate-900">
                {resolvedDatabase && resolvedObject ? `${resolvedDatabase}.${resolvedObject}` : '请选择对象'}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1 rounded-lg bg-slate-100 p-1">
              {[
                { key: 'definition', label: '定义', icon: FileText },
                { key: 'schema', label: 'Schema', icon: Columns3 },
                { key: 'partitions', label: '分区', icon: Table2 },
                { key: 'preview', label: '预览', icon: Eye },
                { key: 'operations', label: '操作', icon: Play },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActiveDetail(item.key as 'definition' | 'schema' | 'partitions' | 'preview' | 'operations')}
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
                StarRocks 浏览失败：{getErrorMessage(detailError, '请检查连接、账号权限和默认库')}
              </div>
            ) : !resolvedDatabase || !resolvedObject ? (
              <div className="flex h-full min-h-[360px] items-center justify-center text-sm font-medium text-muted-foreground">请选择左侧对象。</div>
            ) : detailLoading ? (
              <div className="flex h-full min-h-[360px] items-center justify-center text-sm font-medium text-muted-foreground">正在加载 StarRocks 元数据...</div>
            ) : activeDetail === 'operations' ? (
              <StarRocksObjectOperationsPanel
                databaseName={resolvedDatabase}
                disabled={executeQuery.isPending}
                objectName={resolvedObject}
                objectType={selectedObjectInfo?.objectType}
                onExecute={executeObjectCommand}
              />
            ) : activeDetail === 'definition' ? (
              <StarRocksDefinitionPanel definition={definition.data} />
            ) : activeDetail === 'schema' ? (
              <SimpleTable
                columns={['字段', '类型', '可空', '键', '默认值', '扩展']}
                rows={(schema.data?.columns ?? []).map((column) => [
                  column.name ?? '-',
                  column.type ?? '-',
                  column.nullable ?? '-',
                  column.key ?? '-',
                  column.defaultValue ?? '-',
                  column.extra ?? '-',
                ])}
                empty="暂无 Schema 信息"
              />
            ) : activeDetail === 'partitions' ? (
              partitionRows.length ? (
                <ObjectTable columns={partitionColumns} rows={partitionRows as Array<Record<string, unknown>>} />
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center text-sm font-medium text-slate-400">
                  {partitions.data ? '当前对象暂无分区信息' : '正在等待分区信息'}
                </div>
              )
            ) : activeDetail === 'preview' ? (
              <div className="grid min-h-[520px] w-full grid-rows-[auto_minmax(0,1fr)] gap-3">
                <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-700">数据预览</div>
                    <div className="mt-0.5 truncate text-xs font-semibold text-slate-500">直连 StarRocks 查询端口，默认限制 100 行。</div>
                  </div>
                  <Button size="sm" variant="primary" disabled={preview.isFetching} onClick={() => void preview.refetch()}>
                    {preview.isFetching ? '查询中...' : '查询预览'}
                  </Button>
                </div>
                {previewRows.length ? (
                  <ObjectTable columns={previewColumns} rows={previewRows as Array<Record<string, unknown>>} />
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
      )}
    </div>
  );
}

function StarRocksDefinitionPanel({ definition }: { definition?: StarRocksObjectDefinitionResponse }) {
  if (!definition) {
    return <div className="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center text-sm font-medium text-slate-400">暂无对象定义信息</div>;
  }
  const createSql = definition.createSql ?? '';

  async function copySql() {
    try {
      await navigator.clipboard.writeText(createSql);
      toast.success('定义 SQL 已复制');
    } catch {
      toast.error('复制失败，请手动复制');
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <DefinitionCard label="Database" value={definition.databaseName ?? '-'} />
        <DefinitionCard label="对象名" value={definition.objectName ?? '-'} />
        <DefinitionCard label="类型" value={objectTypeLabel(definition.objectType)} />
      </div>
      <div className="rounded-lg border border-border-subtle bg-slate-950 shadow-sm">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
          <div className="text-xs font-bold uppercase tracking-widest text-slate-400">CREATE SQL</div>
          <Button size="sm" variant="ghost" className="h-7 text-slate-200 hover:bg-white/10 hover:text-white" onClick={copySql}>
            复制 SQL
          </Button>
        </div>
        <pre className="max-h-[520px] overflow-auto p-4 text-xs leading-5 text-slate-100">
          <code>{createSql || '-- 暂无 DDL'}</code>
        </pre>
      </div>
    </div>
  );
}

function StarRocksObjectOperationsPanel({
  databaseName,
  disabled,
  objectName,
  objectType,
  onExecute,
}: {
  databaseName: string;
  disabled: boolean;
  objectName: string;
  objectType?: string | null;
  onExecute: (sql: string, successMessage: string) => void;
}) {
  const [pendingDanger, setPendingDanger] = useState<{ label: string; sql: string; successMessage: string } | null>(null);
  const [partitionStart, setPartitionStart] = useState('');
  const [partitionEnd, setPartitionEnd] = useState('');
  const qualifiedName = `${quoteSqlIdentifier(databaseName)}.${quoteSqlIdentifier(objectName)}`;
  const isMaterializedView = objectType === 'MATERIALIZED_VIEW';
  const isView = objectType === 'VIEW';
  const dropSql = isMaterializedView
    ? `DROP MATERIALIZED VIEW ${qualifiedName};`
    : isView
      ? `DROP VIEW ${qualifiedName};`
      : `DROP TABLE ${qualifiedName};`;

  function executeSafe(sql: string, successMessage: string) {
    setPendingDanger(null);
    onExecute(sql, successMessage);
  }

  return (
    <div className="space-y-4">
      <OperationSection
        description={isMaterializedView ? '物化视图刷新相关维护操作集中在这里。' : '当前对象不是物化视图，刷新维护不可用。'}
        title="刷新维护"
      >
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="grid gap-3 md:grid-cols-3">
            <OperationCard
              title="全量刷新"
              description={isMaterializedView ? '重算物化视图全量数据。' : '仅物化视图支持。'}
              actionLabel="全量刷新"
              disabled={disabled || !isMaterializedView}
              onAction={() => executeSafe(`REFRESH MATERIALIZED VIEW ${qualifiedName} COMPLETE;`, '物化视图全量刷新已提交')}
            />
            <OperationCard
              title="强制刷新"
              description={isMaterializedView ? '忽略常规判断，强制触发刷新。' : '仅物化视图支持。'}
              actionLabel="强制刷新"
              disabled={disabled || !isMaterializedView}
              onAction={() => executeSafe(`REFRESH MATERIALIZED VIEW ${qualifiedName} FORCE;`, '物化视图强制刷新已提交')}
            />
            <OperationCard
              title="取消刷新"
              description={isMaterializedView ? '取消当前物化视图刷新任务。' : '仅物化视图支持。'}
              actionLabel="取消刷新"
              disabled={disabled || !isMaterializedView}
              onAction={() => executeSafe(`CANCEL REFRESH MATERIALIZED VIEW ${qualifiedName};`, '物化视图刷新已取消')}
            />
          </div>
          <div className="rounded-lg border border-border-subtle bg-slate-50 p-4">
            <div className="text-sm font-bold text-slate-900">按分区刷新</div>
            <div className="mt-1 text-xs font-semibold text-slate-500">填写分区起止范围后直接执行。格式按 StarRocks 分区定义填写，例如日期分区可填 2026-01-01 到 2026-01-02。</div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Field
                label="START"
                value={partitionStart}
                onChange={(event) => setPartitionStart(event.target.value)}
                placeholder="2026-01-01"
              />
              <Field
                label="END"
                value={partitionEnd}
                onChange={(event) => setPartitionEnd(event.target.value)}
                placeholder="2026-01-02"
              />
            </div>
            <div className="mt-3 flex justify-end">
              <Button
                size="sm"
                variant="primary"
                disabled={disabled || !isMaterializedView || !partitionStart.trim() || !partitionEnd.trim()}
                onClick={() => executeSafe(
                  `REFRESH MATERIALIZED VIEW ${qualifiedName} PARTITION START("${partitionStart.trim()}") END("${partitionEnd.trim()}");`,
                  '物化视图分区刷新已提交',
                )}
              >
                执行分区刷新
              </Button>
            </div>
          </div>
        </div>
      </OperationSection>

      <OperationSection description="这些操作会改变或删除当前对象，请确认影响范围后再执行。" title="危险操作">
        <div className="grid gap-3 md:grid-cols-2">
          <OperationCard
            title="清空表"
            description={isView || isMaterializedView ? '视图/物化视图不支持清空。' : '清空当前表全部数据。'}
            actionLabel="准备清空"
            tone="danger"
            disabled={disabled || isView || isMaterializedView}
            onAction={() => setPendingDanger({ label: '确认清空表', sql: `TRUNCATE TABLE ${qualifiedName};`, successMessage: '表数据已清空' })}
          />
          <OperationCard
            title="删除对象"
            description="删除当前表、视图或物化视图。"
            actionLabel="准备删除"
            tone="danger"
            disabled={disabled}
            onAction={() => setPendingDanger({ label: '确认删除对象', sql: dropSql, successMessage: '对象已删除' })}
          />
        </div>
      </OperationSection>

      {pendingDanger ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
          <div className="text-sm font-bold text-rose-800">{pendingDanger.label}</div>
          <div className="mt-1 text-xs font-semibold leading-5 text-rose-700">请确认要执行以下 SQL。该操作不可撤销。</div>
          <pre className="mt-3 overflow-auto rounded-md bg-white p-3 text-xs font-semibold text-rose-900">{pendingDanger.sql}</pre>
          <div className="mt-3 flex justify-end gap-2">
            <Button size="sm" onClick={() => setPendingDanger(null)} disabled={disabled}>取消</Button>
            <Button size="sm" variant="primary" className="bg-rose-600 hover:bg-rose-700" disabled={disabled} onClick={() => executeSafe(pendingDanger.sql, pendingDanger.successMessage)}>
              确认执行
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function OperationSection({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="rounded-xl border border-border-subtle bg-white p-4 shadow-sm">
      <div className="mb-4 border-b border-border-subtle pb-3">
        <div className="text-sm font-bold text-slate-900">{title}</div>
        <div className="mt-1 text-xs font-semibold text-slate-500">{description}</div>
      </div>
      {children}
    </section>
  );
}

function OperationCard({
  actionLabel,
  description,
  disabled,
  onAction,
  title,
  tone = 'default',
}: {
  actionLabel: string;
  description: string;
  disabled?: boolean;
  onAction: () => void;
  title: string;
  tone?: 'default' | 'danger';
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-white p-4 shadow-sm">
      <div className="text-sm font-bold text-slate-900">{title}</div>
      <div className="mt-1 min-h-10 text-xs font-semibold leading-5 text-slate-500">{description}</div>
      <Button
        size="sm"
        variant={tone === 'danger' ? 'ghost' : 'primary'}
        className={tone === 'danger' ? 'mt-3 text-rose-600 hover:bg-rose-50 hover:text-rose-700' : 'mt-3'}
        disabled={disabled}
        onClick={onAction}
      >
        {actionLabel}
      </Button>
    </div>
  );
}

function StarRocksSqlCommandPanel({
  columns,
  disabled,
  onChangeSql,
  onSubmit,
  quickCommands,
  queried,
  rows,
  sql,
}: {
  columns: string[];
  disabled: boolean;
  onChangeSql: (sql: string) => void;
  onSubmit: () => void;
  quickCommands: Array<{ label: string; sql: string }>;
  queried: boolean;
  rows: Array<Record<string, unknown>>;
  sql: string;
}) {
  return (
    <div className="grid min-h-[620px] w-full grid-rows-[auto_auto_minmax(0,1fr)] gap-3">
      <div className="rounded-lg border border-sky-100 bg-sky-50 px-4 py-3 text-xs font-semibold leading-5 text-sky-800">
        SQL 命令支持对当前 StarRocks 连接执行单条 SQL。SELECT/WITH 未写 LIMIT 时后端默认追加 LIMIT 1000；DDL 或刷新类命令执行后会刷新资源目录缓存。
      </div>
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-h-[260px] overflow-hidden rounded-lg border border-border-subtle xl:col-span-1">
          <SqlCodeEditor
            content={sql}
            onChange={onChangeSql}
            onSubmit={onSubmit}
            placeholder={`SELECT * FROM scm.example_table;\n\nCREATE TABLE scm.example_table (\n  id BIGINT,\n  name VARCHAR(128)\n)\nDUPLICATE KEY(id)\nDISTRIBUTED BY HASH(id) BUCKETS 8\nPROPERTIES ("replication_num" = "1");`}
            submitDisabled={disabled || !sql.trim()}
          />
        </div>
        <div className="flex flex-col justify-between gap-3">
          <div className="w-44 space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">快捷命令</div>
            {quickCommands.map((command) => (
              <button
                key={command.label}
                type="button"
                className="block w-full rounded-md border border-border-subtle bg-white px-2.5 py-2 text-left text-xs font-bold text-slate-600 transition hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                onClick={() => onChangeSql(command.sql)}
              >
                {command.label}
              </button>
            ))}
          </div>
          <Button variant="primary" disabled={disabled || !sql.trim()} onClick={onSubmit}>
            {disabled ? '执行中...' : '执行 SQL'}
          </Button>
        </div>
      </div>
      {rows.length ? (
        <ObjectTable columns={columns} rows={rows} />
      ) : (
        <div className="flex min-h-[260px] items-center justify-center rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center text-sm font-medium text-slate-400">
          {queried ? '执行完成，暂无结果集' : '输入 SQL 后点击「执行 SQL」，查询默认最多返回 1000 行'}
        </div>
      )}
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

function SimpleTable({ columns, empty, rows }: { columns: string[]; empty: string; rows: Array<Array<string>> }) {
  if (!rows.length) {
    return <div className="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center text-sm font-medium text-slate-400">{empty}</div>;
  }
  return (
    <div className="w-full overflow-auto rounded-lg border border-border-subtle">
      <table className="w-full table-fixed text-left text-xs">
        <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500">
          <tr>{columns.map((column) => <th key={column} className="px-3 py-2 font-bold">{column}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border-subtle bg-white">
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((value, valueIndex) => <td key={valueIndex} className="truncate px-3 py-2 font-medium text-slate-700" title={value}>{value}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ObjectTable({ columns, rows }: { columns: string[]; rows: Array<Record<string, unknown>> }) {
  const resolvedColumns = columns.length ? columns : Object.keys(rows[0] ?? {});
  const tableWidth = resolvedColumns.length > 8 ? `${resolvedColumns.length * 10}rem` : '100%';
  return (
    <div className="w-full overflow-auto rounded-lg border border-border-subtle">
      <table className="table-fixed text-left text-xs" style={{ width: tableWidth }}>
        <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500">
          <tr>{resolvedColumns.map((column) => <th key={column} className="px-3 py-2 font-bold">{column}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border-subtle bg-white">
          {rows.map((row, index) => (
            <tr key={index}>
              {resolvedColumns.map((column) => (
                <td key={column} className="truncate px-3 py-2 font-medium text-slate-700" title={formatCell(row[column])}>
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

function objectTypeLabel(type?: string | null) {
  if (type === 'MATERIALIZED_VIEW') return '物化视图';
  if (type === 'VIEW') return '视图';
  return '表';
}

function buildStarRocksQuickCommands(databaseName: string, objectName: string) {
  const commands = [
    { label: '查看库', sql: 'SHOW DATABASES;' },
  ];
  if (databaseName) {
    commands.push(
      { label: '查看对象', sql: `SHOW FULL TABLES FROM ${quoteSqlIdentifier(databaseName)};` },
      { label: '建表模板', sql: buildCreateTableTemplate(databaseName) },
      { label: '物化视图模板', sql: buildMaterializedViewTemplate(databaseName) },
    );
  }
  if (databaseName && objectName) {
    const qualifiedName = `${quoteSqlIdentifier(databaseName)}.${quoteSqlIdentifier(objectName)}`;
    commands.push(
      { label: '查询前 1000 行', sql: `SELECT * FROM ${qualifiedName} LIMIT 1000;` },
      { label: '查看 Schema', sql: `DESCRIBE ${qualifiedName};` },
      { label: '查看定义', sql: `SHOW CREATE TABLE ${qualifiedName};` },
    );
  }
  return commands;
}

function quoteSqlIdentifier(identifier: string) {
  return `\`${identifier.replaceAll('`', '``')}\``;
}

function buildCreateTableTemplate(databaseName: string) {
  return `CREATE TABLE ${quoteSqlIdentifier(databaseName)}.\`example_table\` (
  id BIGINT,
  name VARCHAR(128)
)
DUPLICATE KEY(id)
DISTRIBUTED BY HASH(id) BUCKETS 8
PROPERTIES ("replication_num" = "1");`;
}

function buildMaterializedViewTemplate(databaseName: string) {
  return `CREATE MATERIALIZED VIEW ${quoteSqlIdentifier(databaseName)}.\`example_mv\`
DISTRIBUTED BY RANDOM
REFRESH ASYNC
PROPERTIES ("replication_num" = "1")
AS
SELECT *
FROM ${quoteSqlIdentifier(databaseName)}.\`source_table\`
LIMIT 1000;`;
}

function StarRocksFormModal({
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
  form: StarRocksConnectionRequest;
  onFormChange: (form: StarRocksConnectionRequest) => void;
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
          label="连接名称"
          value={form.connectionName}
          onChange={(event) => onFormChange({ ...form, connectionName: event.target.value })}
          placeholder="starrocks"
        />
        <Field
          label="FE 地址"
          value={form.feAddress}
          onChange={(event) => onFormChange({ ...form, feAddress: event.target.value })}
          placeholder="192.168.103.201"
        />
        <Field
          label="查询端口"
          type="number"
          value={form.queryPort}
          onChange={(event) => onFormChange({ ...form, queryPort: Number(event.target.value) })}
          placeholder="9030"
        />
        <Field
          label="默认库"
          value={form.defaultDatabase}
          onChange={(event) => onFormChange({ ...form, defaultDatabase: event.target.value })}
          placeholder="scm"
        />
        <Field
          label="用户名"
          value={form.username}
          onChange={(event) => onFormChange({ ...form, username: event.target.value })}
          placeholder="root"
        />
        <Field
          label="密码"
          type="password"
          value={form.password ?? ''}
          onChange={(event) => onFormChange({ ...form, password: event.target.value })}
          placeholder="留空则编辑时保留原密码"
        />
        <div className="md:col-span-2">
          <Field
            label="描述"
            value={form.description ?? ''}
            onChange={(event) => onFormChange({ ...form, description: event.target.value })}
            placeholder="用于数据资源浏览和预览查询"
          />
        </div>
      </div>
    </Modal>
  );
}
