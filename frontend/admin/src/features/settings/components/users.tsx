'use client';

import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  type TenantUserResponse,
  type UserCreateRequest,
  type UserUpdateRequest,
  useCreateUser,
  useDeleteUser,
  useListUsers,
  useUpdateUser,
} from '@/shared/api/generated';
import { useTenantStore } from '@/stores/tenant-store';
import { Badge, Button, ConfirmModal, Field, SelectField, SectionCard, SectionHeader } from '@/components/ui';
import { TableEmpty, TablePagination, TableShell, TableToolbar } from '@/components/data-display/table-shell';

export function Users() {
  const selectedOrg = useTenantStore((state) => state.selectedOrg);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const users = useListUsers(
    { is_pager: 1, keyword: keyword.trim() || undefined, page, size: pageSize },
    { query: { staleTime: 30_000 } },
  );
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TenantUserResponse | null>(null);
  const [pendingDeleteUser, setPendingDeleteUser] = useState<TenantUserResponse | null>(null);
  const [form, setForm] = useState<UserCreateRequest & { confirmPassword?: string }>({
    username: '',
    password: '',
    confirmPassword: '',
    nickname: '',
    email: '',
    role: 'MEMBER',
    status: 1,
  });

  function openCreate() {
    setEditing(null);
    setForm({
      username: '',
      password: '',
      confirmPassword: '',
      nickname: '',
      email: '',
      role: 'MEMBER',
      status: 1,
    });
    setFormOpen(true);
  }

  function openEdit(user: TenantUserResponse) {
    setEditing(user);
    setForm({
      username: user.username ?? '',
      password: '',
      confirmPassword: '',
      nickname: user.nickname ?? '',
      email: user.email ?? '',
      role: user.role as 'ADMIN' | 'MEMBER',
      status: user.status ?? 1,
    });
    setFormOpen(true);
  }

  async function handleSubmit() {
    if (!editing && form.password !== form.confirmPassword) {
      toast.error('两次密码输入不一致');
      return;
    }

    if (editing) {
      if (!editing.id) return;
      const payload: UserUpdateRequest = {
        nickname: form.nickname,
        email: form.email,
        role: form.role,
        status: form.status,
        password: form.password?.trim() ? form.password : undefined,
      };
      await updateUser.mutateAsync({ id: editing.id, data: payload });
    } else {
      const payload: UserCreateRequest = {
        username: form.username,
        password: form.password,
        nickname: form.nickname,
        email: form.email,
        role: form.role,
        status: form.status,
      };
      await createUser.mutateAsync({ data: payload });
    }

    setFormOpen(false);
    setEditing(null);
    void users.refetch();
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
  }

  async function handleDelete(user: TenantUserResponse) {
    if (!user.id) return;
    await deleteUser.mutateAsync({ id: user.id });
    setPendingDeleteUser(null);
    void users.refetch();
  }

  const rows = users.data?.list ?? [];
  const total = users.data?.pagination?.total ?? rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="w-full space-y-6">
      <SectionHeader
        action={
          <Button onClick={openCreate} variant="primary" className="h-9 px-4 text-xs font-bold shadow-sm">
            新增用户
          </Button>
        }
        description={`管理当前组织「${selectedOrg}」下的控制台账号、角色分配和登录状态。`}
        title="用户管理"
      />

      {formOpen ? (
        <SectionCard title={editing ? '编辑账号' : '新增账号'}>
          <div className="grid gap-4 p-5">
            <Field
              label="用户名"
              value={form.username}
              disabled={Boolean(editing)}
              onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
            />
            <Field
              label="昵称"
              value={form.nickname ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, nickname: event.target.value }))}
            />
            <Field
              label="邮箱"
              type="email"
              value={form.email ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            />
            <SelectField
              label="角色"
              value={form.role}
              onValueChange={(value) => setForm((current) => ({ ...current, role: value as 'ADMIN' | 'MEMBER' }))}
              options={[
                { label: '管理员', value: 'ADMIN' },
                { label: '成员', value: 'MEMBER' },
              ]}
            />
            <Field
              label={editing ? '新密码' : '密码'}
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              placeholder={editing ? '留空表示不修改' : ''}
            />
            {!editing ? (
              <Field
                label="确认密码"
                type="password"
                value={form.confirmPassword}
                onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
              />
            ) : null}
            <SelectField
              label="状态"
              value={String(form.status)}
              onValueChange={(value) => setForm((current) => ({ ...current, status: Number(value) }))}
              options={[
                { label: '启用', value: '1' },
                { label: '停用', value: '0' },
              ]}
            />
          </div>
          <div className="flex justify-end gap-2 px-5 py-4">
            <Button onClick={closeForm} className="h-9 px-4 text-xs font-bold">
              取消
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleSubmit()}
              disabled={createUser.isPending || updateUser.isPending}
              className="h-9 px-4 text-xs font-bold shadow-sm"
            >
              {editing ? '保存' : '创建'}
            </Button>
          </div>
        </SectionCard>
      ) : null}

      <TableToolbar
        onSearchChange={(value) => {
          setKeyword(value);
          setPage(1);
        }}
        searchPlaceholder="搜索用户名、昵称、邮箱或角色"
        searchValue={keyword}
      />

      <TableShell>
        <table className="w-full border-collapse text-left text-sm">
          <thead className="border-b border-border-subtle bg-slate-50/70 text-xs font-semibold text-slate-500">
            <tr>
              <th className="px-5 py-3 font-semibold">用户</th>
              <th className="px-5 py-3 font-semibold">邮箱</th>
              <th className="px-5 py-3 font-semibold">角色</th>
              <th className="px-5 py-3 font-semibold">状态</th>
              <th className="px-5 py-3 font-semibold">最后登录</th>
              <th className="px-5 py-3 text-right font-semibold">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle bg-white">
            {rows.length ? (
              rows.map((user) => (
                <tr key={user.id} className="transition-colors hover:bg-slate-50/50">
                  <td className="px-5 py-3">
                    <div className="font-bold text-slate-900">{user.nickname || user.username || '-'}</div>
                    <div className="mt-0.5 text-xs font-medium text-slate-400">
                      {user.username ? (user.username.includes('@') ? user.username : `@${user.username}`) : '-'}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-xs font-semibold text-slate-500">{user.email || '-'}</td>
                  <td className="px-5 py-3">
                    <Badge tone={user.role === 'ADMIN' ? 'info' : 'neutral'}>{user.role === 'ADMIN' ? '管理员' : '成员'}</Badge>
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={user.status === 1 ? 'success' : 'neutral'}>{user.status === 1 ? '启用' : '停用'}</Badge>
                  </td>
                  <td className="px-5 py-3 text-xs font-semibold text-slate-500">
                    {user.lastLoginAt ? user.lastLoginAt.replace('T', ' ').slice(0, 16) : '未登录'}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1.5">
                      <Button onClick={() => openEdit(user)} variant="ghost" className="h-7 w-7 p-0" title="编辑用户" aria-label="编辑用户">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        onClick={() => setPendingDeleteUser(user)}
                        variant="ghost"
                        className="h-7 w-7 p-0 text-rose-600 hover:text-rose-700"
                        title="移除用户"
                        aria-label="移除用户"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <TableEmpty colSpan={6} message="暂无用户" />
            )}
          </tbody>
        </table>
        <TablePagination
          disabled={users.isLoading || users.isFetching}
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
      <ConfirmModal
        description={`移除后，用户「${pendingDeleteUser?.username ?? ''}」将失去当前组织的控制台访问权限。`}
        onConfirm={() => void (pendingDeleteUser ? handleDelete(pendingDeleteUser) : Promise.resolve())}
        onClose={() => setPendingDeleteUser(null)}
        open={Boolean(pendingDeleteUser)}
        title="移除组织用户"
        tone="danger"
      />
    </div>
  );
}
