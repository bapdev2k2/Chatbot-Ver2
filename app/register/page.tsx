"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Crown } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setOk(""); setLoading(true);
    if (password !== confirm) { setErr("Mật khẩu nhập lại không khớp."); setLoading(false); return; }
    try {
      const r = await fetch("/api/auth/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) { setErr(j.error || "Đăng ký thất bại."); return; }
      setOk("Đăng ký thành công! Chuyển đến trang đăng nhập...");
      setTimeout(() => router.replace("/login"), 1000);
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
            <h1 className="text-2xl font-bold">Đăng ký</h1>
            <p className="text-sm text-muted-foreground">Tạo tài khoản mới</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <input type="text" placeholder="Tên hiển thị (tuỳ chọn)" className="w-full bg-input/50 border border-border/50 rounded-xl px-4 py-3"
                 value={name} onChange={e => setName(e.target.value)} />
          <input type="email" placeholder="Email" className="w-full bg-input/50 border border-border/50 rounded-xl px-4 py-3"
                 value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="Mật khẩu (≥ 6 ký tự)" className="w-full bg-input/50 border border-border/50 rounded-xl px-4 py-3"
                 value={password} onChange={e => setPassword(e.target.value)} required />
          <input type="password" placeholder="Nhập lại mật khẩu" className="w-full bg-input/50 border border-border/50 rounded-xl px-4 py-3"
                 value={confirm} onChange={e => setConfirm(e.target.value)} required />
          {err && <div className="text-sm text-red-500">{err}</div>}
          {ok && <div className="text-sm text-green-600">{ok}</div>}
          <button type="submit" disabled={loading}
                  className="w-full py-3 vietnamese-gradient text-primary-foreground rounded-xl font-semibold disabled:opacity-50">
            {loading ? "Đang tạo..." : "Đăng ký"}
          </button>
        </form>

        <div className="text-sm text-center">
          Đã có tài khoản? <a href="/login" className="text-primary underline-offset-4 hover:underline">Đăng nhập</a>
        </div>
      </div>
    </div>
  );
}
