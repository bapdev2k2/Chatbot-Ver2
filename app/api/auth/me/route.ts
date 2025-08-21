import { NextRequest, NextResponse } from "next/server";
import { readTokenFromRequest, verifySession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const token = readTokenFromRequest(req);
  if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const payload = await verifySession(token);
  if (!payload?.sub) return NextResponse.json({ ok: false, error: "Invalid session" }, { status: 401 });

  return NextResponse.json({ ok: true, user: { id: payload.sub, email: payload.email, name: payload.name ?? null } });
}
