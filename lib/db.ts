import { Pool } from "pg";

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY,
      email text UNIQUE NOT NULL,
      password_hash text NOT NULL,
      salt text NOT NULL,
      token text,
      created_at timestamptz DEFAULT now()
    )
  `);
}

init().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Failed initializing DB:", err);
});

export default {
  query: (text: string, params?: any[]) => pool.query(text, params),
};
