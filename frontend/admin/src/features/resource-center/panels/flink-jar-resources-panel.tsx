'use client';

import { useMemo, useState } from 'react';
import { Package, Search, Upload } from 'lucide-react';
import {
  type FlinkJarResourceRequest,
  type FlinkJarResourceResponse,
  useCreateFlinkJarResource,
  useDeleteFlinkJarResource,
  useListFlinkJarResources,
  useUpdateFlinkJarResource,
  useUploadFlinkJarResource,
} from '@/shared/api/generated';
import { Button, ConfirmModal, Field, Modal, SelectField } from '@/components/ui';
import { ConnectionStatusBadge } from '@/features/resource-center/components/connection-status-badge';
import { ResourcePanelSkeleton } from '@/features/resource-center/components/resource-panel-skeleton';
import {
  connectionStatusLabel,
  emptyFlinkJarForm,
  inferJarResourceName,
  inferJarResourceVersion,
  normalizeFlinkJarForm,
} from '@/features/resource-center/lib/resource-center-forms';
import { getErrorMessage } from '@/lib/error-message';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function FlinkJarResourcesPanel() {
  const resources = useListFlinkJarResources(undefined, { query: { refetchOnMount: 'always' } });
  const createResource = useCreateFlinkJarResource();
  const updateResource = useUpdateFlinkJarResource();
  const deleteResource = useDeleteFlinkJarResource();
  const uploadResource = useUploadFlinkJarResource();
  const rows = useMemo(() => resources.data?.list ?? [], [resources.data?.list]);
  const [keyword, setKeyword] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<FlinkJarResourceResponse | null>(null);
  const [pendingDeleteResource, setPendingDeleteResource] = useState<FlinkJarResourceResponse | null>(null);
  const [form, setForm] = useState<FlinkJarResourceRequest>(emptyFlinkJarForm);
  const filteredRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (!normalizedKeyword) return rows;
    return rows.filter((row) =>
      [row.resourceName, row.resourceVersion, row.compatibleFlinkVersion, row.storageUri, row.status]
        .join(' ')
        .toLowerCase()
        .includes(normalizedKeyword),
    );
  }, [keyword, rows]);
  const selectedResource = filteredRows.find((row) => row.id === selectedId) ?? filteredRows[0];
  const saving = uploading || uploadResource.isPending || createResource.isPending || updateResource.isPending || deleteResource.isPending;
  const initialLoading = !resources.data && (resources.isLoading || resources.isFetching);

  function resetForm() {
    setForm(emptyFlinkJarForm);
  }

  function openCreate() {
    resetForm();
    setCreateOpen(true);
  }

  function openUpload() {
    resetForm();
    setUploadFile(null);
    setUploadOpen(true);
  }

  function handleUploadFileChange(file: File | null) {
    setUploadFile(file);
    if (!file) return;
    setForm((current) => ({
      ...current,
      resourceName: current.resourceName || inferJarResourceName(file.name),
      resourceVersion: !current.resourceVersion || current.resourceVersion === '1.0.0'
        ? inferJarResourceVersion(file.name)
        : current.resourceVersion,
    }));
  }

  function openEdit(resource: FlinkJarResourceResponse) {
    setForm({
      checksum: resource.checksum ?? '',
      compatibleFlinkVersion: resource.compatibleFlinkVersion ?? '2.x',
      resourceName: resource.resourceName ?? '',
      resourceVersion: resource.resourceVersion ?? '1.0.0',
      status: resource.status ?? 'ACTIVE',
      storageUri: resource.storageUri ?? '',
    });
    setEditingResource(resource);
  }

  async function handleCreate() {
    try {
      await createResource.mutateAsync({ data: normalizeFlinkJarForm(form) });
      toast.success(`Flink JAR「${form.resourceName}」已添加`);
      setCreateOpen(false);
      resetForm();
      await resources.refetch();
    } catch (error) {
      toast.error(getErrorMessage(error, '添加 Flink JAR 资源失败'));
    }
  }

  async function handleUpload() {
    if (!uploadFile) {
      toast.error('请选择 JAR 文件');
      return;
    }
    try {
      setUploading(true);
      const payload = normalizeFlinkJarForm({ ...form, storageUri: 's3://upload-placeholder' });
      const uploaded = await uploadResource.mutateAsync({
        data: { file: uploadFile },
        params: {
          compatibleFlinkVersion: payload.compatibleFlinkVersion ?? '2.x',
          resourceName: payload.resourceName || inferJarResourceName(uploadFile.name),
          resourceVersion: payload.resourceVersion || inferJarResourceVersion(uploadFile.name),
          status: payload.status ?? 'ACTIVE',
        },
      });
      toast.success(`Flink JAR「${uploaded.resourceName ?? payload.resourceName}」已上传`);
      setUploadOpen(false);
      setUploadFile(null);
      resetForm();
      await resources.refetch();
      setSelectedId(uploaded.id ?? null);
    } catch (error) {
      toast.error(getErrorMessage(error, '上传 Flink JAR 资源失败'));
    } finally {
      setUploading(false);
    }
  }

  async function handleUpdate() {
    if (!editingResource?.id) return;
    try {
      await updateResource.mutateAsync({ id: editingResource.id, data: normalizeFlinkJarForm(form) });
      toast.success(`Flink JAR「${form.resourceName}」已更新`);
      setEditingResource(null);
      resetForm();
      await resources.refetch();
    } catch (error) {
      toast.error(getErrorMessage(error, '更新 Flink JAR 资源失败'));
    }
  }

  async function handleDelete() {
    if (!pendingDeleteResource?.id) return;
    try {
      await deleteResource.mutateAsync({ id: pendingDeleteResource.id });
      toast.success(`Flink JAR「${pendingDeleteResource.resourceName}」已删除`);
      setPendingDeleteResource(null);
      if (selectedId === pendingDeleteResource.id) {
        setSelectedId(null);
      }
      await resources.refetch();
    } catch (error) {
      toast.error(getErrorMessage(error, '删除 Flink JAR 资源失败'));
    }
  }

  return (
    initialLoading ? <ResourcePanelSkeleton metrics={2} /> :
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 border border-border-subtle bg-white">
        <div className="flex flex-col gap-3 border-b border-border-subtle px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <h3 className="text-base font-bold text-foreground">Flink JAR 资源</h3>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="primary" onClick={openUpload}>
              <Upload className="h-3.5 w-3.5" />
              上传 JAR
            </Button>
            <Button size="sm" onClick={openCreate}>登记已有 S3</Button>
          </div>
        </div>
        <div className="grid gap-3 border-b border-border-subtle p-5 md:grid-cols-2">
          {[
            ['JAR', String(rows.length)],
            ['启用', String(rows.filter((row) => row.status === 'ACTIVE').length)],
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
              placeholder="搜索 JAR 资源"
              className="h-9 w-full rounded-lg border border-border bg-white pl-9 pr-3 text-sm placeholder-slate-400 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[920px]">
            <div className="grid grid-cols-[1.1fr_0.7fr_0.8fr_2fr_6rem] bg-slate-50 px-4 py-2.5 text-xs font-bold text-muted-foreground">
              <span>名称</span>
              <span>版本</span>
              <span>兼容</span>
              <span>S3 地址</span>
              <span className="text-right">状态</span>
            </div>
            {filteredRows.length > 0 ? (
              filteredRows.map((row) => {
                const selected = selectedResource?.id === row.id;
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setSelectedId(row.id ?? null)}
                    className={cn(
                      'grid w-full grid-cols-[1.1fr_0.7fr_0.8fr_2fr_6rem] border-t border-border-subtle px-4 py-3 text-left text-sm transition-colors',
                      selected ? 'bg-primary/5' : 'hover:bg-slate-50',
                    )}
                  >
                    <span className="min-w-0 truncate font-bold text-slate-900">{row.resourceName}</span>
                    <span className="min-w-0 truncate text-slate-600">{row.resourceVersion}</span>
                    <span className="min-w-0 truncate text-slate-600">{row.compatibleFlinkVersion}</span>
                    <span className="min-w-0 truncate text-slate-600">{row.storageUri}</span>
                    <span className="text-right"><ConnectionStatusBadge status={connectionStatusLabel(row.status)} /></span>
                  </button>
                );
              })
            ) : (
              <div className="border-t border-border-subtle px-4 py-10 text-center text-sm font-medium text-muted-foreground">
                {rows.length === 0 ? '暂无 Flink JAR 资源，请添加依赖资源。' : '没有匹配的 JAR 资源'}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border border-border-subtle bg-white p-5">
        <div className="flex items-center justify-between gap-3 border-b border-border-subtle pb-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">当前选择</div>
            <div className="mt-1 text-base font-bold text-foreground">{selectedResource?.resourceName ?? '-'}</div>
          </div>
          {selectedResource ? <ConnectionStatusBadge status={connectionStatusLabel(selectedResource.status)} /> : null}
        </div>
        <div className="mt-4 space-y-3">
          {[
            ['版本', selectedResource?.resourceVersion ?? '-'],
            ['兼容 Flink', selectedResource?.compatibleFlinkVersion ?? '-'],
            ['Checksum', selectedResource?.checksum ?? '-'],
            ['S3 地址', selectedResource?.storageUri ?? '-'],
          ].map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-4 text-sm">
              <span className="shrink-0 text-muted-foreground">{label}</span>
              <span className="min-w-0 break-words text-right font-semibold text-slate-700">{value}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button size="sm" disabled={!selectedResource} onClick={() => selectedResource && openEdit(selectedResource)}>编辑</Button>
          <Button size="sm" variant="ghost" disabled={!selectedResource} onClick={() => selectedResource && setPendingDeleteResource(selectedResource)}>删除</Button>
        </div>
      </div>

      <FlinkJarUploadModal
        disabled={saving}
        file={uploadFile}
        form={form}
        onFileChange={handleUploadFileChange}
        onFormChange={setForm}
        onOpenChange={setUploadOpen}
        onSubmit={handleUpload}
        open={uploadOpen}
      />
      <FlinkJarFormModal disabled={saving} form={form} onFormChange={setForm} onOpenChange={setCreateOpen} onSubmit={handleCreate} open={createOpen} submitLabel="添加" title="登记已有 S3 JAR" />
      <FlinkJarFormModal
        disabled={saving}
        form={form}
        onFormChange={setForm}
        onOpenChange={(open) => {
          if (!open) setEditingResource(null);
        }}
        onSubmit={handleUpdate}
        open={Boolean(editingResource)}
        submitLabel="保存"
        title={`编辑 ${editingResource?.resourceName ?? ''}`}
      />
      <ConfirmModal confirmLabel="删除" description={`删除后将移除 Flink JAR「${pendingDeleteResource?.resourceName ?? ''}」。`} onClose={() => setPendingDeleteResource(null)} onConfirm={handleDelete} open={Boolean(pendingDeleteResource)} title="删除 Flink JAR 资源" tone="danger" />
    </div>
  );
}

function FlinkJarUploadModal({
  disabled,
  file,
  form,
  onFileChange,
  onFormChange,
  onOpenChange,
  onSubmit,
  open,
}: {
  disabled?: boolean;
  file: File | null;
  form: FlinkJarResourceRequest;
  onFileChange: (file: File | null) => void;
  onFormChange: (form: FlinkJarResourceRequest) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
  open: boolean;
}) {
  return (
    <Modal disabled={disabled} onOpenChange={onOpenChange} open={open} submitLabel="上传" title="上传 Flink JAR" onSubmit={onSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">JAR 文件</span>
          <input
            type="file"
            accept=".jar"
            disabled={disabled}
            onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
            className="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          />
          {file ? <span className="mt-1.5 block truncate text-xs font-semibold text-muted-foreground">{file.name}</span> : null}
        </label>
        <Field label="资源名称" value={form.resourceName} onChange={(event) => onFormChange({ ...form, resourceName: event.target.value })} placeholder={inferJarResourceName(file?.name) || 'paimon-s3-bundle'} />
        <Field label="版本" value={form.resourceVersion ?? ''} onChange={(event) => onFormChange({ ...form, resourceVersion: event.target.value })} placeholder="1.0.0" />
        <Field label="兼容 Flink 版本" value={form.compatibleFlinkVersion ?? ''} onChange={(event) => onFormChange({ ...form, compatibleFlinkVersion: event.target.value })} placeholder="2.x" />
        <SelectField
          label="状态"
          value={form.status ?? 'ACTIVE'}
          onValueChange={(value) => onFormChange({ ...form, status: value })}
          options={[
            { label: '启用', value: 'ACTIVE' },
            { label: '停用', value: 'INACTIVE' },
          ]}
        />
      </div>
    </Modal>
  );
}

function FlinkJarFormModal({
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
  form: FlinkJarResourceRequest;
  onFormChange: (form: FlinkJarResourceRequest) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
  open: boolean;
  submitLabel: string;
  title: string;
}) {
  return (
    <Modal disabled={disabled} onOpenChange={onOpenChange} open={open} submitLabel={submitLabel} title={title} onSubmit={onSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="资源名称" value={form.resourceName} onChange={(event) => onFormChange({ ...form, resourceName: event.target.value })} placeholder="paimon-s3-bundle" />
        <Field label="版本" value={form.resourceVersion ?? ''} onChange={(event) => onFormChange({ ...form, resourceVersion: event.target.value })} placeholder="1.0.0" />
        <Field label="兼容 Flink 版本" value={form.compatibleFlinkVersion ?? ''} onChange={(event) => onFormChange({ ...form, compatibleFlinkVersion: event.target.value })} placeholder="2.x" />
        <SelectField
          label="状态"
          value={form.status ?? 'ACTIVE'}
          onValueChange={(value) => onFormChange({ ...form, status: value })}
          options={[
            { label: '启用', value: 'ACTIVE' },
            { label: '停用', value: 'INACTIVE' },
          ]}
        />
        <div className="md:col-span-2">
          <Field label="S3 地址" value={form.storageUri} onChange={(event) => onFormChange({ ...form, storageUri: event.target.value })} placeholder="s3://rayflow-artifacts/flink-jars/default/connector/1.0.0/connector-1.0.0.jar" />
        </div>
        <div className="md:col-span-2">
          <Field label="Checksum" value={form.checksum ?? ''} onChange={(event) => onFormChange({ ...form, checksum: event.target.value })} placeholder="sha256:..." />
        </div>
      </div>
    </Modal>
  );
}
