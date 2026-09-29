import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { batchJobs, batchRecords, auditLog } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { databaseErrorResponse } from "@/lib/database-error";

function jsonColumn<T>(value: unknown, fallback: T, field: string): T {
  if (value == null) return fallback;
  const parsed: unknown = typeof value === "string" ? JSON.parse(value) : value;
  const expectedArray = Array.isArray(fallback);
  const validShape = expectedArray
    ? Array.isArray(parsed)
    : typeof parsed === "object" && parsed !== null && !Array.isArray(parsed);
  if (!validShape) {
    throw new Error(`Unexpected JSON shape in BDC ${field}`);
  }
  return parsed as T;
}

function sanitizeErrorReport(value: unknown[]): Array<{ row: number; error: string }> {
  return value.flatMap(entry => {
    if (!entry || typeof entry !== "object") return [];
    const row = (entry as { row?: unknown }).row;
    const error = (entry as { error?: unknown }).error;
    return typeof row === "number" && typeof error === "string" ? [{ row, error }] : [];
  });
}

export async function GET() {
  try {
    const jobs = await db.select().from(batchJobs).orderBy(desc(batchJobs.createdAt)).limit(20);
    const enriched = jobs.map(job => ({
      ...job,
      fieldMapping: jsonColumn(job.fieldMapping, {} as Record<string, string>, "fieldMapping"),
      validationResults: jsonColumn(job.validationResults, [] as unknown[], "validationResults"),
      executionResults: jsonColumn(job.executionResults, [] as unknown[], "executionResults"),
      errorReport: sanitizeErrorReport(jsonColumn(job.errorReport, [] as unknown[], "errorReport")),
    }));

    return NextResponse.json({ jobs: enriched });
  } catch (error) {
    return databaseErrorResponse(error, "BDC history query");
  }
}

// SAP Field mappings per transaction
const SAP_FIELD_MAPS: Record<string, Record<string, string>> = {
  ME21N: {
    "Vendor": "LIFNR",
    "Material": "MATNR",
    "Quantity": "MENGE",
    "Price": "NETPR",
    "Currency": "WAERS",
    "Plant": "WERKS",
    "Delivery Date": "EEIND",
  },
  MB1C: {
    "Material Number": "MATNR",
    "Plant": "WERKS",
    "Storage Location": "LGORT",
    "Quantity": "MENGE",
    "Unit": "MEINS",
    "Movement Type": "BWART",
  },
  XK01: {
    "Vendor Number": "LIFNR",
    "Name": "NAME1",
    "Country": "LAND1",
    "Street": "STRAS",
    "City": "ORT01",
    "Tax ID": "STCD1",
    "Bank Account": "BANKN",
  },
};

const SAP_REQUIRED: Record<string, string[]> = {
  ME21N: ["LIFNR", "MATNR", "MENGE", "NETPR", "WERKS"],
  MB1C: ["MATNR", "WERKS", "MENGE", "MEINS", "BWART"],
  XK01: ["LIFNR", "NAME1", "LAND1"],
};

function validateRecord(mapped: Record<string, string>, transaction: string): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const required = SAP_REQUIRED[transaction] || [];

  for (const field of required) {
    if (!mapped[field] || mapped[field].trim() === "") {
      errors.push(`Required field ${field} is missing or empty`);
    }
  }

  if (mapped.MENGE && isNaN(parseFloat(mapped.MENGE))) {
    errors.push("Quantity (MENGE) must be numeric");
  }
  if (mapped.NETPR && isNaN(parseFloat(mapped.NETPR))) {
    errors.push("Price (NETPR) must be numeric");
  }

  return { valid: errors.length === 0, errors, warnings };
}

function simulateBDCExecution(record: Record<string, string>, index: number): {
  success: boolean;
  documentNumber: string | null;
  message: string;
} {
  // Deterministic simulation: fail ~15% of records
  const seed = Object.values(record).join("").length + index;
  const failRate = seed % 7 === 0 ? true : false;

  if (failRate) {
    return {
      success: false,
      documentNumber: null,
      message: `BDC error: Field validation failed at position ${index + 1}. Check MATNR/WERKS combination.`,
    };
  }

  const docNum = `5${String(1000000 + index + seed).slice(0, 9)}`;
  return {
    success: true,
    documentNumber: docNum,
    message: `Document ${docNum} created successfully (SIMULATION)`,
  };
}

