import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createUser, getUserByEmail } from "@/lib/user-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const schema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(1).max(100).optional(),
  password: z.string().min(6).max(100),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, name, password } = schema.parse(body);

    const existed = await getUserByEmail(email);
    if (existed) return NextResponse.json({ ok: false, error: "Email đã tồn tại." }, { status: 400 });

    const passwordHash = await bcrypt.hash(password, 10);
    await createUser({ email, name, passwordHash });

    return NextResponse.json({ ok: true, message: "Đăng ký thành công." });
  } catch (e: any) {
    const msg = e?.issues?.[0]?.message || e?.message || "Lỗi đăng ký.";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
