import { clearPersistedSession, getToken } from '@/shared/auth/session';
import { getStoredTenantSlug } from '@/shared/tenant/storage';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function isHtmlText(text: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(text) || text.trim().startsWith('<!DOCTYPE');
}

function httpErrorMessage(status: number, statusText?: string): string {
  const messages: Record<number, string> = {
    400: '请求参数不正确',
    401: '登录已失效，请重新登录',
    403: '没有权限执行该操作',
    404: '请求的资源不存在',
    408: '请求超时，请稍后重试',
    500: '服务器内部错误',
    502: '网关连接后端失败，请检查后端服务是否正常',
    503: '服务暂不可用，请稍后重试',
    504: '网关请求后端超时，请稍后重试',
  };
  return messages[status] ?? statusText ?? '请求失败';
}

function handleUnauthorized() {
  if (typeof window === 'undefined') return;
  clearPersistedSession();
  if (window.location.pathname !== '/login') {
    window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
  }
}

export async function apiClient<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const token = getToken();
  const tenantSlug = getStoredTenantSlug();

  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (tenantSlug) headers.set('X-Tenant-Slug', tenantSlug);
  if (init?.body !== undefined && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${url}`, { ...init, headers });
  } catch {
    throw new ApiError(0, '服务暂不可用，请检查后端服务或网关配置');
  }

  let body: unknown = null;
  if (![204, 205, 304].includes(response.status)) {
    const text = await response.text();
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      const message = httpErrorMessage(response.status, response.statusText);
      handleUnauthorized();
      throw new ApiError(response.status, message);
    }

    const rawMessage =
      body && typeof body === 'object' && 'msg' in body
        ? String((body as { msg: unknown }).msg)
        : body && typeof body === 'object' && 'message' in body
          ? String((body as { message: unknown }).message)
          : typeof body === 'string'
            ? body
            : response.statusText || '请求失败';
    const message = typeof rawMessage === 'string' && isHtmlText(rawMessage)
      ? httpErrorMessage(response.status, response.statusText)
      : rawMessage || httpErrorMessage(response.status, response.statusText);
    throw new ApiError(response.status, message);
  }

  if (
    body &&
    typeof body === 'object' &&
    'code' in body &&
    typeof (body as { code: unknown }).code === 'number'
  ) {
    const envelope = body as { code: number; msg?: string; message?: string; data?: unknown };
    if (envelope.code === 0) {
      return envelope.data as T;
    }
    const msg = envelope.msg || envelope.message || '操作失败';
    throw new ApiError(response.status, msg);
  }

  return body as T;
}

export default apiClient;
