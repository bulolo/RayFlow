'use client';

import { useState } from 'react';
import { ArrowLeft, CircleAlert, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import {
  type TenantRequest,
  type TenantResponse,
  useCreatePlatformTenant,
  useDeletePlatformTenant,
  useListPlatformTenants,
  useUpdatePlatformTenant,
} from '@/shared/api/generated';
import { isPlatformSuperAdmin } from '@/shared/auth/roles';
import { useAuthStore } from '@/stores/auth-store';
import { Badge, Button, Card as UiCard, ConfirmModal, Field, SelectField, Textarea, SectionCard, SectionHeader } from '@/components/ui';
import { TableEmpty, TablePagination, TableShell, TableToolbar } from '@/components/data-display/table-shell';
import { useAuthTokenState } from '@/hooks/use-auth-token-state';

type TenantForm = Omit<Required<TenantRequest>, 'status' | 'description'> & {
  status: 'ACTIVE' | 'INACTIVE';
  description: string;
};

const emptyForm: TenantForm = {
  tenantName: '',
  tenantSlug: '',
  status: 'ACTIVE',
  description: '',
  adminUsername: '',
  adminPassword: '',
  adminNickname: '',
  adminEmail: '',
};

const statusLabel: Record<string, string> = {
  ACTIVE: '启用',
  INACTIVE: '停用',
};

const tenantSlugPattern = /^[a-z0-9][a-z0-9-]{1,62}$/;

export function Tenants() {
  const hasToken = useAuthTokenState();
  const user = useAuthStore((state) => state.user);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TenantResponse | null>(null);
  const [pendingDeleteTenant, setPendingDeleteTenant] = useState<TenantResponse | null>(null);
  const [form, setForm] = useState<TenantForm>(emptyForm);

  const tenants = useListPlatformTenants(
    { is_pager: 1, keyword: keyword.trim() || undefined, page, size: pageSize },
    { query: { enabled: hasToken && isPlatformSuperAdmin(user) } },
  );
  const createTenant = useCreatePlatformTenant();
  const updateTenant = useUpdatePlatformTenant();
  const deleteTenant = useDeletePlatformTenant();

  async function handleSubmit() {
    if (!canSubmit) {
      return;
    }
    if (editing) {
      if (!editing.id) return;
      await updateTenant.mutateAsync({
        id: editing.id,
        data: {
          tenantName: form.tenantName,
          tenantSlug: form.tenantSlug,
          status: form.status,
          description: form.description,
        },
      });
    } else {
      await createTenant.mutateAsync({
        data: form,
      });
    }
    setFormOpen(false);
    setEditing(null);
    setForm(emptyForm);
    void tenants.refetch();
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(tenant: TenantResponse) {
    setEditing(tenant);
    setForm({
      tenantName: tenant.tenantName ?? '',
      tenantSlug: tenant.tenantSlug ?? '',
      status: tenant.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      description: tenant.description ?? '',
      adminUsername: '',
      adminPassword: '',
      adminNickname: '',
      adminEmail: '',
    });
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setForm(emptyForm);
  }

  async function handleDelete(tenant: TenantResponse) {
    if (!tenant.id) return;
    await deleteTenant.mutateAsync({ id: tenant.id });
    setPendingDeleteTenant(null);
    void tenants.refetch();
  }

  const rows = tenants.data?.list ?? [];
  const total = tenants.data?.pagination?.total ?? rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const tenantNameError = form.tenantName.trim() ? '' : '组织名称不能为空';
  const tenantSlugError = !form.tenantSlug.trim()
    ? '组织标识不能为空'
    : tenantSlugPattern.test(form.tenantSlug)
      ? ''
      : '组织标识仅支持小写字母、数字和中划线，且长度需在 2-63 之间';
  const adminUsernameError = !editing && !form.adminUsername.trim() ? '管理员用户名不能为空' : '';
  const adminPasswordError = !editing && form.adminPassword.length < 8 ? '管理员密码至少 8 位' : '';
  const adminEmailError =
    !editing && form.adminEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.adminEmail.trim())
      ? '请输入合法的邮箱地址'
      : '';
  const canSubmit = editing
    ? !tenantNameError && !tenantSlugError
    : !tenantNameError && !tenantSlugError && !adminUsernameError && !adminPasswordError && !adminEmailError;

  if (!isPlatformSuperAdmin(user)) {
    return (
      <UiCard className="p-6">
        <div className="text-sm font-semibold text-foreground">仅超级管理员可管理组织开通。</div>
        <div className="mt-2 text-sm text-muted-foreground">当前账号没有平台管理权限。</div>
      </UiCard>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <SectionHeader
        title={formOpen ? (editing ? '编辑组织' : '创建组织') : '组织管理'}
        description={formOpen ? '当前为单页表单模式，完成后返回组织列表。' : '在平台侧统一开通组织，并同步创建初始租户管理员账号。'}
        action={
          formOpen ? (
            <Button onClick={closeForm} className="h-9 px-4 text-xs font-bold">
              <ArrowLeft className="h-4 w-4" />
              返回列表
            </Button>
          ) : (
            <Button variant="primary" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              创建组织
            </Button>
          )
        }
      />

      {formOpen ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-6">
            <SectionCard title="组织信息">
              <div className="grid gap-4 p-5 md:grid-cols-2">
                <Field label="组织名称" value={form.tenantName} onChange={(event) => setForm((current) => ({ ...current, tenantName: event.target.value }))} />
                {tenantNameError ? <p className="-mt-2 text-[11px] font-medium text-rose-600 md:col-span-2">{tenantNameError}</p> : null}
                <Field label="组织标识" value={form.tenantSlug} onChange={(event) => setForm((current) => ({ ...current, tenantSlug: event.target.value.toLowerCase() }))} />
                {tenantSlugError ? <p className="-mt-2 text-[11px] font-medium text-rose-600 md:col-span-2">{tenantSlugError}</p> : null}
                <SelectField
                  label="状态"
                  value={form.status}
                  onValueChange={(value) => setForm((current) => ({ ...current, status: value as TenantForm['status'] }))}
                  options={[
                    { label: '启用', value: 'ACTIVE' },
                    { label: '停用', value: 'INACTIVE' },
                  ]}
                />
                <div className="rounded-xl border border-dashed border-border-subtle bg-zinc-50/70 px-4 py-3">
                  <div className="text-xs font-bold text-slate-700">组织路由标识</div>
                  <p className="mt-1 text-[11px] leading-5 text-slate-500">
                    建议使用稳定的英文短名，例如 `retail-data`、`risk-lab`。后续接口会基于该标识进行租户路由。
                  </p>
                </div>
                <div className="md:col-span-2">
                  <Textarea
                    label="说明"
                    rows={3}
                    value={form.description ?? ''}
                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  />
                </div>
              </div>
            </SectionCard>

            {!editing ? (
              <SectionCard title="组织管理员信息">
                <div className="grid gap-4 p-5 md:grid-cols-2">
                  <Field
                    label="管理员用户名"
                    placeholder="请输入用户名，例如 ops-admin"
                    value={form.adminUsername}
                    onChange={(event) => setForm((current) => ({ ...current, adminUsername: event.target.value }))}
                  />
                  {adminUsernameError ? <p className="-mt-2 text-[11px] font-medium text-rose-600 md:col-span-2">{adminUsernameError}</p> : null}
                  <Field
                    label="管理员密码"
                    type="password"
                    placeholder="至少 8 位"
                    value={form.adminPassword}
                    onChange={(event) => setForm((current) => ({ ...current, adminPassword: event.target.value }))}
                  />
                  {adminPasswordError ? <p className="-mt-2 text-[11px] font-medium text-rose-600 md:col-span-2">{adminPasswordError}</p> : null}
                  <Field
                    label="管理员昵称"
                    placeholder="请输入管理员显示名称"
                    value={form.adminNickname}
                    onChange={(event) => setForm((current) => ({ ...current, adminNickname: event.target.value }))}
                  />
                  <Field
                    label="管理员邮箱"
                    type="email"
                    placeholder="请输入邮箱"
                    value={form.adminEmail}
                    onChange={(event) => setForm((current) => ({ ...current, adminEmail: event.target.value }))}
                  />
                  {adminEmailError ? <p className="-mt-2 text-[11px] font-medium text-rose-600 md:col-span-2">{adminEmailError}</p> : null}
                </div>
              </SectionCard>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button onClick={closeForm} className="h-9 px-4 text-xs font-bold">
                取消
              </Button>
              <Button
                variant="primary"
                onClick={() => void handleSubmit()}
                disabled={createTenant.isPending || updateTenant.isPending || !canSubmit}
                className="h-9 px-4 text-xs font-bold shadow-sm"
              >
                {editing ? '保存' : '创建'}
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <section className="rounded-xl border border-border-subtle bg-white p-5 shadow-card">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                  <ShieldCheck className="h-4.5 w-4.5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">管理员要求</div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    创建组织时会同步创建一名初始租户管理员账号。该账号创建完成后，将立即获得当前组织的管理权限。
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-primary/15 bg-primary/5 p-5">
              <div className="flex items-start gap-3">
                <CircleAlert className="mt-0.5 h-4.5 w-4.5 text-primary" />
                <div>
                  <div className="text-sm font-bold text-slate-900">录入建议</div>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    先确认组织归属和管理员账号命名，再统一录入。组织创建后，管理员将直接进入对应租户开展配置和用户维护。
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      ) : (
        <>
          <TableToolbar
            onSearchChange={(value) => {
              setKeyword(value);
              setPage(1);
            }}
            searchPlaceholder="搜索组织名称、标识或说明"
            searchValue={keyword}
          />

          <SectionCard title="组织列表">
            <TableShell className="rounded-none border-0 shadow-none">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="border-b border-border-subtle bg-slate-50/70 text-xs font-semibold text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">组织名称</th>
                    <th className="px-5 py-3 font-semibold">组织标识</th>
                    <th className="px-5 py-3 font-semibold">状态</th>
                    <th className="px-5 py-3 font-semibold">说明</th>
                    <th className="px-5 py-3 text-right font-semibold">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle bg-white">
                  {rows.length ? (
                    rows.map((tenant) => (
                      <tr key={tenant.id} className="transition-colors hover:bg-slate-50/50">
                        <td className="px-5 py-3 font-bold text-slate-900">{tenant.tenantName || '-'}</td>
                        <td className="px-5 py-3">
                          <Badge className="border border-border bg-zinc-100 px-1.5 text-[10px] font-bold uppercase tracking-tight text-muted-foreground">
                            {tenant.tenantSlug || '-'}
                          </Badge>
                        </td>
                        <td className="px-5 py-3">
                          <Badge tone={tenant.status === 'ACTIVE' ? 'success' : 'neutral'}>
                            {tenant.status ? (statusLabel[tenant.status] ?? tenant.status) : '未知'}
                          </Badge>
                        </td>
                        <td className="max-w-[360px] truncate px-5 py-3 text-xs font-semibold text-slate-500" title={tenant.description}>
                          {tenant.description || '暂无说明'}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => openEdit(tenant)}
                              title="编辑组织"
                              aria-label="编辑组织"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              className="h-7 w-7 p-0 text-rose-600 hover:text-rose-700"
                              onClick={() => setPendingDeleteTenant(tenant)}
                              title="删除组织"
                              aria-label="删除组织"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <TableEmpty colSpan={5} message="暂无组织" />
                  )}
                </tbody>
              </table>
              <TablePagination
                disabled={tenants.isLoading || tenants.isFetching}
                end={Math.min(page * pageSize, total)}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPage(1);
                  setPageSize(size);
                }}
                page={page}
                pageCount={pageCount}
                pageSize={pageSize}
                start={(page - 1) * pageSize + 1}
                total={total}
              />
            </TableShell>
          </SectionCard>
        </>
      )}

      <ConfirmModal
        description={`删除后将停用组织「${pendingDeleteTenant?.tenantName ?? ''}」的租户入口，相关资源归属需要单独清理。`}
        onClose={() => setPendingDeleteTenant(null)}
        onConfirm={() => void (pendingDeleteTenant ? handleDelete(pendingDeleteTenant) : Promise.resolve())}
        open={Boolean(pendingDeleteTenant)}
        title="删除组织"
        tone="danger"
      />
    </div>
  );
}
