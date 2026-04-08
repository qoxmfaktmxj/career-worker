import { NextRequest, NextResponse } from "next/server";

import { validateSession } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/api/auth"];
const PUBLIC_ASSET_PATTERN =
  /\.(?:png|jpg|jpeg|gif|webp|svg|ico|avif)$/i;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((publicPath) => pathname.startsWith(publicPath))) {
    return NextResponse.next();
  }

  if (PUBLIC_ASSET_PATTERN.test(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  const sessionId = request.cookies.get("session_id")?.value;

  if (!sessionId || !validateSession(sessionId)) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("session_id");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
