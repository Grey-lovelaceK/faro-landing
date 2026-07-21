// Faro° — conexión a Postgres (Neon serverless, HTTP).
// El archivo empieza con "_" → Vercel NO lo enruta como endpoint, es solo helper.
// El prefijo de las env vars es STORAGE (integración Neon en Vercel). Probamos varios nombres
// por si Neon inyecta POSTGRES_URL / DATABASE_URL en vez de STORAGE_*.
import { neon } from '@neondatabase/serverless';

const CONN =
  process.env.STORAGE_DATABASE_URL ||
  process.env.STORAGE_POSTGRES_URL ||
  process.env.STORAGE_DATABASE_URL_UNPOOLED ||
  process.env.STORAGE_POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  '';

export const dbReady = !!CONN;

// neon() devuelve un tag de template: await sql`SELECT ...`
export const sql = CONN ? neon(CONN) : null;

// Crea la tabla si no existe (idempotente, barato). Se llama en el primer insert/lectura.
let ensured = false;
export async function ensureSchema() {
  if (ensured || !sql) return;
  await sql`
    CREATE TABLE IF NOT EXISTS leads (
      id         SERIAL PRIMARY KEY,
      email      TEXT NOT NULL,
      url        TEXT,
      score      INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  ensured = true;
}
