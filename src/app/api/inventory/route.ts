import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { inventoryItems, purchaseOrders, purchaseRequisitions } from "@/db/schema";
import { sql, eq, desc } from "drizzle-orm";

export async function GET() {

  const items = await db.select().from(inventoryItems).orderBy(
    sql`CAST(current_stock AS NUMERIC) / NULLIF(CAST(safety_stock AS NUMERIC), 0) ASC`
  );

  const delayedPOs = await db.select().from(purchaseOrders).where(eq(purchaseOrders.status, "delayed"));
  const openPRs = await db.select().from(purchaseRequisitions).where(eq(purchaseRequisitions.status, "pending")).orderBy(desc(purchaseRequisitions.createdAt));

  const enriched = items.map(item => {
    const cur = parseFloat(item.currentStock);
    const safety = parseFloat(item.safetyStock);
    const reorder = parseFloat(item.reorderPoint || "0");
    const pctOfSafety = safety > 0 ? (cur / safety) * 100 : 100;
    const status = cur < safety ? (cur < safety * 0.3 ? "critical" : "low") : cur >= reorder ? "healthy" : "warning";
    return {
      ...item,
      currentStock: cur,
      safetyStock: safety,
      reorderPoint: reorder,
      unitCost: item.unitCost ? parseFloat(item.unitCost) : null,
      maxStock: item.maxStock ? parseFloat(item.maxStock) : null,
      pctOfSafety: Math.round(pctOfSafety),
      status,
      totalValue: item.unitCost ? Math.round(cur * parseFloat(item.unitCost)) : null,
    };
  });

  return NextResponse.json({ items: enriched, delayedPOs, openPRs });
}
