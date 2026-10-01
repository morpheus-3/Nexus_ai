import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { approvalRequests, purchaseRequisitions, invoices, batchJobs, auditLog } from "@/db/schema";
import { eq, desc, and, inArray } from "drizzle-orm";
import { z } from "zod";

export async function GET() {
  const requests = await db.select().from(approvalRequests).orderBy(
    desc(approvalRequests.createdAt)
  );

  const enriched = requests.map(r => ({
    ...r,
    payload: typeof r.payload === "string" ? JSON.parse(r.payload || "{}") : r.payload || {},
  }));

  return NextResponse.json({ requests: enriched });
}

const actionSchema = z.object({
  requestId: z.string(),
  action: z.enum(["approve", "reject", "cancel"]),
  notes: z.string().optional(),
  reason: z.string().optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Request body must contain valid JSON" }, { status: 400 }); }
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid approval action", details: parsed.error.issues }, { status: 400 });
  const { requestId, action, notes, reason } = parsed.data;

  const outcome = await db.transaction(async tx => {
    const [request] = await tx.select().from(approvalRequests)
      .where(eq(approvalRequests.requestId, requestId)).limit(1).for("update");
    if (!request) return { error: "Request not found", statusCode: 404 };
    if (request.status !== "pending") return { error: "Request already resolved", statusCode: 409 };

    const newStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : "cancelled";
    const payload = (typeof request.payload === "string" ? JSON.parse(request.payload || "{}") : request.payload || {}) as Record<string, unknown>;
    const now = new Date();

    const affectedInvoiceIds: number[] = [];

    if (request.type === "purchase_requisition" && (action === "approve" || action === "reject")) {
      if (action === "approve" && typeof payload.prNumber !== "string") return { error: "This request has no linked purchase requisition, so it cannot be approved. Reject this outdated request and run a new analysis for current recommendations.", statusCode: 409 };
      if (typeof payload.prNumber === "string") {
        const [pr] = await tx.update(purchaseRequisitions).set({ status: action === "approve" ? "approved" : "rejected", updatedAt: now }).where(and(eq(purchaseRequisitions.prNumber, payload.prNumber), eq(purchaseRequisitions.status, "pending"))).returning({ id: purchaseRequisitions.id });
        if (!pr && action === "approve") return { error: "The linked requisition is missing or no longer pending; approval was not applied", statusCode: 409 };
      }
    }

    if (request.type === "payment_block" && action === "approve") {
      // Normalize both supported payload shapes before making any changes.
      const rawIds = payload.invoiceIds !== undefined ? payload.invoiceIds : payload.invoiceId !== undefined ? [payload.invoiceId] : [];
      if (!Array.isArray(rawIds) || rawIds.length === 0 || !rawIds.every(id => typeof id === "number" && Number.isSafeInteger(id) && id > 0)) {
        return { error: "The approval request has no valid linked invoice IDs. Run a new invoice analysis to create a current recommendation.", statusCode: 409 };
      }
      const ids = [...new Set(rawIds as number[])];
      const eligible = await tx.select({ id: invoices.id }).from(invoices).where(and(inArray(invoices.id, ids), eq(invoices.paymentStatus, "pending"))).for("update");
      if (eligible.length !== ids.length) return { error: "One or more linked invoices are missing or no longer pending; no blocks were applied", statusCode: 409 };
      const updated = await tx.update(invoices).set({ paymentStatus: "blocked", reviewStatus: "escalated", updatedAt: now }).where(inArray(invoices.id, ids)).returning({ id: invoices.id });
      affectedInvoiceIds.push(...updated.map(invoice => invoice.id));
    }

    if (request.type === "batch_execution" && action === "approve" && typeof payload.batchJobId === "number") {
      const [job] = await tx.update(batchJobs).set({ status: "simulating", startedAt: now, updatedAt: now }).where(eq(batchJobs.id, payload.batchJobId)).returning({ id: batchJobs.id });
      if (!job) return { error: "The linked batch job no longer exists; approval was not applied", statusCode: 409 };
    } else if (request.type === "batch_execution" && action === "approve") {
      return { error: "The approval request has no linked batch job", statusCode: 409 };
    }

    const [updatedRequest] = await tx.update(approvalRequests).set({ status: newStatus, approvedBy: null, approvedByName: null, approvalNotes: notes, rejectionReason: reason, resolvedAt: now, updatedAt: now }).where(eq(approvalRequests.requestId, requestId)).returning();
    await tx.insert(auditLog).values({
      action: request.type === "payment_block" && action === "approve" ? "invoice_payment_blocked" : `approval_${action}`,
      resourceType: request.type === "payment_block" && affectedInvoiceIds.length === 1 ? "invoice" : "approval_request",
      resourceId: request.type === "payment_block" && affectedInvoiceIds.length === 1 ? String(affectedInvoiceIds[0]) : requestId,
      description: request.type === "payment_block" && action === "approve"
        ? `Payment block approved in demo mode; ${affectedInvoiceIds.length} invoice(s) are now blocked.`
        : `${request.title} ${action}d in demo mode.`,
      severity: action === "reject" ? "warning" : "info",
      metadata: { requestType: request.type, paymentStatus: request.type === "payment_block" ? action === "approve" ? "blocked" : "unchanged" : undefined, affectedInvoiceIds },
    });
    return { success: true, status: newStatus, request: { ...updatedRequest, payload } };
  });

  if ("error" in outcome) return NextResponse.json({ error: outcome.error }, { status: outcome.statusCode });
  return NextResponse.json(outcome);
}
