import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoices, vendors, fraudCases, approvalRequests, auditLog } from "@/db/schema";
import { eq, desc, or, sql } from "drizzle-orm";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { databaseErrorResponse } from "@/lib/database-error";

export async function GET() {
  try {
  const allInvoices = await db.select().from(invoices).orderBy(desc(sql`CAST(risk_score AS NUMERIC)`));
  const allVendors = await db.select().from(vendors).orderBy(desc(sql`CAST(risk_score AS NUMERIC)`));
  const cases = await db.select().from(fraudCases).orderBy(desc(fraudCases.createdAt));

  const enrichedInvoices = allInvoices.map(inv => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    vendorId: inv.vendorId,
    vendorName: inv.vendorName,
    poNumber: inv.poNumber,
    amount: parseFloat(inv.amount),
    currency: inv.currency,
    invoiceDate: inv.invoiceDate,
    dueDate: inv.dueDate,
    paymentStatus: inv.paymentStatus,
    reviewStatus: inv.reviewStatus,
    riskScore: parseFloat(inv.riskScore || "0"),
    riskFactors: Array.isArray(inv.riskFactors) ? inv.riskFactors : JSON.parse(String(inv.riskFactors || "[]")),
    isDuplicate: inv.isDuplicate,
    duplicateOf: inv.duplicateOf,
  }));

  const enrichedVendors = allVendors.map(v => ({
    id: v.id,
    vendorNumber: v.vendorNumber,
    name: v.name,
    country: v.country,
    riskScore: parseFloat(v.riskScore || "0"),
    onWatchlist: v.onWatchlist,
  }));

  const enrichedCases = cases.map(c => ({
    id: c.id,
    caseNumber: c.caseNumber,
    invoiceId: c.invoiceId,
    vendorId: c.vendorId,
    caseType: c.caseType,
    severity: c.severity,
    riskScore: parseFloat(c.riskScore),
    evidence: redactSensitive(Array.isArray(c.evidence) ? c.evidence : JSON.parse(String(c.evidence || "[]"))),
    status: c.status,
    createdAt: c.createdAt,
  }));

  return NextResponse.json({
    invoices: enrichedInvoices,
    vendors: enrichedVendors,
    cases: enrichedCases,
  });
  } catch (error) {
    return databaseErrorResponse(error, "Fraud data query");
  }
}

function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([key]) => !/(bank|account|tax.?id|email|password|secret|token)/i.test(key)).map(([key, entry]) => [key, redactSensitive(entry)]));
  }
  return value;
}

const reviewSchema = z.object({
  invoiceId: z.number(),
  action: z.enum(["block", "approve", "escalate", "clear"]),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
  const body = await req.json();
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid invoice action", details: parsed.error.issues }, { status: 400 });
  const { invoiceId, action, notes } = parsed.data;
  const reviewStatusMap: Record<string, string> = {
    block: "under_review",
    approve: "cleared",
    escalate: "escalated",
    clear: "cleared",
  };

  const outcome = await db.transaction(async tx => {
    const [invoice] = await tx.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
    if (!invoice) return null;
    const paymentStatus = action === "approve" ? "approved" : action === "clear" ? "pending" : invoice.paymentStatus;
    const [updated] = await tx.update(invoices).set({
      paymentStatus,
      reviewStatus: reviewStatusMap[action],
      updatedAt: new Date(),
    }).where(eq(invoices.id, invoiceId)).returning({ id: invoices.id });
    if (!updated) return null;

    let approvalId: number | undefined;
    if (action === "block" || action === "escalate") {
      const [approval] = await tx.insert(approvalRequests).values({
        requestId: uuidv4(),
        type: "payment_block",
        title: `Payment block: ${invoice.invoiceNumber}`,
        description: `Human review requested for invoice ${invoice.invoiceNumber}. This request does not block payment until approved.`,
      requestedBy: null,
      requestedByName: null,
        status: "pending",
        priority: "high",
        payload: JSON.stringify({ invoiceId, invoiceNumber: invoice.invoiceNumber }),
      }).returning({ id: approvalRequests.id });
      approvalId = approval.id;
    }

    await tx.insert(auditLog).values({
      action: action === "block" || action === "escalate" ? "invoice_payment_block_requested" : `invoice_${action}`,
      resourceType: "invoice",
      resourceId: String(invoiceId),
      description: action === "block" || action === "escalate"
        ? `Human approval requested for invoice ${invoiceId}; payment remains ${invoice.paymentStatus}.`
        : `Invoice ${invoiceId} marked ${action} in demo mode.`,
      severity: action === "block" || action === "escalate" ? "warning" : "info",
      metadata: notes ? { noteProvided: true } : undefined,
    });
    return { approvalId, paymentStatus };
  });

  if (!outcome) return NextResponse.json({ error: "Invoice not found; no action was recorded" }, { status: 404 });
  return NextResponse.json({ success: true, approvalRequired: action === "block" || action === "escalate", approvalId: outcome.approvalId, paymentStatus: outcome.paymentStatus });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Request body must contain valid JSON" }, { status: 400 });
    return databaseErrorResponse(error, "Fraud invoice action");
  }
}
