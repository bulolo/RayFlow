import type { TenantResponse } from '@/shared/api/generated';

export const TENANT_SLUG_KEY = 'rf_tenant_slug';
export const TENANT_NAME_KEY = 'rf_tenant_name';

export function getStoredTenantSlug() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TENANT_SLUG_KEY);
}

export function getStoredTenantName() {
  if (typeof window === 'undefined') return '默认组织';
  return window.localStorage.getItem(TENANT_NAME_KEY) ?? '默认组织';
}

export function persistTenantSelection(tenant: TenantResponse | null) {
  if (typeof window === 'undefined') return;
  if (!tenant) {
    window.localStorage.removeItem(TENANT_SLUG_KEY);
    window.localStorage.removeItem(TENANT_NAME_KEY);
    return;
  }
  window.localStorage.setItem(TENANT_SLUG_KEY, tenant.tenantSlug ?? 'default');
  window.localStorage.setItem(TENANT_NAME_KEY, tenant.tenantName ?? '默认组织');
}
