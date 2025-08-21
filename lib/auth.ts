// lib/auth.ts
import { NextRequest, NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret");
const COOKIE = "session";
const AGE = 60 * 60 * 24 * 7; // 7 ngày

export type SessionPayload = { sub: string; email: string; name?: string | null };

export async function signSession(payload: SessionPayload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${AGE}s`)
    .sign(SECRET);
}

export async function verifySession<T = SessionPayload>(token: string): Promise<T | null> {
  try { const { payload } = await jwtVerify(token, SECRET); return payload as T; } catch { return null; }
}

export function setSessionCookie(res: NextResponse, token: string) {
  res.cookies.set(COOKIE, token, {
    httpOnly: true, sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/", maxAge: AGE,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(COOKIE, "", {
    httpOnly: true, sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/", maxAge: 0,
  });
}

export function readTokenFromRequest(req: NextRequest): string | null {
  return req.cookies.get(COOKIE)?.value || null;
}
