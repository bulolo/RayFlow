import type { SettingsTab } from '@/features/settings/components/shell';
import {
  Activity,
  Bell,
  Bot,
  Container,
  LayoutDashboard,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from 'lucide-react';

export type SettingsTabKey = 'alerts' | 'users' | 'permissions' | 'defaults' | 'model-providers' | 'image-registry';

export const settingsTabs: Array<SettingsTab<SettingsTabKey>> = [
  { key: 'defaults', label: '默认设置', description: '系统级默认参数', group: '配置', icon: SlidersHorizontal },
  { key: 'image-registry', label: '镜像仓库', description: '作业镜像推送仓库', group: '配置', icon: Container },
  { key: 'model-providers', label: '模型提供商', description: 'OpenAI 兼容接口与默认模型', group: '配置', icon: Bot },
  { key: 'users', label: '用户管理', description: '账号、状态与登录信息', group: '访问控制', icon: Users },
  { key: 'permissions', label: '权限管理', description: '角色与操作权限', group: '访问控制', icon: ShieldCheck },
  { key: 'alerts', label: '告警渠道', description: '通知方式与告警路由', group: '通知', icon: Bell },
];

export type PermissionRole = {
  key: 'MEMBER' | 'ADMIN';
  label: string;
  hint: string;
  locked?: boolean;
};

export type PermissionCap = {
  key: string;
  label: string;
  desc?: string;
  baseline?: boolean;
  defaults: Array<PermissionRole['key']>;
};

export type PermissionGroup = {
  label: string;
  section: string;
  icon: React.ComponentType<{ className?: string }>;
  caps: PermissionCap[];
};

export const PERMISSION_ROLES: PermissionRole[] = [
  { key: 'MEMBER', label: '成员', hint: '默认查看与日常操作' },
  { key: 'ADMIN', label: '管理员', hint: '组织级配置与治理', locked: true },
];

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    label: '总览',
    section: '控制台',
    icon: LayoutDashboard,
    caps: [{ key: 'overview:read', label: '查看总览', baseline: true, defaults: ['MEMBER', 'ADMIN'] }],
  },
  {
    label: 'Flink 作业',
    section: '控制台',
    icon: Activity,
    caps: [
      { key: 'job:read', label: '查看作业', baseline: true, defaults: ['MEMBER', 'ADMIN'] },
      { key: 'job:create', label: '创建作业', defaults: ['ADMIN'] },
      { key: 'job:update', label: '编辑作业', defaults: ['ADMIN'] },
      { key: 'job:operate', label: '启停作业', desc: '启动、停止、保存点与重启', defaults: ['ADMIN'] },
      { key: 'job:delete', label: '删除作业', defaults: ['ADMIN'] },
    ],
  },
  {
    label: '资源中心',
    section: '控制台',
    icon: Settings2,
    caps: [
      { key: 'resource:read', label: '查看资源', baseline: true, defaults: ['MEMBER', 'ADMIN'] },
      { key: 'resource:create', label: '添加资源', defaults: ['ADMIN'] },
      { key: 'resource:update', label: '编辑资源', defaults: ['ADMIN'] },
      { key: 'resource:test', label: '测试连通性', desc: '校验连接资源与底层服务配置', defaults: ['ADMIN'] },
      { key: 'resource:delete', label: '删除资源', defaults: ['ADMIN'] },
    ],
  },
  {
    label: '用户管理',
    section: '系统设置',
    icon: Users,
    caps: [
      { key: 'user:read', label: '查看用户', baseline: true, defaults: ['MEMBER', 'ADMIN'] },
      { key: 'user:create', label: '创建用户', defaults: ['ADMIN'] },
      { key: 'user:update', label: '编辑用户', defaults: ['ADMIN'] },
      { key: 'user:delete', label: '移除用户', defaults: ['ADMIN'] },
    ],
  },
  {
    label: '告警渠道',
    section: '系统设置',
    icon: Bell,
    caps: [
      { key: 'channel:read', label: '查看渠道', baseline: true, defaults: ['MEMBER', 'ADMIN'] },
      { key: 'channel:create', label: '创建渠道', defaults: ['ADMIN'] },
      { key: 'channel:update', label: '编辑渠道', defaults: ['ADMIN'] },
      { key: 'channel:test', label: '测试渠道', defaults: ['ADMIN'] },
      { key: 'channel:delete', label: '删除渠道', defaults: ['ADMIN'] },
    ],
  },
  {
    label: '权限管理',
    section: '系统设置',
    icon: ShieldCheck,
    caps: [
      { key: 'permission:read', label: '查看矩阵', baseline: true, defaults: ['MEMBER', 'ADMIN'] },
      { key: 'permission:manage', label: '调整权限', desc: '维护角色与功能操作矩阵', defaults: ['ADMIN'] },
    ],
  },
  {
    label: '默认设置',
    section: '系统设置',
    icon: Settings2,
    caps: [
      { key: 'defaults:read', label: '查看配置', baseline: true, defaults: ['MEMBER', 'ADMIN'] },
      { key: 'defaults:update', label: '修改默认值', defaults: ['ADMIN'] },
    ],
  },
  {
    label: '模型提供商',
    section: '系统设置',
    icon: Bot,
    caps: [
      { key: 'model-provider:read', label: '查看提供商', baseline: true, defaults: ['MEMBER', 'ADMIN'] },
      { key: 'model-provider:update', label: '修改配置', defaults: ['ADMIN'] },
      { key: 'model-provider:test', label: '测试连通性', defaults: ['ADMIN'] },
    ],
  },
  {
    label: '镜像仓库',
    section: '系统设置',
    icon: Container,
    caps: [
      { key: 'image-registry:read', label: '查看镜像仓库', baseline: true, defaults: ['MEMBER', 'ADMIN'] },
      { key: 'image-registry:update', label: '修改配置', defaults: ['ADMIN'] },
      { key: 'image-registry:test', label: '测试连通性', defaults: ['ADMIN'] },
    ],
  },
];

export function buildPermissionDefaults(groups: PermissionGroup[]) {
  const grants = new Set<string>();
  for (const group of groups) {
    for (const cap of group.caps) {
      for (const role of cap.defaults) {
        grants.add(`${cap.key}|${role}`);
      }
    }
  }
  return grants;
}
