import { NextRequest, NextResponse } from "next/server";
import { readTokenFromRequest, verifySession } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname;

  if (
    p.startsWith("/login") ||
    p.startsWith("/register") ||
    p.startsWith("/api/auth/") ||
    p.startsWith("/_next") ||
    /\.[^/]+$/.test(p) // static files
  ) return NextResponse.next();

  const token = readTokenFromRequest(req);
  if (!token) return NextResponse.redirect(new URL("/login", req.url));

  const payload = await verifySession(token);
  if (!payload?.sub) return NextResponse.redirect(new URL("/login", req.url));

  return NextResponse.next();
}
export const config = { matcher: ["/((?!api/trpc).*)"] };
