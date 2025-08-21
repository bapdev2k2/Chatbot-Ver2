"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Crown } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) { setErr(j.error || "Đăng nhập thất bại."); return; }
      router.replace("/");
    } catch { setErr("Có lỗi xảy ra."); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-card to-background p-6">
      <div className="w-full max-w-md glass-morphism rounded-3xl border border-border/50 p-8 space-y-6 luxury-shadow">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl vietnamese-gradient flex items-center justify-center">
            <Crown className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Đăng nhập</h1>
            <p className="text-sm text-muted-foreground">Dùng email & mật khẩu</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <input type="email" placeholder="Email" className="w-full bg-input/50 border border-border/50 rounded-xl px-4 py-3"
                 value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="Mật khẩu" className="w-full bg-input/50 border border-border/50 rounded-xl px-4 py-3"
                 value={password} onChange={e => setPassword(e.target.value)} required />
          {err && <div className="text-sm text-red-500">{err}</div>}
          <button type="submit" disabled={loading}
                  className="w-full py-3 vietnamese-gradient text-primary-foreground rounded-xl font-semibold disabled:opacity-50">
            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>

        <div className="text-sm text-center">
          Chưa có tài khoản? <a href="/register" className="text-primary underline-offset-4 hover:underline">Đăng ký</a>
        </div>
      </div>
    </div>
  );
}
