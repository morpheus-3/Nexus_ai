import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({ status: "ok", service: "SAP Nexus AI", timestamp: new Date().toISOString() });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
