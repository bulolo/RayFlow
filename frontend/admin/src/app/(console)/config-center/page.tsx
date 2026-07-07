import { Suspense } from 'react';
import { SettingsPage } from '@/features/settings/settings-page';

export default function ConfigCenterPage() {
  return (
    <Suspense fallback={null}>
      <SettingsPage />
    </Suspense>
  );
}
