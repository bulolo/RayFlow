import { Badge } from '@/components/ui';

export function ConnectionStatusBadge({ status }: { status: string }) {
  const active = status === '健康';
  const inactive = status === '停用';
  const unreachable = status === '不可用' || status === 'UNREACHABLE';

  const tone = active ? 'success' : inactive ? 'neutral' : unreachable ? 'danger' : 'warning';

  return (
    <Badge tone={tone} className="font-semibold">
      {status}
    </Badge>
  );
}
