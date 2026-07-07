import { cookies } from 'next/headers';
import { DevelopmentPageClient } from './development-page-client';
import type { DevelopmentViewMode } from '@/features/development';

const DEVELOPMENT_VIEW_MODE_KEY = 'rayflow_development_view_mode';

type DevelopmentPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function normalizeViewMode(value: string | string[] | undefined): DevelopmentViewMode | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'develop' || raw === 'ops' ? raw : null;
}

export default async function DevelopmentPage({ searchParams }: DevelopmentPageProps) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const urlViewMode = normalizeViewMode(params?.view);
  const initialViewMode: DevelopmentViewMode = urlViewMode ?? (cookieStore.get(DEVELOPMENT_VIEW_MODE_KEY)?.value === 'develop' ? 'develop' : 'ops');

  return <DevelopmentPageClient initialViewMode={initialViewMode} />;
}
