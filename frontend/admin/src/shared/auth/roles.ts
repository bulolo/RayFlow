import type { UserProfile } from '@/shared/api/generated';

export const PLATFORM_ROLE_SUPER_ADMIN = 'SUPER_ADMIN';

export function isPlatformSuperAdmin(user: Pick<UserProfile, 'role'> | null | undefined) {
  return user?.role === PLATFORM_ROLE_SUPER_ADMIN;
}

export function getPlatformRoleLabel(user: Pick<UserProfile, 'role'> | null | undefined) {
  return isPlatformSuperAdmin(user) ? '超级管理员' : '租户用户';
}
