import { join } from "path";
import { promises as fs } from "fs";
import { Redis } from "@upstash/redis";

// ===== Redis (nếu set env) =====
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! })
    : null;

export type UserRec = {
  id: string;
  email: string;
  name?: string | null;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
};

function key(email: string) {
  return `user:${email.toLowerCase()}`;
}

// ===== Store path =====
// Ưu tiên biến môi trường, mặc định ./data/users.json (bundled)
let STORE_PATH = process.env.AUTH_STORE_PATH || join(process.cwd(), "data", "users.json");
console.log("STORE_PATH đang dùng:", STORE_PATH);

// --------- READ-ONLY SAFE READ ----------
type Store = { users: UserRec[] };

// Đọc KHÔNG ghi: không gọi ensureFile, không mkdir, không write.
// Nếu đọc thất bại (EROFS/ENOENT), fallback sang import bunded JSON.
async function readStore(): Promise<Store> {
  try {
    const txt = await fs.readFile(STORE_PATH, "utf8");
    return JSON.parse(txt) as Store;
  } catch (e: any) {
    if (e.code === "EACCES" || e.code === "EROFS" || e.code === "ENOENT") {
      try {
        // đường dẫn import tuỳ theo cấu trúc project; với Next.js (tsconfig baseUrl="@"):
        const mod = await import("@/data/users.json");
        const data = (mod as any).default ?? (mod as any);
        // đảm bảo shape
        if (Array.isArray(data?.users)) return { users: data.users as UserRec[] };
        if (Array.isArray(data)) return { users: data as UserRec[] };
        return { users: [] };
      } catch {
        return { users: [] };
      }
    }
    throw e;
  }
}

// Ghi có điều kiện: local/VPS được, Vercel sẽ ném EROFS → bỏ qua
async function writeStore(data: Store): Promise<void> {
  try {
    await fs.writeFile(STORE_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch (e: any) {
    if (e.code === "EACCES" || e.code === "EROFS") {
      // read-only env (Vercel) → bỏ qua
      return;
    }
    throw e;
  }
}

// ===== API =====
export async function getUserByEmail(email: string): Promise<UserRec | undefined> {
  if (redis) return (await redis.get<UserRec>(key(email))) ?? undefined;

  const db = await readStore();
  // Nếu lỡ có nhiều record trùng email → lấy bản mới nhất theo createdAt/updatedAt
  const matches = db.users.filter(u => u.email.toLowerCase() === email.toLowerCase());
  if (matches.length <= 1) return matches[0];
  matches.sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt));
  return matches[0];
}

export async function createUser(u: { email: string; name?: string | null; passwordHash: string }): Promise<UserRec> {
  if (redis) {
    const now = new Date().toISOString();
    const rec: UserRec = {
      id: (globalThis as any).crypto?.randomUUID?.() || String(Date.now()),
      email: u.email,
      name: u.name ?? null,
      passwordHash: u.passwordHash,
      createdAt: now,
      updatedAt: now,
    };
    const ok = await redis.set(key(u.email), rec, { nx: true });
    if (ok !== "OK") throw new Error("Email đã tồn tại.");
    return rec;
  }

  // File store (local/VPS có volume). Vercel sẽ no-op khi write (EROFS).
  const db = await readStore();

  // chống trùng email
  const has = db.users.some(x => x.email.toLowerCase() === u.email.toLowerCase());
  if (has) throw new Error("Email đã tồn tại.");

  const now = new Date().toISOString();
  const rec: UserRec = {
    id: (globalThis as any).crypto?.randomUUID?.() || String(Date.now()),
    email: u.email,
    name: u.name ?? null,
    passwordHash: u.passwordHash,
    createdAt: now,
    updatedAt: now,
  };
  db.users.unshift(rec);
  if (db.users.length > 10000) db.users = db.users.slice(0, 10000);

  await writeStore(db); // Vercel read-only → silently no-op
  return rec;
}
