// app/api/upload/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ENV: cần có KIE_API_KEY; KIE_BASE_URL có thể để mặc định
const API_KEY = process.env.KIE_API_KEY;
const BASE_URL = process.env.KIE_BASE_URL || "https://kieai.redpandaai.co";
const ENDPOINT = `${BASE_URL.replace(/\/+$/, "")}/api/file-stream-upload`;

if (!API_KEY) {
  console.warn("[upload] Missing KIE_API_KEY env");
}

async function uploadToKie(file: File, uploadPath = "images/user-uploads"): Promise<string> {
  if (!API_KEY) throw new Error("KIE_API_KEY is not set");

  // Dùng Web FormData (có sẵn trong runtime Node 20 của Next)
  const fd = new FormData();
  fd.append("uploadPath", uploadPath);
  fd.append("fileName", file.name || "upload.bin");
  fd.append("file", file); // Web File lấy từ req.formData()

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}` },
    body: fd,
  });

  // Kie.ai trả JSON dạng { success, code, msg, data:{ downloadUrl, ... } }
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j?.success || !j?.data?.downloadUrl) {
    throw new Error(j?.msg || j?.error || `Upload failed (${res.status})`);
  }
  return j.data.downloadUrl as string;
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    // Client của bạn đang gửi "files"
    const files = form.getAll("files").filter(Boolean) as File[];
    if (!files.length) return NextResponse.json({ fileUrls: [] });

    // tuỳ ý: cho phép client truyền uploadPath khác
    const uploadPath = (form.get("uploadPath") as string) || "images/user-uploads";

    const urls = await Promise.all(files.map((f) => uploadToKie(f, uploadPath)));
    return NextResponse.json({ fileUrls: urls });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Upload lỗi." }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, route: "upload", via: "kie.ai" });
}
