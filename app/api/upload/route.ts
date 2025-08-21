import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const files = form.getAll("files") as File[];

  if (!files.length) return NextResponse.json({ fileUrls: [] });

  const urls: string[] = [];
  const dir = join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });

  for (const f of files) {
    const arrayBuffer = await f.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const safeName = `${Date.now()}-${f.name.replace(/[^\w.-]/g, "_")}`;
    const filePath = join(dir, safeName);
    await writeFile(filePath, buffer);
    urls.push(`/uploads/${safeName}`);
  }

  return NextResponse.json({ fileUrls: urls });
}

export async function GET() {
  return NextResponse.json({ ok: true, route: "upload", method: "GET" });
}
