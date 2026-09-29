import test from "node:test";
import assert from "node:assert/strict";
import { generateWithGroq } from "../src/lib/groq.ts";
import { getFraudPaymentMetrics, matchPendingRequisitions } from "../src/lib/agent-decisions.ts";
import { validateIngestionRecords } from "../src/lib/data-ingestion-validation.ts";
import { parseCsvRows, parseXlsxRows } from "../src/lib/import-file.ts";
import * as XLSX from "xlsx";

const ok = text => new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), { status: 200 });
const fail = (status, code) => async () => new Response(JSON.stringify({ error: { code } }), { status });

test("Groq reports successful generation and configured model", async () => {
  process.env.GROQ_API_KEY = "test-secret-never-logged";
  process.env.GROQ_MODEL = "test-model";
  const result = await generateWithGroq("system", '{"count":2}', async () => ok("summary"));
  assert.equal(result.source, "groq");
  assert.equal(result.model, "test-model");
  assert.equal(result.content, "summary");
});

test("Groq reports missing credentials without a request", async () => {
  process.env.GROQ_API_KEY = " ";
  const result = await generateWithGroq("system", "{}", async () => assert.fail("fetch should not run"));
  assert.equal(result.fallbackReason, "missing_api_key");
});

test("Groq maps authentication, rate limit, invalid model, and provider failures", async t => {
  process.env.GROQ_API_KEY = "test-secret-never-logged";
  for (const [name, status, code, expected] of [
    ["authentication", 401, "invalid_api_key", "invalid_api_key"],
    ["rate limit", 429, "rate_limit_exceeded", "rate_limited"],
    ["invalid model", 400, "model_not_found", "invalid_model"],
    ["retired or unknown model", 404, "model_not_found", "invalid_model"],
    ["provider error", 503, "server_error", "provider_error"],
  ]) {
    await t.test(name, async () => {
      const result = await generateWithGroq("system", "{}", fail(status, code));
      assert.equal(result.fallbackReason, expected);
      assert.ok(result.diagnostic);
      assert.equal(JSON.stringify(result).includes("test-secret-never-logged"), false);
    });
  }
});

test("Groq distinguishes timeout, network failure, and malformed completions", async t => {
  process.env.GROQ_API_KEY = "test-secret-never-logged";
  await t.test("timeout", async () => {
    const result = await generateWithGroq("system", "{}", async () => { const error = new Error("timeout"); error.name = "TimeoutError"; throw error; });
    assert.equal(result.fallbackReason, "timeout");
  });
  await t.test("network", async () => {
    const result = await generateWithGroq("system", "{}", async () => { throw new TypeError("network"); });
    assert.equal(result.fallbackReason, "network_error");
  });
  await t.test("malformed JSON", async () => {
    const result = await generateWithGroq("system", "{}", async () => new Response("not json", { status: 200 }));
    assert.equal(result.fallbackReason, "malformed_response");
  });
  await t.test("missing completion", async () => {
    const result = await generateWithGroq("system", "{}", async () => new Response("{}", { status: 200 }));
    assert.equal(result.fallbackReason, "malformed_response");
  });
});

test("payment metrics separate persisted blocks from pending recommendations", () => {
  const records = [
    { paymentStatus: "pending", riskScore: "90" },
    { paymentStatus: "blocked", riskScore: "90" },
    { paymentStatus: "approved", riskScore: "95" },
    { paymentStatus: "pending", riskScore: "30" },
  ];
  const metrics = getFraudPaymentMetrics(records);
  assert.equal(metrics.blockedInvoices.length, 1);
  assert.equal(metrics.recommendedBlockInvoices.length, 1);
  // A failed approval leaves the persisted status pending, so it must not count as blocked.
  assert.equal(getFraudPaymentMetrics([{ paymentStatus: "pending", riskScore: 90 }]).blockedInvoices.length, 0);
});

test("requisition advice matches pending requests or recommends drafting new ones", () => {
  const findings = [
    { materialNumber: "M1", description: "Pump", severity: "critical" },
    { materialNumber: "M2", description: "Valve", severity: "high" },
  ];
  assert.equal(matchPendingRequisitions([], []).createNew.length, 0);
  assert.equal(matchPendingRequisitions(findings.slice(0, 1), [{ prNumber: "PR1", materialNumber: "M1" }]).reviewExisting[0].prNumber, "PR1");
  const multiple = matchPendingRequisitions(findings, [{ prNumber: "PR1", materialNumber: "M1" }, { prNumber: "PR2", materialNumber: "M1" }]);
  assert.equal(multiple.reviewExisting.length, 2);
  assert.equal(multiple.createNew[0].materialNumber, "M2");
});

test("CSV field validation covers all import datasets and useful invalid vendor errors", () => {
  const valid = {
    vendors: [{ vendorNumber: "V1", name: "Vendor" }],
    inventory: [{ materialNumber: "M1", description: "Part", plant: "P1", currentStock: "3" }],
    purchase_orders: [{ poNumber: "PO1", vendorName: "Vendor", quantity: "2", unitPrice: "3" }],
    invoices: [{ invoiceNumber: "I1", vendorName: "Vendor", amount: "6", invoiceDate: "2026-01-01" }],
  };
  for (const [dataset, rows] of Object.entries(valid)) assert.equal(validateIngestionRecords(dataset, rows)[0].valid, true, dataset);
  const invalidVendor = validateIngestionRecords("vendors", [{ vendorNumber: "", name: "" }])[0];
  assert.equal(invalidVendor.valid, false);
  assert.deepEqual(invalidVendor.errors, ["vendorNumber is required", "name is required"]);
});

test("CSV and XLSX parsers retain headers and rows for ingestion validation", () => {
  const csv = parseCsvRows("vendorNumber,name\nV-TEST,Test Supplier");
  assert.equal(validateIngestionRecords("vendors", csv)[0].valid, true);
  const worksheet = XLSX.utils.aoa_to_sheet([["vendorNumber", "name"], ["V-TEST-XLSX", "Workbook Supplier"]]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Vendors");
  const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const xlsx = parseXlsxRows(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  assert.equal(validateIngestionRecords("vendors", xlsx)[0].valid, true);
  assert.equal(xlsx[0].vendorNumber, "V-TEST-XLSX");
});
