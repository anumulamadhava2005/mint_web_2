import crypto from "crypto";
import db from "./db";
import { cacheSet, TTL } from "./cache";

export type User = {
  id: string;
  email: string;
  password_hash: string;
  salt: string;
  token?: string | null;
  created_at?: string;
};

function hashPasswordWithCost(password: string, salt: string, N: number) {
  return crypto.scryptSync(password, salt, 64, {
    N,
    r: 8,
    p: 1,
    maxmem: 128 * N * 8 * 2,
  }).toString("hex");
}

function hashPassword(password: string, salt: string) {
  return hashPasswordWithCost(password, salt, 65536);
}

// Reusable scrypt primitives for generated apps' end-user auth (see
// app/api/app-auth/[projectId]). Same cost factor as the platform's own auth.
export function newSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}
export function scryptHash(password: string, salt: string): string {
  return hashPassword(password, salt);
}

// Constant-time dummy hash for timing-safe user enumeration prevention (ATK-12)
const DUMMY_SALT = "0000000000000000000000000000000000000000000000000000000000000000";
export function dummyVerifyPassword(password: string): void {
  hashPasswordWithCost(password, DUMMY_SALT, 65536);
}

export function verifyPassword(
  password: string,
  storedHash: string,
  salt: string
): { valid: boolean; rehash?: boolean; newHash?: string } {
  // Try current cost first (N=65536)
  const attempt = hashPasswordWithCost(password, salt, 65536);
  const a = Buffer.from(attempt, "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
    return { valid: true };
  }

  // Fallback: try legacy cost (N=16384)
  const legacyAttempt = hashPasswordWithCost(password, salt, 16384);
  const la = Buffer.from(legacyAttempt, "hex");
  if (la.length === b.length && crypto.timingSafeEqual(la, b)) {
    // Re-hash at current cost
    const newHash = hashPasswordWithCost(password, salt, 65536);
    return { valid: true, rehash: true, newHash };
  }

  return { valid: false };
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const res = await db.query(
    "SELECT id, email, password_hash, salt, created_at FROM users WHERE lower(email)=lower($1) LIMIT 1",
    [email]
  );
  return (res.rows && res.rows[0]) ?? null;
}

export async function createUser(email: string, password: string) {
  const existing = await findUserByEmail(email);
  if (existing) throw new Error("User exists");

  const salt = crypto.randomBytes(16).toString("hex");
  const password_hash = hashPassword(password, salt);
  const id = crypto.randomUUID();
  await db.query(
    "INSERT INTO users (id, email, password_hash, salt) VALUES ($1, $2, $3, $4)",
    [id, email, password_hash, salt]
  );
  return { id, email };
}

export async function verifyUser(email: string, password: string) {
  const user = await findUserByEmail(email);
  if (!user) return null;
  const result = verifyPassword(password, user.password_hash, user.salt);
  if (!result.valid) return null;
  if (result.rehash && result.newHash) {
    await db.query("UPDATE users SET password_hash=$1 WHERE id=$2", [result.newHash, user.id]);
  }
  return user;
}

export async function issueTokenForUser(userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await db.query(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)",
    [token, userId, expiresAt]
  );
  // Cache session in Redis so middleware validates instantly
  cacheSet(`session:${token}`, "1", TTL.SESSION).catch(() => {});
  // Probabilistic cleanup: ~5% of token creations purge expired sessions
  if (Math.random() < 0.05) {
    db.query("DELETE FROM sessions WHERE expires_at < now()").catch(() => {});
  }
  return token;
}

export async function findUserByToken(token: string) {
  const res = await db.query(
    `SELECT u.id, u.email, u.fullname, u.created_at FROM users u
     JOIN sessions s ON s.user_id = u.id
     WHERE s.token = $1 AND s.expires_at > now()
     LIMIT 1`,
    [token]
  );
  return (res.rows && res.rows[0]) ?? null;
}

export async function clearUsers() {
  await db.query("DELETE FROM users");
}

export function getProjectSyncToken(projectId: string): string {
  const secret = process.env.SESSION_SECRET || process.env.JWT_SECRET || "mint-sync-secret-salt-2026";
  return crypto
    .createHmac("sha256", secret)
    .update(projectId)
    .digest("hex");
}
