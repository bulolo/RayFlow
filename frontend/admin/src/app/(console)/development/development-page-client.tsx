'use client';

import { useCallback, useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { DevelopmentWorkspace, type DevelopmentViewMode } from '@/features/development';

const DEVELOPMENT_VIEW_MODE_KEY = 'rayflow_development_view_mode';

function isEditableShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable;
}

function normalizeViewMode(value: string | null): DevelopmentViewMode | null {
  return value === 'develop' || value === 'ops' ? value : null;
}

function normalizeJobId(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function persistViewMode(mode: DevelopmentViewMode) {
  window.localStorage.setItem(DEVELOPMENT_VIEW_MODE_KEY, mode);
  document.cookie = `${DEVELOPMENT_VIEW_MODE_KEY}=${mode}; path=/; max-age=31536000; SameSite=Lax`;
}

export function DevelopmentPageClient({ initialViewMode }: { initialViewMode: DevelopmentViewMode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewMode = normalizeViewMode(searchParams.get('view')) ?? initialViewMode;
  const selectedJobId = normalizeJobId(searchParams.get('jobId'));

  const updateViewModeUrl = useCallback((mode: DevelopmentViewMode) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', mode);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const updateSelectedJobUrl = useCallback((jobId: number | null) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', 'develop');
    if (jobId) {
      params.set('jobId', String(jobId));
    } else {
      params.delete('jobId');
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const handleViewModeChange = useCallback((mode: DevelopmentViewMode) => {
    if (mode === viewMode) return;
    persistViewMode(mode);
    updateViewModeUrl(mode);
  }, [updateViewModeUrl, viewMode]);

  const handleSelectedJobChange = useCallback((jobId: number | null) => {
    updateSelectedJobUrl(jobId);
  }, [updateSelectedJobUrl]);

  useEffect(() => {
    const handleViewModeShortcut = (event: KeyboardEvent) => {
      if (!event.shiftKey || event.metaKey || event.ctrlKey || event.altKey || event.isComposing || isEditableShortcutTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === 'v') {
        event.preventDefault();
        handleViewModeChange(viewMode === 'develop' ? 'ops' : 'develop');
      }
    };

    window.addEventListener('keydown', handleViewModeShortcut);
    return () => window.removeEventListener('keydown', handleViewModeShortcut);
  }, [handleViewModeChange, viewMode]);

  return (
    <main className="min-h-0 overflow-y-auto px-6 py-5 lg:px-8 animate-in fade-in-50 duration-200">
      <DevelopmentWorkspace
        selectedJobId={selectedJobId}
        viewMode={viewMode}
        onSelectedJobChange={handleSelectedJobChange}
        onViewModeChange={handleViewModeChange}
      />
    </main>
  );
}
