import { NextResponse, type NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const token = request.cookies.get('rf_token')?.value;
  const { pathname } = request.nextUrl;

  // 1. 如果未登录且试图访问受保护路径 (如后台 /development、根路径 / 等)
  if (!token && pathname !== '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // 2. 如果已登录但又强行进入 /login 页面，自动将用户推回后台首页
  if (token && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  /*
   * 匹配除以下项之外的所有路径:
   * - api (后端 API 路径)
   * - doc.html, v3/api-docs, swagger-ui, webjars (API 文档路径)
   * - _next/static (编译生成的静态页面 CSS/JS)
   * - _next/image (Next.js 优化图片)
   * - favicon.ico, logo.png 等各种后缀的静态文件资产
   */
  matcher: [
    '/((?!api|doc.html|v3/api-docs|swagger-ui|webjars|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.ico$).*)',
  ],
};
