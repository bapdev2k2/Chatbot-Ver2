import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
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

// ... giữ nguyên import + schema

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = schema.parse(body);

    // 1) Chuẩn hoá password để loại ký tự ẩn
    const pwdRaw = String(password ?? "");
    const pwd = pwdRaw.normalize("NFKC").trim();

    console.log("📥 Email:", email);
    console.log("ℹ️ len(pwdRaw)=", pwdRaw.length, "len(pwd)=", pwd.length);
    console.log("🔤 pwdRaw char codes=", Array.from(pwdRaw).map(c => c.charCodeAt(0)));

    const user = await getUserByEmail(email);
    console.log("🔍 User:", user ? { id: user.id, email: user.email, name: user.name } : null);
    if (!user) return NextResponse.json({ ok:false, error:"Sai email hoặc mật khẩu." }, { status:401 });

    // 2) Làm sạch hash & kiểm tra
    const storedHash = String(user.passwordHash ?? "").trim();
    console.log("ℹ️ hashLen=", storedHash.length, "hashHead=", storedHash.slice(0, 20));
    // ⚠️ dán HASH bạn vừa tạo bằng node data/hash.js vào đây để so cứng
    const literalHash = "$2b$10$CkOXqyNUK8VX5r4er7eaaes8D7yUPU0ay92jvRagkjm1RbITQYCt6";
    console.log("🔁 equalsLiteral=", storedHash === literalHash);

    if (storedHash.length !== 60) {
      console.log("⚠️ Hash length invalid!");
      return NextResponse.json({ ok:false, error:"Sai email hoặc mật khẩu." }, { status:401 });
    }

    // 3) Ba phép test quyết định
    // 3.1 Tự hash rồi tự compare (phải TRUE) → xác minh bcrypt hoạt động OK
    const sanityHash = await bcrypt.hash(pwd, 10);
    const sanityOk = await bcrypt.compare(pwd, sanityHash);
    console.log("🧪 sanity self-compare =", sanityOk);

    // 3.2 Compare với HASH literal bạn vừa tạo (phải TRUE nếu pwd đúng và hash dán đúng)
    const hardOk = await bcrypt.compare(pwd, literalHash);
    console.log("🧪 hardCompare(literal) =", hardOk);

    // 3.3 Compare với hash lấy từ users.json (mục tiêu cuối)
    const ok = await bcrypt.compare(pwd, storedHash);
    console.log("🔐 compare(storedHash) =", ok);

    if (!ok) return NextResponse.json({ ok:false, error:"Sai email hoặc mật khẩu." }, { status:401 });

    const token = await signSession({ sub: user.id, email: user.email, name: user.name });
    const res = NextResponse.json({ ok:true, message:"Đăng nhập thành công." });
    setSessionCookie(res, token);
    return res;
  } catch (e:any) {
    console.error("💥 Lỗi POST /api/auth/login:", e);
    const msg = e?.issues?.[0]?.message || e?.message || "Lỗi đăng nhập.";
    return NextResponse.json({ ok:false, error: msg }, { status:400 });
  }
}

