import "dotenv/config";
import { Pool } from "pg";

function getDatabaseUrl(): string {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is not configured.");

  try {
    const url = new URL(value);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !url.username || !url.password || !url.pathname.slice(1)) {
      throw new Error();
    }
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL with host, database, user, and password.");
  }

  return value;
}

async function verifyConnection(): Promise<void> {
  const connectionString = getDatabaseUrl();
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 5000, max: 1 });

  try {
    const result = await pool.query<{ database: string; role: string }>(
      "SELECT current_database() AS database, current_user AS role",
    );
    console.log(`PostgreSQL connection verified (database=${result.rows[0].database}, role=${result.rows[0].role}).`);
  } finally {
    await pool.end();
  }
}

verifyConnection().catch((error: unknown) => {
  const code = error && typeof error === "object" && "code" in error
    ? String((error as { code: unknown }).code)
    : undefined;
  if (error instanceof Error && ["DATABASE_URL is not configured.", "DATABASE_URL must be a valid PostgreSQL URL with host, database, user, and password."].includes(error.message)) {
    console.error(error.message);
  } else if (code === "28P01" || code === "28000") {
    console.error("PostgreSQL rejected the configured credentials (28P01). No credentials were displayed.");
  } else if (code === "3D000") {
    console.error("The configured PostgreSQL database does not exist (3D000).");
  } else if (code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "ETIMEDOUT") {
    console.error("PostgreSQL is unreachable. Check the local container and host port.");
  } else {
    console.error("PostgreSQL connection verification failed. No connection details were displayed.");
  }
  process.exitCode = 1;
});
