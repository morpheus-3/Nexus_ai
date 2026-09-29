import { NextResponse } from "next/server";

type DatabaseError = Error & { code?: string };

export function databaseErrorResponse(error: unknown, operation: string) {
  let rootCause = error;
  const visited = new Set<unknown>();
  while (rootCause && typeof rootCause === "object" && "cause" in rootCause && !visited.has(rootCause)) {
    visited.add(rootCause);
    const cause = (rootCause as { cause?: unknown }).cause;
    if (!cause) break;
    rootCause = cause;
  }

  const databaseError = rootCause as DatabaseError;
  const pgCode = databaseError?.code;
  console.error(`${operation} failed`, { databaseCode: pgCode ?? "unknown" });

  if (pgCode === "ECONNREFUSED" || pgCode === "ENOTFOUND" || pgCode === "ETIMEDOUT" || pgCode === "ECONNRESET") {
    return NextResponse.json(
      { error: "Database unavailable. Start PostgreSQL and verify DATABASE_URL connectivity.", code: "DATABASE_UNAVAILABLE", databaseCode: pgCode },
      { status: 503 },
    );
  }

  if (pgCode === "28P01" || pgCode === "28000") {
    return NextResponse.json(
      { error: "Database authentication failed. Verify the PostgreSQL credentials in DATABASE_URL.", code: "DATABASE_AUTH_FAILED", databaseCode: pgCode },
      { status: 503 },
    );
  }

  if (pgCode === "3D000") {
    return NextResponse.json(
      { error: "The database named by DATABASE_URL does not exist.", code: "DATABASE_NOT_FOUND", databaseCode: pgCode },
      { status: 503 },
    );
  }

  if (pgCode === "42P01" || pgCode === "42703") {
    return NextResponse.json(
      { error: "Database schema is incompatible with this application. Apply the current Drizzle schema and retry.", code: "DATABASE_SCHEMA_MISMATCH", databaseCode: pgCode },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { error: `Database operation failed. Check server logs${pgCode ? ` (database code ${pgCode})` : ""}.`, code: "DATABASE_OPERATION_FAILED", databaseCode: pgCode ?? null },
    { status: 500 },
  );
}
