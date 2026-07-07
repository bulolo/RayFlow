import { create } from 'zustand';
import type { TenantResponse } from '@/shared/api/generated';
import {
  getStoredTenantName,
  getStoredTenantSlug,
  persistTenantSelection,
} from '@/shared/tenant/storage';

interface TenantState {
  selectedOrg: string;
  selectedTenantSlug: string | null;
  tenantOptions: TenantResponse[];
  hydrateTenantSelection: () => void;
  setSelectedTenant: (tenant: TenantResponse) => void;
  setTenantOptions: (tenants: TenantResponse[]) => void;
  clearTenantSelection: () => void;
}

export const useTenantStore = create<TenantState>((set) => ({
  selectedOrg: '默认组织',
  selectedTenantSlug: null,
  tenantOptions: [],
  hydrateTenantSelection: () => set({
    selectedTenantSlug: getStoredTenantSlug(),
    selectedOrg: getStoredTenantName(),
  }),
  setSelectedTenant: (tenant) => {
    persistTenantSelection(tenant);
    set({ selectedOrg: tenant.tenantName ?? '默认组织', selectedTenantSlug: tenant.tenantSlug ?? null });
  },
  setTenantOptions: (tenants) => set((state) => {
    const storedSlug = state.selectedTenantSlug ?? getStoredTenantSlug();
    const matched = tenants.find((tenant) => tenant.tenantSlug === storedSlug) ?? tenants[0] ?? null;
    persistTenantSelection(matched);
    return {
      tenantOptions: tenants,
      selectedOrg: matched?.tenantName ?? '默认组织',
      selectedTenantSlug: matched?.tenantSlug ?? null,
    };
  }),
  clearTenantSelection: () => {
    persistTenantSelection(null);
    set({
      selectedOrg: '默认组织',
      selectedTenantSlug: null,
      tenantOptions: [],
    });
  },
}));
