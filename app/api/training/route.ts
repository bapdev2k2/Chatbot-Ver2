// app/api/training/route.ts
import { NextResponse } from "next/server";
import { getTraining, setTraining } from "@/lib/training-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const data = getTraining();
  const res = NextResponse.json({ success: true, data });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

// Chỉ nhận PATCH { prompt?: string }, merge vào store
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const data = setTraining({
    prompt: typeof body?.prompt === "string" ? body.prompt : undefined,
  });
  const res = NextResponse.json({ success: true, data });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
