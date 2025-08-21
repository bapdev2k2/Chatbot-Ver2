// lib/user-store.ts
import { promises as fs } from "fs";
import { join, dirname } from "path";

export type UserRec = {
  id: string;
  email: string;
  name?: string | null;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
};

type Store = { users: UserRec[] };

const STORE_PATH = process.env.AUTH_STORE_PATH || join(process.cwd(), "data", "users.json");

async function ensureFile(): Promise<void> {
  try {
    await fs.mkdir(dirname(STORE_PATH), { recursive: true });
    await fs.access(STORE_PATH);
  } catch {
    const init: Store = { users: [] };
    await fs.writeFile(STORE_PATH, JSON.stringify(init, null, 2), "utf8");
  }
}

async function readStore(): Promise<Store> {
  await ensureFile();
  const txt = await fs.readFile(STORE_PATH, "utf8");
  try { return JSON.parse(txt) as Store; } catch { return { users: [] }; }
}

async function writeStore(data: Store): Promise<void> {
  await fs.writeFile(STORE_PATH, JSON.stringify(data, null, 2), "utf8");
}

export async function getUserByEmail(email: string): Promise<UserRec | undefined> {
  const db = await readStore();
  return db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
}

export async function createUser(u: { email: string; name?: string | null; passwordHash: string; }): Promise<UserRec> {
  const db = await readStore();
  const now = new Date().toISOString();
  const rec: UserRec = {
    id: crypto.randomUUID?.() || String(Date.now()),
    email: u.email,
    name: u.name ?? null,
    passwordHash: u.passwordHash,
    createdAt: now,
    updatedAt: now,
  };
  db.users.unshift(rec);
  // giữ tối đa 10k user cho an toàn
  if (db.users.length > 10000) db.users = db.users.slice(0, 10000);
  await writeStore(db);
  return rec;
}
