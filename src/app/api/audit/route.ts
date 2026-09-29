import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import { desc, sql, like, and, gte, lte } from "drizzle-orm";

export async function GET(req: NextRequest) {

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const severity = searchParams.get("severity") || "";
  const action = searchParams.get("action") || "";
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);

  const conditions = [];
  if (search) {
    conditions.push(sql`(${auditLog.description} ILIKE ${'%' + search + '%'} OR ${auditLog.userEmail} ILIKE ${'%' + search + '%'})`);
  }
  if (severity) {
    conditions.push(sql`${auditLog.severity} = ${severity}`);
  }
  if (action) {
    conditions.push(sql`${auditLog.action} ILIKE ${'%' + action + '%'}`);
  }

  const query = db.select().from(auditLog)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(auditLog.createdAt)).limit(limit);

  const logs = await query;

  return NextResponse.json({ logs });
}
