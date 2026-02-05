import crypto from "crypto";
import db from "./db";

export type User = {
  id: string;
  email: string;
  password_hash: string;
  salt: string;
  token?: string | null;
  created_at?: string;
};

function hashPassword(password: string, salt: string) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const res = await db.query("SELECT * FROM users WHERE lower(email)=lower($1) LIMIT 1", [email]);
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
  const attempt = hashPassword(password, user.salt);
  const a = Buffer.from(attempt, "hex");
  const b = Buffer.from(user.password_hash, "hex");
  if (a.length !== b.length) return null;
  if (crypto.timingSafeEqual(a, b)) return user;
  return null;
}

export async function issueTokenForUser(userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  await db.query("UPDATE users SET token=$1 WHERE id=$2", [token, userId]);
  return token;
}

export async function findUserByToken(token: string) {
  const res = await db.query("SELECT * FROM users WHERE token=$1 LIMIT 1", [token]);
  return (res.rows && res.rows[0]) ?? null;
}

export async function clearUsers() {
  await db.query("DELETE FROM users");
}
