import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  jsonb,
  varchar,
  uuid,
  index,
} from "drizzle-orm/pg-core";

// ─── Users & Roles ────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  uuid: uuid("uuid").defaultRandom().notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).notNull().default("viewer"), // admin | finance | procurement | viewer
  isActive: boolean("is_active").notNull().default(true),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Inventory ────────────────────────────────────────────────────────────────
export const inventoryItems = pgTable("inventory_items", {
  id: serial("id").primaryKey(),
  materialNumber: varchar("material_number", { length: 50 }).notNull().unique(),
  description: text("description").notNull(),
  plant: varchar("plant", { length: 20 }).notNull(),
  storageLocation: varchar("storage_location", { length: 20 }),
  currentStock: numeric("current_stock", { precision: 15, scale: 3 }).notNull().default("0"),
  safetyStock: numeric("safety_stock", { precision: 15, scale: 3 }).notNull().default("0"),
  reorderPoint: numeric("reorder_point", { precision: 15, scale: 3 }).notNull().default("0"),
  maxStock: numeric("max_stock", { precision: 15, scale: 3 }),
  unitOfMeasure: varchar("unit_of_measure", { length: 10 }).notNull().default("EA"),
  category: varchar("category", { length: 100 }),
  supplier: varchar("supplier", { length: 255 }),
  leadTimeDays: integer("lead_time_days").default(7),
  unitCost: numeric("unit_cost", { precision: 15, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("USD"),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Purchase Orders ──────────────────────────────────────────────────────────
export const purchaseOrders = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  poNumber: varchar("po_number", { length: 50 }).notNull().unique(),
  vendorId: integer("vendor_id"),
  vendorName: varchar("vendor_name", { length: 255 }).notNull(),
  materialNumber: varchar("material_number", { length: 50 }),
  description: text("description"),
  quantity: numeric("quantity", { precision: 15, scale: 3 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 15, scale: 2 }).notNull(),
  totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD"),
  status: varchar("status", { length: 50 }).notNull().default("open"), // open | delayed | delivered | cancelled
  expectedDelivery: timestamp("expected_delivery"),
  actualDelivery: timestamp("actual_delivery"),
  plant: varchar("plant", { length: 20 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Purchase Requisitions ────────────────────────────────────────────────────
export const purchaseRequisitions = pgTable("purchase_requisitions", {
  id: serial("id").primaryKey(),
  prNumber: varchar("pr_number", { length: 50 }).notNull().unique(),
  materialNumber: varchar("material_number", { length: 50 }),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 15, scale: 3 }).notNull(),
  unitOfMeasure: varchar("unit_of_measure", { length: 10 }).default("EA"),
  estimatedValue: numeric("estimated_value", { precision: 15, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("USD"),
  requiredDate: timestamp("required_date"),
  plant: varchar("plant", { length: 20 }),
  requestedBy: integer("requested_by"),
  status: varchar("status", { length: 50 }).notNull().default("pending"), // pending | approved | rejected | cancelled
  priority: varchar("priority", { length: 20 }).default("normal"),
  aiGenerated: boolean("ai_generated").default(false),
  agentRunId: integer("agent_run_id"),
  approvalId: integer("approval_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Vendors ──────────────────────────────────────────────────────────────────
export const vendors = pgTable("vendors", {
  id: serial("id").primaryKey(),
  vendorNumber: varchar("vendor_number", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  country: varchar("country", { length: 100 }),
  city: varchar("city", { length: 100 }),
  taxId: varchar("tax_id", { length: 50 }),
  bankAccount: varchar("bank_account", { length: 100 }),
  bankName: varchar("bank_name", { length: 255 }),
  contactEmail: varchar("contact_email", { length: 255 }),
  riskScore: numeric("risk_score", { precision: 5, scale: 2 }).default("0"),
  isActive: boolean("is_active").default(true),
  onWatchlist: boolean("on_watchlist").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Invoices ─────────────────────────────────────────────────────────────────
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: varchar("invoice_number", { length: 100 }).notNull(),
  vendorId: integer("vendor_id"),
  vendorName: varchar("vendor_name", { length: 255 }).notNull(),
  poNumber: varchar("po_number", { length: 50 }),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD"),
  invoiceDate: timestamp("invoice_date").notNull(),
  dueDate: timestamp("due_date"),
  paymentStatus: varchar("payment_status", { length: 50 }).default("pending"), // pending | approved | blocked | paid
  reviewStatus: varchar("review_status", { length: 50 }).default("unreviewed"), // unreviewed | under_review | cleared | escalated
  riskScore: numeric("risk_score", { precision: 5, scale: 2 }).default("0"),
  riskFactors: jsonb("risk_factors").default("[]"),
  isDuplicate: boolean("is_duplicate").default(false),
  duplicateOf: varchar("duplicate_of", { length: 100 }),
  flaggedAt: timestamp("flagged_at"),
  bankAccountAtInvoice: varchar("bank_account_at_invoice", { length: 100 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Fraud Cases ──────────────────────────────────────────────────────────────
export const fraudCases = pgTable("fraud_cases", {
  id: serial("id").primaryKey(),
  caseNumber: varchar("case_number", { length: 50 }).notNull().unique(),
  invoiceId: integer("invoice_id"),
  vendorId: integer("vendor_id"),
  caseType: varchar("case_type", { length: 100 }).notNull(), // duplicate_invoice | bank_mismatch | price_anomaly | vendor_anomaly
  severity: varchar("severity", { length: 20 }).notNull().default("medium"), // low | medium | high | critical
  riskScore: numeric("risk_score", { precision: 5, scale: 2 }).notNull().default("0"),
  evidence: jsonb("evidence").default("[]"),
  status: varchar("status", { length: 50 }).notNull().default("open"), // open | under_review | resolved | false_positive
  assignedTo: integer("assigned_to"),
  resolution: text("resolution"),
  agentRunId: integer("agent_run_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

// ─── Batch Jobs ───────────────────────────────────────────────────────────────
export const batchJobs = pgTable("batch_jobs", {
  id: serial("id").primaryKey(),
  jobId: uuid("job_id").defaultRandom().notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  fileName: varchar("file_name", { length: 255 }),
  fileSize: integer("file_size"),
  recordCount: integer("record_count").default(0),
  successCount: integer("success_count").default(0),
  errorCount: integer("error_count").default(0),
  warningCount: integer("warning_count").default(0),
  status: varchar("status", { length: 50 }).notNull().default("pending"), // pending | validating | validated | simulating | simulated | executing | completed | failed | cancelled
  sapTransaction: varchar("sap_transaction", { length: 20 }),
  fieldMapping: jsonb("field_mapping").default("{}"),
  validationResults: jsonb("validation_results").default("[]"),
  executionResults: jsonb("execution_results").default("[]"),
  errorReport: jsonb("error_report").default("[]"),
  simulationMode: boolean("simulation_mode").default(true),
  submittedBy: integer("submitted_by"),
  approvalId: integer("approval_id"),
  agentRunId: integer("agent_run_id"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Batch Records ────────────────────────────────────────────────────────────
export const batchRecords = pgTable("batch_records", {
  id: serial("id").primaryKey(),
  batchJobId: integer("batch_job_id").notNull(),
  rowNumber: integer("row_number").notNull(),
  rawData: jsonb("raw_data").notNull(),
  mappedData: jsonb("mapped_data"),
  validationStatus: varchar("validation_status", { length: 20 }).default("pending"), // pending | valid | invalid | warning
  validationErrors: jsonb("validation_errors").default("[]"),
  executionStatus: varchar("execution_status", { length: 20 }).default("pending"), // pending | success | failed | skipped
  executionMessage: text("execution_message"),
  sapDocumentNumber: varchar("sap_document_number", { length: 50 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Approval Requests ────────────────────────────────────────────────────────
export const approvalRequests = pgTable("approval_requests", {
  id: serial("id").primaryKey(),
  requestId: uuid("request_id").defaultRandom().notNull().unique(),
  type: varchar("type", { length: 100 }).notNull(), // purchase_requisition | payment_block | vendor_change | batch_execution
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  requestedBy: integer("requested_by"),
  requestedByName: varchar("requested_by_name", { length: 255 }),
  assignedTo: integer("assigned_to"),
  status: varchar("status", { length: 50 }).notNull().default("pending"), // pending | approved | rejected | cancelled
  priority: varchar("priority", { length: 20 }).default("normal"),
  payload: jsonb("payload").default("{}"),
  approvedBy: integer("approved_by"),
  approvedByName: varchar("approved_by_name", { length: 255 }),
  approvalNotes: text("approval_notes"),
  rejectionReason: text("rejection_reason"),
  expiresAt: timestamp("expires_at"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Agent Runs ───────────────────────────────────────────────────────────────
export const agentRuns = pgTable("agent_runs", {
  id: serial("id").primaryKey(),
  runId: uuid("run_id").defaultRandom().notNull().unique(),
  sessionId: varchar("session_id", { length: 100 }),
  userId: integer("user_id"),
  userMessage: text("user_message").notNull(),
  supervisorDecision: varchar("supervisor_decision", { length: 100 }), // supply_chain | fraud | bdc | multi_agent
  agentsInvoked: jsonb("agents_invoked").default("[]"),
  toolsUsed: jsonb("tools_used").default("[]"),
  response: text("response"),
  structuredOutput: jsonb("structured_output"),
  status: varchar("status", { length: 50 }).notNull().default("running"), // running | completed | failed | timeout
  executionMode: varchar("execution_mode", { length: 20 }).default("simulated"), // simulated | live
  durationMs: integer("duration_ms"),
  tokenCount: integer("token_count"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

// ─── Chat Messages ────────────────────────────────────────────────────────────
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id", { length: 100 }).notNull(),
  userId: integer("user_id"),
  role: varchar("role", { length: 20 }).notNull(), // user | assistant | system
  content: text("content").notNull(),
  agentRunId: integer("agent_run_id"),
  metadata: jsonb("metadata").default("{}"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Audit Log ────────────────────────────────────────────────────────────────
export const auditLog = pgTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id"),
    userEmail: varchar("user_email", { length: 255 }),
    action: varchar("action", { length: 100 }).notNull(),
    resourceType: varchar("resource_type", { length: 100 }),
    resourceId: varchar("resource_id", { length: 100 }),
    description: text("description").notNull(),
    metadata: jsonb("metadata").default("{}"),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    severity: varchar("severity", { length: 20 }).default("info"), // info | warning | error | critical
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("audit_log_created_at_idx").on(table.createdAt)]
);

// ─── Settings ─────────────────────────────────────────────────────────────────
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: jsonb("value").notNull(),
  description: text("description"),
  updatedBy: integer("updated_by"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
