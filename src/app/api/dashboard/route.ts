import { NextResponse } from "next/server";
import { db } from "@/db";
import { inventoryItems, invoices, purchaseRequisitions, fraudCases, batchJobs, agentRuns, purchaseOrders, approvalRequests } from "@/db/schema";
import { sql, eq, or, gte } from "drizzle-orm";
import { databaseErrorResponse } from "@/lib/database-error";

export async function GET() {

  try {
    const [invItems] = await db.select({ count: sql<number>`count(*)` }).from(inventoryItems);
    const [belowSafety] = await db.select({ count: sql<number>`count(*)` }).from(inventoryItems).where(sql`CAST(current_stock AS NUMERIC) < CAST(safety_stock AS NUMERIC)`);
    const [openPRs] = await db.select({ count: sql<number>`count(*)` }).from(purchaseRequisitions).where(eq(purchaseRequisitions.status, "pending"));
    const [invReviewed] = await db.select({ count: sql<number>`count(*)` }).from(invoices).where(sql`review_status != 'unreviewed'`);
    const [totalInv] = await db.select({ count: sql<number>`count(*)` }).from(invoices);
    const [highRiskAlerts] = await db.select({ count: sql<number>`count(*)` }).from(fraudCases).where(or(eq(fraudCases.severity, "high"), eq(fraudCases.severity, "critical")));
    const [activeCases] = await db.select({ count: sql<number>`count(*)` }).from(fraudCases).where(or(eq(fraudCases.status, "open"), eq(fraudCases.status, "under_review"), eq(fraudCases.status, "escalated")));
    const [totalBatches] = await db.select({ count: sql<number>`count(*)` }).from(batchJobs);
    const [successBatches] = await db.select({ count: sql<number>`count(*)` }).from(batchJobs).where(eq(batchJobs.status, "completed"));
    const recentRuns = await db.select().from(agentRuns).orderBy(sql`created_at DESC`).limit(5);
    const weekStart = new Date();
    weekStart.setUTCHours(0, 0, 0, 0);
    weekStart.setUTCDate(weekStart.getUTCDate() - 6);
    const runsThisWeek = await db.select({ agent: agentRuns.supervisorDecision, createdAt: agentRuns.createdAt })
      .from(agentRuns).where(gte(agentRuns.createdAt, weekStart));
    const activityByDay = Array.from({ length: 7 }, (_, offset) => {
      const day = new Date(weekStart);
      day.setUTCDate(weekStart.getUTCDate() + offset);
      return { time: day.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }), supply: 0, fraud: 0, bdc: 0, multi: 0, key: day.toISOString().slice(0, 10) };
    });
    for (const run of runsThisWeek) {
      const bucket = activityByDay.find(day => day.key === run.createdAt.toISOString().slice(0, 10));
      if (!bucket) continue;
      if (run.agent === "supply_chain") bucket.supply++;
      else if (run.agent === "fraud") bucket.fraud++;
      else if (run.agent === "bdc") bucket.bdc++;
      else if (run.agent === "multi_agent") bucket.multi++;
    }
    const [delayedPOs] = await db.select({ count: sql<number>`count(*)` }).from(purchaseOrders).where(eq(purchaseOrders.status, "delayed"));
    const [pendingApprovals] = await db.select({ count: sql<number>`count(*)` }).from(approvalRequests).where(eq(approvalRequests.status, "pending"));

    const inventoryHealth = invItems.count > 0
      ? Math.round(((invItems.count - belowSafety.count) / invItems.count) * 100)
      : 100;

    const batchSuccessRate = totalBatches.count > 0
      ? Math.round((successBatches.count / totalBatches.count) * 100)
      : 0;

    // Inventory chart data
    const inventoryData = await db.select({
      category: inventoryItems.category,
      count: sql<number>`count(*)`,
      below: sql<number>`sum(case when CAST(current_stock AS NUMERIC) < CAST(safety_stock AS NUMERIC) then 1 else 0 end)`,
    }).from(inventoryItems).groupBy(inventoryItems.category);

    // Agent activity over recent runs
    const agentActivity = recentRuns.map(r => ({
      id: r.id,
      runId: r.runId,
      agent: r.supervisorDecision,
      status: r.status,
      durationMs: r.durationMs,
      createdAt: r.createdAt,
      message: r.supervisorDecision ? `${r.supervisorDecision.replaceAll("_", " ")} analysis` : "Agent analysis",
    }));

    return NextResponse.json({
      kpis: {
        inventoryHealth,
        openPRs: openPRs.count,
        invoicesReviewed: invReviewed.count,
        totalInvoices: totalInv.count,
        highRiskAlerts: highRiskAlerts.count,
        activeFraudCases: activeCases.count,
        batchSuccessRate,
        totalBatches: totalBatches.count,
        delayedPOs: delayedPOs.count,
        pendingApprovals: pendingApprovals.count,
        belowSafetyStock: belowSafety.count,
        totalMaterials: invItems.count,
      },
      inventoryByCategory: inventoryData,
      recentAgentActivity: agentActivity,
      agentActivityByDay: activityByDay.map(({ key: _key, ...day }) => day),
    });
  } catch (e) {
    return databaseErrorResponse(e, "Dashboard data query");
  }
}
