'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button, Card } from '@/components/ui';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Captured dashboard error:', error);
  }, [error]);

  return (
    <main className="flex min-h-[500px] items-center justify-center p-6 text-center animate-in fade-in-50 duration-200">
      <Card className="max-w-md p-8 border-red-200 bg-red-50/20 shadow-lg shadow-red-500/5">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-base font-bold text-slate-900">子页面加载异常</h2>
        <p className="mt-2 text-xs leading-5 font-semibold text-slate-500">
          {error.message || '加载后台数据或渲染组件时发生了未预料的错误。'}
        </p>
        <div className="mt-6 flex justify-center">
          <Button
            onClick={() => reset()}
            variant="primary"
            className="h-9 rounded-lg gap-2 text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            重试加载
          </Button>
        </div>
      </Card>
    </main>
  );
}
