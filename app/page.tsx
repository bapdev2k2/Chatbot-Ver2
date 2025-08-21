"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { Mic, MicOff, Send, Settings, Sparkles, ImageIcon, X, Crown, Gem } from "lucide-react"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
type TrainingState = { prompt: string; updatedAt: string | null }
type Preset = { id: string; name: string; prompt: string; updatedAt: string }
type ChatMsg = { role: "user" | "assistant"; content: string; imageUrls?: string[] }

// local presets
const LS_KEY = "training_presets_v1"
const loadPresets = (): Preset[] => { try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]") } catch { return [] } }
const savePresets = (arr: Preset[]) => { try { localStorage.setItem(LS_KEY, JSON.stringify(arr.slice(0, 50))) } catch {} }
const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("vi-VN") : "")

/** ===== Speech API shims ===== */
interface SRInstance { lang: string; continuous: boolean; interimResults: boolean; onstart?: () => void; onend?: () => void; onerror?: (e: Event) => void; onresult?: (e: SpeechRecognitionEventLike) => void; start(): void; stop(): void; abort(): void }
type SRConstructor = new () => SRInstance
interface SpeechRecognitionEventLike { resultIndex: number; results: SpeechRecognitionResultList }
type WindowWithSpeech = Window & Partial<{ SpeechRecognition: SRConstructor; webkitSpeechRecognition: SRConstructor }>

function normalizeTraining(x: any): TrainingState {
  return { prompt: typeof x?.prompt === "string" ? x.prompt : "", updatedAt: x?.updatedAt ?? null }
}

export default function Page() {
  // Training (server snapshot)
  const [training, setTraining] = useState<TrainingState>({ prompt: "", updatedAt: null })

  // Presets (client)
  const [presetName, setPresetName] = useState("")
  const [presets, setPresets] = useState<Preset[]>([])
  const [selectedPresetId, setSelectedPresetId] = useState("")
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editPrompt, setEditPrompt] = useState("")
  const [saving, setSaving] = useState(false)

  // Chat
  const [input, setInput] = useState("")
  const [images, setImages] = useState<string[]>([])
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [loading, setLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [showTraining, setShowTraining] = useState(false)

  const recognitionRef = useRef<SRInstance | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const msgEndRef = useRef<HTMLDivElement>(null)
  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])
const router = useRouter()
const [loggingOut, setLoggingOut] = useState(false)

