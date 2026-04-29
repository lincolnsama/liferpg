import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // 本地开发调试优先：避免网络/DNS 抖动导致中间件反复校验会话，把用户“弹回登录页”。
  if (process.env.NODE_ENV === "development") {
    return NextResponse.next();
  }

  // API 路由（含邮箱确认 / OAuth 回调）必须由 Route Handler 处理，不能在这里被重定向走
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // 登录/注册页允许直接访问，避免在网络抖动时中间件反复调用 Supabase 导致“按钮没反应”的体感
  if (pathname.startsWith("/login") || pathname.startsWith("/register")) {
    return NextResponse.next();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const isAuthPage = false;

  if (!url || !anonKey) {
    console.error("[middleware] 缺少 NEXT_PUBLIC_SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_ANON_KEY");
    if (!isAuthPage) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers
    }
  });

  let user: { id: string } | null = null;

  try {
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({
            request: {
              headers: request.headers
            }
          });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: Record<string, unknown>) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({
            request: {
              headers: request.headers
            }
          });
          response.cookies.set({ name, value: "", ...options });
        }
      }
    });

    const {
      data: { user: u },
      error
    } = await supabase.auth.getUser();

    if (!error) {
      user = u;
    }
  } catch (e) {
    console.error("[middleware] Supabase getUser 失败（网络或配置问题）", e);
    // 无法校验会话时，避免错误重定向循环
    return NextResponse.next();
  }

  if (!user && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && isAuthPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|login|register).*)"]
};
