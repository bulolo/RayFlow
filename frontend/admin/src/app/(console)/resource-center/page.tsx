import { Suspense } from 'react';
import { ResourceCenterPage } from '@/features/resource-center';

export default function ResourceCenterRoute() {
  return (
    <Suspense fallback={null}>
      <ResourceCenterPage />
    </Suspense>
  );
}