async function onLogout() {
  setLoggingOut(true)
  try {
    await fetch("/api/auth/logout", { method: "POST" })
  } catch {}
  router.replace("/login") // về trang login dù API có lỗi cũng thoát phiên
}
  // Init training + presets
  useEffect(() => {
    fetch("/api/training")
      .then((r) => r.json())
      .then((j) => setTraining(normalizeTraining(j?.data || j)))
      .catch(() => {})
    setPresets(loadPresets())
  }, [])

  // SpeechRecognition
  useEffect(() => {
    if (typeof window === "undefined") return
    const w = window as WindowWithSpeech
    const SR: SRConstructor | undefined = w.SpeechRecognition ?? w.webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.lang = "vi-VN"; rec.continuous = false; rec.interimResults = true
    rec.onstart = () => setIsRecording(true)
    rec.onend = () => setIsRecording(false)
    rec.onerror = () => setIsRecording(false)
    rec.onresult = (e: SpeechRecognitionEventLike) => {
      let t = ""
      for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript
      t = t.trim(); if (!t) return
      setInput((prev) => (prev ? prev + " " + t : t))
    }
    recognitionRef.current = rec
    return () => { try { rec.abort() } catch {}; recognitionRef.current = null }
  }, [])

  function toggleMic() {
    const rec = recognitionRef.current
    if (!rec) { alert("Trình duyệt không hỗ trợ ghi âm (SpeechRecognition)."); return }
    try { isRecording ? rec.stop() : rec.start() } catch { alert("Không thể bật mic.") }
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
  // giữ tham chiếu trước khi await
  const inputEl = e.currentTarget as HTMLInputElement | null;
  const f = inputEl?.files?.[0];
  if (!f) return;

  const fd = new FormData();
  fd.append("files", f);

  try {
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    const j = await r.json();
    if (j?.fileUrls?.[0]) {
      setImages((prev) => [...prev, j.fileUrls[0]].slice(0, 5));
    }
  } finally {
    // reset file input (dùng cả hai đường cho chắc)
    if (inputEl) inputEl.value = "";
    if (fileRef.current) fileRef.current.value = "";
  }
}


  // Chuẩn hoá lịch sử chat
  function makeSafeMessages(history: ChatMsg[], next?: ChatMsg): ChatMsg[] {
    const arr = next ? [...history, next] : [...history]
    return arr
      .map((m) => ({ role: m.role, content: (m.content ?? "").trim(), imageUrls: (m.imageUrls?.filter(Boolean) ?? []).slice(0, 5) }))
      .filter((m) => m.content.length > 0 || (m.imageUrls && m.imageUrls.length > 0))
  }

  async function sendChat() {
    if (!input.trim() && images.length === 0) return
    setLoading(true)
    const userMsg: ChatMsg = { role: "user", content: input.trim(), imageUrls: images }
    setMessages((prev) => [...prev, userMsg])
    try {
      const safeMessages = makeSafeMessages(messages, userMsg)
      const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: safeMessages }) })
      const j = await r.json()
      setMessages((prev) => [...prev, { role: "assistant", content: j?.text || j?.error?.message || "No response" }])
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Lỗi gọi API." }])
    } finally {
      setLoading(false); setImages([]); setInput("")
    }
  }

  // ===== PATCH training prompt lên server (Dùng) =====
  async function applyPromptToServer(prompt: string) {
    setSaving(true)
    try {
      const r = await fetch("/api/training", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) })
      const j = await r.json()
      setTraining(normalizeTraining(j?.data || j))
    } finally { setSaving(false) }
  }

  // ===== Lưu preset (KHÔNG áp dụng) =====
  async function savePresetOnly() {
    const promptStr = (training.prompt ?? "").trim()
    if (!promptStr) return
    const preset: Preset = {
      id: (crypto as any).randomUUID?.() || String(Date.now()),
      name: (presetName?.trim()) || (promptStr.split("\n")[0]?.slice(0, 40) || "Preset không tên"),
      prompt: promptStr,
      updatedAt: new Date().toISOString(),
    }
    const next = [preset, ...presets].slice(0, 50)
    setPresets(next); savePresets(next)
    setPresetName("")      // dọn ô tên preset
    // KHÔNG patch server ở đây
  }

  function applySelectedPreset() {
    const p = presets.find((x) => x.id === selectedPresetId)
    if (!p) return
    applyPromptToServer(p.prompt)     // Dùng = áp dụng lên server
  }

  // CRUD preset local
  function startEditPreset(p: Preset) {
    setEditingPresetId(p.id); setEditName(p.name); setEditPrompt(p.prompt)
  }
  function cancelEditPreset() {
    setEditingPresetId(null); setEditName(""); setEditPrompt("");
  }
  function saveEditPreset() {
    setPresets((prev) => {
      const next = prev.map((p) => p.id === editingPresetId
        ? { ...p, name: (editName.trim() || p.name), prompt: editPrompt, updatedAt: new Date().toISOString() }
        : p)
      savePresets(next); return next
    })
    cancelEditPreset()
  }
  function deletePreset(id: string) {
    setPresets((prev) => { const next = prev.filter((p) => p.id !== id); savePresets(next); return next })
    if (selectedPresetId === id) setSelectedPresetId("")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-background relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl floating-element"></div>
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-accent/5 rounded-full blur-3xl floating-element" style={{ animationDelay: "2s" }}></div>
        <div className="absolute top-1/2 left-1/3 w-24 h-24 bg-secondary/5 rounded-full blur-2xl floating-element" style={{ animationDelay: "4s" }}></div>
      </div>

      <header className="fixed top-0 z-100 w-full glass-morphism border-b border-border/50 luxury-shadow">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl vietnamese-gradient flex items-center justify-center luxury-shadow"><Crown className="w-6 h-6 text-primary-foreground" /></div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-accent rounded-full flex items-center justify-center"><Gem className="w-2 h-2 text-accent-foreground" /></div>
              </div>
              <div>
                <h1 className="text-3xl font-bold font-serif golden-shimmer">BapDev AI</h1>
                <p className="text-sm text-muted-foreground font-medium">Trợ lý AI thông minh • Phong cách Việt Nam</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {loading && (
                <div className="flex items-center gap-3 text-sm text-muted-foreground glass-morphism px-4 py-2 rounded-full">
                  <div className="w-3 h-3 bg-primary rounded-full luxury-pulse"></div>
                  <span className="font-medium">Đang xử lý...</span>
                </div>
              )}
              {/* Nút Đăng xuất */}
  <button
    onClick={onLogout}
    disabled={loggingOut}
    className="p-3 rounded-xl hover:bg-destructive/10 transition-all duration-300 group luxury-shadow disabled:opacity-50"
    title="Đăng xuất"
  >
    <LogOut className="w-5 h-5 text-destructive group-hover:scale-110 transition-transform" />
  </button>
              <button onClick={() => setShowTraining(!showTraining)} className="p-3 rounded-xl hover:bg-primary/10 transition-all duration-300 group luxury-shadow" title="Cài đặt training">
                <Settings className="w-5 h-5 text-primary group-hover:rotate-90 transition-transform duration-300" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mt-20 mx-auto px-6 py-12 space-y-10 relative z-10">
        {showTraining && (
          <section className="glass-morphism border border-border/50 rounded-3xl p-8 luxury-shadow">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Settings className="w-5 h-5 text-primary" /></div>
              <h2 className="text-2xl font-bold font-serif text-foreground">Cấu hình Training</h2>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold mb-3 text-foreground">Training Prompt</label>
                <textarea
                  className="w-full bg-input/50 border border-border/50 rounded-2xl p-6 focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all duration-300 resize-none backdrop-blur-sm font-medium"
                  rows={6}
                  placeholder="Nhập hướng dẫn training cho AI..."
                  value={training.prompt ?? ""}
                  onChange={(e) => setTraining((s) => ({ ...s, prompt: e.target.value }))}
                />
              </div>

              {/* Hàng thao tác: Chọn preset & Dùng / Lưu preset (không áp dụng) */}
              <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <select className="bg-input/50 w-[200px] border border-border/50 rounded-xl px-3 py-2" value={selectedPresetId} onChange={(e) => setSelectedPresetId(e.target.value)}>
                    <option value="">— Chọn preset —</option>
                    {presets.map((p) => <option key={p.id} value={p.id}>{p.name} • {fmt(p.updatedAt)}</option>)}
                  </select>
                  <button type="button" onClick={applySelectedPreset} className="px-4 py-2 glass-morphism rounded-xl border border-border/50 hover:bg-primary/10" disabled={!selectedPresetId || saving}>
                    Dùng
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <input type="text" className="bg-input/50 border border-border/50 rounded-xl px-3 py-2" placeholder="Tên preset (tuỳ chọn)" value={presetName} onChange={(e) => setPresetName(e.target.value)} />
                  <button
                    onClick={savePresetOnly}
                    className="px-4 py-2 vietnamese-gradient text-primary-foreground rounded-xl hover:shadow-lg disabled:opacity-50"
                    disabled={saving || !((training.prompt ?? "").trim())}
                  >
                    Lưu
                  </button>
                </div>
              </div>

              {/* Danh sách presets */}
              {presets.length > 0 && (
                <div className="mt-6">
                  <div className="font-semibold mb-2">Presets gần đây</div>
                  <div className="max-h-64 overflow-auto border border-border/50 rounded-2xl divide-y">
                    {presets.map((p) => (
                      <div key={p.id} className="px-4 py-3">
                        {editingPresetId === p.id ? (
                          <div className="space-y-2">
                            <input className="w-full bg-input/50 border border-border/50 rounded-xl px-3 py-2" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Tên preset" />
                            <textarea className="w-full bg-input/50 border border-border/50 rounded-xl p-3" rows={4} value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)} />
                            <div className="flex items-center gap-2">
                              <button onClick={saveEditPreset} className="px-3 py-1.5 vietnamese-gradient text-primary-foreground rounded-xl">Lưu</button>
                              <button onClick={cancelEditPreset} className="px-3 py-1.5 glass-morphism rounded-xl border border-border/50">Hủy</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-medium truncate">{p.name}</div>
                              <div className="text-xs text-muted-foreground">Cập nhật: {fmt(p.updatedAt)}</div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button className="px-2 py-1 text-sm glass-morphism rounded-xl border border-border/50" onClick={() => { setTraining((s) => ({ ...s, prompt: p.prompt })) }}>Nạp</button>
                              <button className="px-2 py-1 text-sm vietnamese-gradient text-primary-foreground rounded-xl" onClick={() => applyPromptToServer(p.prompt)}>Dùng</button>
                              <button className="px-2 py-1 text-sm glass-morphism rounded-xl border border-border/50" onClick={() => startEditPreset(p)}>Sửa</button>
                              <button className="px-2 py-1 text-sm bg-destructive text-destructive-foreground rounded-xl" onClick={() => deletePreset(p.id)}>Xóa</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Chat */}
        <section className="glass-morphism border border-border/50 rounded-3xl luxury-shadow overflow-hidden">
          <div className="p-8 border-b border-border/50 vietnamese-gradient">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center"><Sparkles className="w-5 h-5 text-primary-foreground" /></div>
              <h2 className="text-2xl font-bold font-serif text-primary-foreground">Trò chuyện với AI</h2>
            </div>
          </div>

          <div className="p-8 space-y-8">
            {/* Lịch sử */}
            <div className="max-h-[380px] overflow-y-auto space-y-4 p-6 glass-morphism rounded-2xl border border-border/50">
              {messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">Bắt đầu trò chuyện với AI…</p>
              ) : (
                messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "assistant" ? "justify-start" : "justify-end"}`}>
                    <div className={`px-4 py-3 rounded-2xl luxury-shadow ${m.role === "assistant" ? "bg-card text-foreground" : "vietnamese-gradient text-primary-foreground"}`}>
                      <div className="whitespace-pre-wrap">{m.content}</div>
                      {m.imageUrls?.length ? (
                        <div className="mt-3 flex gap-2">
                          {m.imageUrls.map((u, idx) => (<img key={idx} src={u} className="w-16 h-16 object-cover rounded-xl border border-border/50" />))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
              <div ref={msgEndRef} />
            </div>

            {/* Ô nhập */}
            <div className="space-y-6">
              <div className="relative">
                <textarea
                  className="w-full bg-input/50 border border-border/50 rounded-2xl p-6 pr-16 focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all duration-300 resize-none min-h-[120px] backdrop-blur-sm font-medium"
                  placeholder="Nhập câu hỏi hoặc yêu cầu của bạn..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !saving) { e.preventDefault(); sendChat() } }}
                />
                <div className="absolute bottom-4 right-4 text-xs text-muted-foreground font-medium">Enter để gửi</div>
              </div>

              {/* Ảnh đã chọn */}
              {images.length > 0 && (
                <div className="flex gap-4 flex-wrap p-6 glass-morphism rounded-2xl border border-border/50">
                  {images.map((url, i) => (
                    <div key={i} className="relative group">
                      <img src={url || "/placeholder.svg"} alt={`Ảnh ${i + 1}`} className="w-24 h-24 object-cover rounded-xl border-2 border-border/50 luxury-shadow group-hover:scale-105 transition-transform duration-300" />
                      <button className="absolute -top-2 -right-2 w-7 h-7 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 luxury-shadow"
                        onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}>
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Action */}
              <div className="flex items-center gap-4">
                <input ref={fileRef} type="file" hidden accept="image/*" onChange={onUpload} />

                <button className="flex items-center gap-3 px-6 py-3 glass-morphism hover:bg-primary/10 rounded-xl transition-all duration-300 border border-border/50 font-medium group" onClick={() => fileRef.current?.click()} disabled={loading}>
                  <ImageIcon className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                  <span className="hidden sm:inline">Tải ảnh</span>
                </button>

                <button type="button" onClick={toggleMic} disabled={loading}
                  className={`flex items-center gap-3 px-6 py-3 rounded-xl transition-all duration-300 font-medium border border-border/50 ${isRecording ? "bg-destructive text-destructive-foreground luxury-pulse luxury-shadow" : "glass-morphism hover:bg-accent/10 group"}`}>
                  {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-accent group-hover:scale-110 transition-transform" />}
                  <span className="hidden sm:inline">{isRecording ? "Dừng ghi" : "Ghi âm"}</span>
                </button>

                <div className="flex-1" />

                <button className="flex items-center gap-3 px-8 py-3 vietnamese-gradient text-primary-foreground rounded-xl hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 font-bold luxury-shadow group"
                  onClick={sendChat} disabled={loading || saving || (!input.trim() && images.length === 0)}>
                  {loading ? (<><div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"></div>Đang gửi...</>) : (<><Send className="w-5 h-5 group-hover:translate-x-1 transition-transform" />Gửi</>)}
                </button>
              </div>
            </div>
          </div>
        </section>

        <footer className="text-center py-8">
          <p className="text-sm text-muted-foreground font-medium">
            Được phát triển bởi <span className="font-bold golden-shimmer">BapDev</span> • Trợ lý AI thông minh cho mọi nhu cầu • <span className="text-primary font-semibold">Phong cách Việt Nam</span>
          </p>
        </footer>
      </main>
    </div>
  )
}
