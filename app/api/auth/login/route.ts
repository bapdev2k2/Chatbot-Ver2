import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getUserByEmail } from "@/lib/user-store";
import { signSession, setSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(100),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = schema.parse(body);

    const user = await getUserByEmail(email);
    if (!user) return NextResponse.json({ ok: false, error: "Sai email hoặc mật khẩu." }, { status: 401 });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return NextResponse.json({ ok: false, error: "Sai email hoặc mật khẩu." }, { status: 401 });

    const token = await signSession({ sub: user.id, email: user.email, name: user.name });
    const res = NextResponse.json({ ok: true, message: "Đăng nhập thành công." });
    setSessionCookie(res, token);
    return res;
  } catch (e: any) {
    const msg = e?.issues?.[0]?.message || e?.message || "Lỗi đăng nhập.";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