const submitSchema = z.object({
  name: z.string().min(1),
  records: z.array(z.record(z.string(), z.string())).min(1).max(500),
  fieldMapping: z.record(z.string(), z.string()),
  sapTransaction: z.string(),
  simulationMode: z.boolean().default(true),
  fileName: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json();
    const { name, records, fieldMapping, sapTransaction, simulationMode, fileName } = submitSchema.parse(body);
    if (!simulationMode) {
      return NextResponse.json({ error: "Live SAP execution is unavailable. Configure an authorized SAP BDC adapter before enabling live execution." }, { status: 409 });
    }

  // Create batch job
  const [job] = await db.insert(batchJobs).values({
    jobId: uuidv4(),
    name,
    fileName,
    fileSize: JSON.stringify(records).length,
    recordCount: records.length,
    status: "validating",
    sapTransaction,
    fieldMapping: JSON.stringify(fieldMapping),
    simulationMode,
    startedAt: new Date(),
  }).returning();

  // Validate and process records
  const validationResults: Array<{ row: number; status: string; errors: string[]; warnings: string[] }> = [];
  const executionResults: Array<{ row: number; status: string; documentNumber: string | null; message: string }> = [];
  const errorReport: Array<{ row: number; error: string }> = [];

  let successCount = 0;
  let errorCount = 0;
  let warningCount = 0;

  // Process each record
  const batchRecordValues = [];

  for (let i = 0; i < records.length; i++) {
    const raw = records[i];
    // Map to SAP fields
    const mapped: Record<string, string> = {};
    for (const [csvCol, sapField] of Object.entries(fieldMapping)) {
      if (raw[csvCol] !== undefined) {
        mapped[sapField] = String(raw[csvCol]);
      }
    }

    const validation = validateRecord(mapped, sapTransaction);
    validationResults.push({ row: i + 1, status: validation.valid ? "valid" : "invalid", errors: validation.errors, warnings: validation.warnings });

    if (validation.warnings.length > 0) warningCount++;

    let execStatus = "skipped";
    let execMessage = "";
    let docNum = null;

    if (validation.valid && simulationMode) {
      const execResult = simulateBDCExecution(mapped, i);
      execStatus = execResult.success ? "success" : "failed";
      execMessage = execResult.message;
      docNum = execResult.documentNumber;

      if (execResult.success) {
        successCount++;
      } else {
        errorCount++;
        errorReport.push({ row: i + 1, error: execResult.message });
      }
    } else if (!validation.valid) {
      errorCount++;
      errorReport.push({ row: i + 1, error: validation.errors.join("; ") });
    }

    executionResults.push({ row: i + 1, status: execStatus, documentNumber: docNum, message: execMessage });

    batchRecordValues.push({
      batchJobId: job.id,
      rowNumber: i + 1,
      rawData: JSON.stringify(raw),
      mappedData: JSON.stringify(mapped),
      validationStatus: validation.valid ? "valid" : "invalid",
      validationErrors: JSON.stringify(validation.errors),
      executionStatus: execStatus,
      executionMessage: execMessage,
      sapDocumentNumber: docNum,
    });
  }

  // Insert batch records
  if (batchRecordValues.length > 0) {
    await db.insert(batchRecords).values(batchRecordValues);
  }

  const finalStatus = simulationMode ? "simulated" : (errorCount === 0 ? "completed" : "completed");

  // Update job
  await db.update(batchJobs).set({
    status: finalStatus,
    recordCount: records.length,
    successCount,
    errorCount,
    warningCount,
    validationResults: JSON.stringify(validationResults),
    executionResults: JSON.stringify(executionResults),
    errorReport: JSON.stringify(errorReport),
    completedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(batchJobs.id, job.id));

  await db.insert(auditLog).values({
    action: "batch_job_submitted",
    resourceType: "batch_job",
    resourceId: String(job.id),
    description: `BDC batch job submitted in demo mode: ${name} (${records.length} records, ${simulationMode ? "simulation" : "live"})`,
    severity: "info",
  });

  return NextResponse.json({
    jobId: job.jobId,
    id: job.id,
    status: finalStatus,
    recordCount: records.length,
    successCount,
    errorCount,
    warningCount,
    validationResults,
    executionResults,
    errorReport,
    simulationMode,
  });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid BDC batch request", code: "BDC_INVALID_REQUEST", details: error.issues }, { status: 400 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Request body must contain valid JSON", code: "BDC_INVALID_JSON" }, { status: 400 });
    }
    return databaseErrorResponse(error, "BDC batch submission");
  }
}
