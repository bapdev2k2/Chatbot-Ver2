// app/api/chat/route.ts
import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join, extname } from "path";
import { getTraining } from "@/lib/training-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const FALLBACK_SYSTEM = process.env.SYSTEM_PROMPT || "Bạn là trợ lý hữu ích.";

// ---- helpers ----
function guessMime(p: string): string {
  const e = extname(p).toLowerCase();
  if (e === ".jpg" || e === ".jpeg") return "image/jpeg";
  if (e === ".png") return "image/png";
  if (e === ".webp") return "image/webp";
  return "application/octet-stream";
}

async function urlToInlineData(url: string): Promise<{ mimeType: string; data: string } | null> {
  try {
    if (url.startsWith("/uploads/")) {
      const abs = join(process.cwd(), "public", url);
      const buf = await readFile(abs);
      return { mimeType: guessMime(abs), data: buf.toString("base64") };
    }
    const r = await fetch(url);
    if (!r.ok) return null;
    const ab = await r.arrayBuffer();
    const mt = r.headers.get("content-type") || guessMime(url);
    return { mimeType: mt, data: Buffer.from(ab).toString("base64") };
  } catch {
    return null;
  }
}

type Msg = { role: "user" | "assistant" | "system"; content?: string; imageUrl?: string; imageUrls?: string[] };
type ChatBody = { messages?: Msg[]; model?: string };

function toGeminiContents(chatMessages: Msg[]) {
  return chatMessages.map((m) => {
    const role = m.role === "assistant" ? "model" : "user";
    const text = (m.content ?? "").trim();
    const parts: any[] = [];
    if (text) parts.push({ text });
    if (parts.length === 0) parts.push({ text: " " });
    return { role, parts };
  });
}

export async function POST(req: Request) {
  try {
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ ok: false, error: { message: "Missing GEMINI_API_KEY" } }, { status: 500 });
    }

    const { messages = [], model = GEMINI_MODEL } = ((await req.json().catch(() => ({}))) as ChatBody) ?? {};

    // Lấy prompt đang áp dụng LÀM systemInstruction duy nhất
    const { prompt: trainingPrompt } = getTraining();
    const systemText = (trainingPrompt && trainingPrompt.trim()) || FALLBACK_SYSTEM;

    const chatMessages = messages.filter((m) => {
      const hasText = typeof m.content === "string" && m.content.trim().length > 0;
      const hasImage = Boolean(m.imageUrl) || (Array.isArray(m.imageUrls) && m.imageUrls.length > 0);
      return hasText || hasImage;
    });
    if (!chatMessages.length) {
      return NextResponse.json({ ok: false, error: { message: "Empty prompt." } }, { status: 400 });
    }

    const contents: any[] = toGeminiContents(chatMessages);
    // nhúng ảnh base64 để model "thấy" đúng ảnh theo prompt training
    for (let i = 0; i < chatMessages.length; i++) {
      const msg = chatMessages[i];
      const content = contents[i];
      const urls = (Array.isArray(msg.imageUrls) && msg.imageUrls.length ? msg.imageUrls : msg.imageUrl ? [msg.imageUrl] : []) as string[];
      for (const u of urls) {
        const id = await urlToInlineData(u);
        if (id) content.parts.push({ inlineData: { data: id.data, mimeType: id.mimeType } });
      }
    }

    const body = {
      systemInstruction: { role: "system", parts: [{ text: systemText }] },
      contents,
      generationConfig: { temperature: 0.35, topP: 0.9 },
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "cache-control": "no-store" },
      body: JSON.stringify(body),
    });
    const j = await r.json();

    const text =
      j?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).join("") ||
      j?.candidates?.[0]?.content?.parts?.[0]?.text ||
      j?.text ||
      "Xin lỗi, tôi chưa có câu trả lời.";

    const res = NextResponse.json({ ok: true, text });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: { message: String(e?.message || e) } }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, route: "chat", method: "GET" });
}
