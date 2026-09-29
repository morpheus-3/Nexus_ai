import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { settings, auditLog } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { databaseErrorResponse } from "@/lib/database-error";

export async function GET() {

  try {
    const allSettings = await db.select().from(settings);
    const map: Record<string, unknown> = {};
    for (const s of allSettings) {
      if (typeof s.value !== "string") map[s.key] = s.value;
      else {
        try { map[s.key] = JSON.parse(s.value); } catch { map[s.key] = s.value; }
      }
    }
    return NextResponse.json({ settings: map });
  } catch (error) {
    return databaseErrorResponse(error, "Settings query");
  }
}

const settingKeys = ["llm_model", "safety_stock_threshold_pct", "reorder_point_multiplier", "fraud_risk_score_threshold", "sap_base_url", "sap_client", "bdc_batch_size", "simulation_mode"] as const;
const updateSchema = z.object({ key: z.enum(settingKeys), value: z.unknown() });

export async function POST(req: NextRequest) {
  

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Request body must contain valid JSON" }, { status: 400 }); }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid setting update" }, { status: 400 });
  const { key, value } = parsed.data;
  if (key === "simulation_mode" && value !== true) return NextResponse.json({ error: "SAP simulation mode cannot be disabled without an authorized SAP adapter" }, { status: 409 });
  try {
    const [updated] = await db.update(settings).set({
      value: JSON.stringify(value),
      updatedBy: null,
      updatedAt: new Date(),
    }).where(eq(settings.key, key)).returning({ id: settings.id });
    if (!updated) return NextResponse.json({ error: "Setting not found" }, { status: 404 });

    await db.insert(auditLog).values({
      action: "settings_updated",
      resourceType: "settings",
      resourceId: key,
      description: `Setting ${key} updated in demo mode`,
      severity: "info",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return databaseErrorResponse(error, "Settings update");
  }
}
