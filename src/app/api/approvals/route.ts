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
      if (typeof payload.prNumber !== "string") return { error: "The approval request has no linked requisition", statusCode: 409 };
      const [pr] = await tx.update(purchaseRequisitions).set({ status: action === "approve" ? "approved" : "rejected", updatedAt: now }).where(eq(purchaseRequisitions.prNumber, payload.prNumber)).returning({ id: purchaseRequisitions.id });
      if (!pr) return { error: "The linked requisition no longer exists; approval was not applied", statusCode: 409 };
    }

    if (request.type === "payment_block" && action === "approve" && typeof payload.invoiceId === "number") {
      const [invoice] = await tx.update(invoices).set({ paymentStatus: "blocked", reviewStatus: "escalated", updatedAt: now }).where(and(eq(invoices.id, payload.invoiceId), eq(invoices.paymentStatus, "pending"))).returning({ id: invoices.id });
      if (!invoice) return { error: "The linked invoice is missing or no longer pending; payment was not blocked", statusCode: 409 };
      affectedInvoiceIds.push(invoice.id);
    }

    if (request.type === "payment_block" && action === "approve" && Array.isArray(payload.invoiceIds)) {
      const ids = [...new Set(payload.invoiceIds.filter((id): id is number => Number.isInteger(id)))];
      if (ids.length === 0) return { error: "No pending invoice IDs are linked to this approval", statusCode: 409 };
      const eligible = await tx.select({ id: invoices.id }).from(invoices).where(and(inArray(invoices.id, ids), eq(invoices.paymentStatus, "pending"))).for("update");
      if (eligible.length !== ids.length) return { error: "One or more linked invoices are missing or no longer pending; no blocks were applied", statusCode: 409 };
      const updated = await tx.update(invoices).set({ paymentStatus: "blocked", reviewStatus: "escalated", updatedAt: now }).where(inArray(invoices.id, ids)).returning({ id: invoices.id });
      affectedInvoiceIds.push(...updated.map(invoice => invoice.id));
    } else if (request.type === "payment_block" && action === "approve") {
      return { error: "The approval request has no linked invoice IDs", statusCode: 409 };
    }

    if (request.type === "batch_execution" && action === "approve" && typeof payload.batchJobId === "number") {
      const [job] = await tx.update(batchJobs).set({ status: "simulating", startedAt: now, updatedAt: now }).where(eq(batchJobs.id, payload.batchJobId)).returning({ id: batchJobs.id });
      if (!job) return { error: "The linked batch job no longer exists; approval was not applied", statusCode: 409 };
    } else if (request.type === "batch_execution" && action === "approve") {
      return { error: "The approval request has no linked batch job", statusCode: 409 };
    }

    await tx.update(approvalRequests).set({ status: newStatus, approvedBy: null, approvedByName: null, approvalNotes: notes, rejectionReason: reason, resolvedAt: now, updatedAt: now }).where(eq(approvalRequests.requestId, requestId));
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
    return { success: true, status: newStatus };
  });

  if ("error" in outcome) return NextResponse.json({ error: outcome.error }, { status: outcome.statusCode });
  return NextResponse.json(outcome);
}
