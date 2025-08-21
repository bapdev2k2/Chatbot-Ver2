import { join, dirname } from "path";
import { promises as fs } from "fs";
import { Redis } from "@upstash/redis";

// ====== Redis (nếu có biến env) ======
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! })
  : null;

export type UserRec = {
  id: string; email: string; name?: string | null;
  passwordHash: string; createdAt: string; updatedAt: string;
};

function key(email: string) { return `user:${email.toLowerCase()}`; }

// ====== Redis path ======
export async function getUserByEmail(email: string): Promise<UserRec | undefined> {
  if (redis) return (await redis.get<UserRec>(key(email))) ?? undefined;
  return getUserByEmailFromFile(email);
}
export async function createUser(u: { email: string; name?: string | null; passwordHash: string; }): Promise<UserRec> {
  if (redis) {
    const now = new Date().toISOString();
    const rec: UserRec = {
      id: crypto.randomUUID?.() || String(Date.now()),
      email: u.email, name: u.name ?? null,
      passwordHash: u.passwordHash, createdAt: now, updatedAt: now,
    };
    // set if not exists (bảo toàn unique email)
    const ok = await redis.set(key(u.email), rec, { nx: true });
    if (ok !== "OK") throw new Error("Email đã tồn tại.");
    return rec;
  }
  return createUserInFile(u);
}

// ====== Fallback file (chạy trên VPS/Render có volume) ======
type Store = { users: UserRec[] };

let STORE_PATH =
  process.env.AUTH_STORE_PATH
  ?? (process.env.VERCEL === "1" || process.env.AWS_LAMBDA_FUNCTION_NAME ? "/tmp/users.json" : join(process.cwd(), "data", "users.json"));

async function ensureFile(): Promise<void> {
  try {
    await fs.mkdir(dirname(STORE_PATH), { recursive: true });
    await fs.access(STORE_PATH).catch(() => fs.writeFile(STORE_PATH, JSON.stringify({ users: [] }, null, 2), "utf8"));
  } catch (e: any) {
    // nếu path không ghi được (EROFS) → rơi về /tmp
    if ((e.code === "EROFS" || e.code === "EACCES") && STORE_PATH !== "/tmp/users.json") {
      STORE_PATH = "/tmp/users.json";
      await fs.writeFile(STORE_PATH, JSON.stringify({ users: [] }, null, 2), "utf8");
    } else {
      throw e;
    }
  }
}
async function readStore(): Promise<Store> {
  await ensureFile();
  const txt = await fs.readFile(STORE_PATH, "utf8");
  try { return JSON.parse(txt) as Store; } catch { return { users: [] }; }
}
async function writeStore(data: Store): Promise<void> {
  await ensureFile();
  await fs.writeFile(STORE_PATH, JSON.stringify(data, null, 2), "utf8");
}

async function getUserByEmailFromFile(email: string) {
  const db = await readStore();
  return db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
}
async function createUserInFile(u: { email: string; name?: string | null; passwordHash: string; }): Promise<UserRec> {
  const db = await readStore();
  if (db.users.some(x => x.email.toLowerCase() === u.email.toLowerCase())) {
    throw new Error("Email đã tồn tại.");
  }
  const now = new Date().toISOString();
  const rec: UserRec = {
    id: crypto.randomUUID?.() || String(Date.now()),
    email: u.email, name: u.name ?? null,
    passwordHash: u.passwordHash, createdAt: now, updatedAt: now,
  };
  db.users.unshift(rec);
  if (db.users.length > 10000) db.users = db.users.slice(0, 10000);
  await writeStore(db);
  return rec;
}
