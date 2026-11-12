import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decodeJwt } from "jose";
import type { GlobalRole, MemberRole } from "@/lib/types";

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";

interface SessionClaims {
  sub?: string;
  globalRole?: GlobalRole;
  membership?: { establishmentId?: string; memberRole?: MemberRole } | null;
}

function sessionFrom(request: NextRequest): SessionClaims | null {
  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  try {
    return decodeJwt(token) as SessionClaims;
  } catch {
    return null;
  }
}

function homeFor(session: SessionClaims): string {
  if (session.globalRole === "SUPER_ADMIN") return "/admin";
  if (session.membership?.establishmentId) return "/panel";
  return "/cards";
}

function loginRedirect(request: NextRequest): NextResponse {
  const url = new URL("/login", request.url);
  url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(url);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = sessionFrom(request);

  // Página pública de claim (QR/NFC): la página decide qué mostrar
  if (pathname.startsWith("/s/")) return NextResponse.next();

  // /login y /verify: si ya hay sesión, ir al home del rol
  if (pathname === "/login" || pathname === "/verify") {
    if (!session) return NextResponse.next();
    return NextResponse.redirect(new URL(homeFor(session), request.url));
  }

  // Área de administración
  if (pathname.startsWith("/admin")) {
    if (!session) return loginRedirect(request);
    if (session.globalRole !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL(homeFor(session), request.url));
    }
    return NextResponse.next();
  }

  // Panel de negocios: requiere membresía en el JWT
  if (pathname.startsWith("/panel")) {
    if (!session) return loginRedirect(request);
    if (!session.membership?.establishmentId) {
      return NextResponse.redirect(new URL(homeFor(session), request.url));
    }
    return NextResponse.next();
  }

  // Cliente: tarjetas y perfil
  if (pathname.startsWith("/cards") || pathname.startsWith("/profile")) {
    if (!session) return loginRedirect(request);
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/s/:path*",
    "/login",
    "/verify",
    "/cards/:path*",
    "/profile/:path*",
    "/panel/:path*",
    "/admin/:path*",
  ],
};