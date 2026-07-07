'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LockKeyhole, UserRound, Waypoints } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui';
import { useAuthStore } from '@/stores/auth-store';
import { useLogin } from '@/shared/api/generated';
import { getErrorMessage } from '@/lib/error-message';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('superadmin@rayflow.cn');
  const [password, setPassword] = useState('admin123');
  const login = useLogin();
  const { setSession } = useAuthStore();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const response = await login.mutateAsync({
        data: {
          username: username.trim(),
          password,
        },
      });
      if (response.token) {
        setSession(response.token, response.user);
      }
      const redirect = new URLSearchParams(window.location.search).get('redirect');
      router.replace(redirect || '/');
    } catch (error) {
      toast.error(getErrorMessage(error, '登录失败，请稍后重试'));
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-5xl overflow-hidden rounded-lg border border-border-subtle bg-white shadow-[var(--shadow-modal)]">
        <div className="grid min-h-[620px] lg:grid-cols-[0.92fr_1.08fr]">
          <section className="flex flex-col justify-between border-b border-border-subtle bg-slate-950 p-10 text-white lg:border-b-0 lg:border-r">
            <div>
              <Link href="/" className="inline-flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary shadow-sm">
                  <Waypoints className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="text-base font-bold tracking-tight text-white">RayFlow</div>
                  <div className="label-xs mt-1 text-slate-400">数据开发治理平台</div>
                </div>
              </Link>
              <div className="mt-16">
                <h1 className="text-3xl font-bold tracking-tight leading-tight">登录 RayFlow 控制台</h1>
                <p className="mt-4 max-w-sm text-sm leading-6 text-slate-300 font-medium opacity-90">
                  RayFlow 湖仓与湖流一体流计算任务管理平台，提供流处理作业生命周期的统一调度、计算节点编排及实时数据管道管控。
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 text-xs text-slate-300 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3.5">
                <div className="font-semibold text-white mb-0.5">湖仓一体</div>
                <div className="text-[10px] text-slate-400 font-medium">Paimon 目录治理</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3.5">
                <div className="font-semibold text-white mb-0.5">湖流一体</div>
                <div className="text-[10px] text-slate-400 font-medium">Fluss 实时管道</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3.5">
                <div className="font-semibold text-white mb-0.5">极速作业</div>
                <div className="text-[10px] text-slate-400 font-medium">Flink 调度计算</div>
              </div>
            </div>
          </section>

          <section className="flex flex-col justify-between items-center bg-white p-8 sm:p-12 lg:p-14">
            <div />

            <div className="w-full max-w-sm my-auto space-y-7">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">账号登录</h2>
                <p className="mt-2 text-xs font-semibold text-slate-400">使用 RayFlow 账号登录控制台。</p>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-500">用户名</span>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      className="h-10 w-full rounded-lg border border-border bg-white pl-9 pr-3 text-sm font-medium placeholder-slate-400 outline-none transition duration-150 focus:border-primary focus:ring-2 focus:ring-primary/15"
                      autoComplete="username"
                      placeholder="请输入用户名"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-500">密码</span>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="h-10 w-full rounded-lg border border-border bg-white pl-9 pr-3 text-sm font-medium placeholder-slate-400 outline-none transition duration-150 focus:border-primary focus:ring-2 focus:ring-primary/15"
                      type="password"
                      autoComplete="current-password"
                      placeholder="请输入密码"
                    />
                  </div>
                </label>

                <Button className="h-10 w-full rounded-lg text-sm font-semibold shadow-sm mt-2" type="submit" variant="primary">
                  {login.isPending ? '登录中...' : '安全登录'}
                </Button>

                {login.error ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 font-medium">
                    {login.error instanceof Error ? login.error.message : '登录失败'}
                  </div>
                ) : null}
              </form>
            </div>

            <div className="text-center text-[10px] font-semibold text-slate-400 pt-4">
              <span>© 2026 RayFlow Team · 湖仓与湖流一体化计算平台</span>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
