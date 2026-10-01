import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import "dotenv/config";
import pg from "pg";

// Explicit opt-in: exercises a running local app and cleans up only its own fixtures.
const base = process.env.APPROVAL_TEST_URL;
test("approval transitions and linked records remain consistent", { skip: !base }, async t => {
  const url = new URL(base);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname), "Use a local test app");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  const approvalIds = [], invoiceIds = [], prNumbers = [];
  t.after(async () => {
    try {
      await pool.query("DELETE FROM audit_log WHERE resource_id = ANY($1::text[]) AND resource_type = 'approval_request'", [approvalIds]);
      await pool.query("DELETE FROM audit_log WHERE resource_id = ANY($1::text[]) AND resource_type = 'invoice'", [invoiceIds.map(String)]);
      await pool.query("DELETE FROM approval_requests WHERE request_id = ANY($1::uuid[])", [approvalIds]);
      await pool.query("DELETE FROM invoices WHERE id = ANY($1::int[])", [invoiceIds]);
      await pool.query("DELETE FROM purchase_requisitions WHERE pr_number = ANY($1::text[])", [prNumbers]);
    } finally { await pool.end(); }
  });
  const invoice = async () => {
    const { rows } = await pool.query("INSERT INTO invoices (invoice_number,vendor_name,amount,invoice_date) VALUES ($1,'Approval test fixture',1,now()) RETURNING id", ["TEST-" + randomUUID()]);
    invoiceIds.push(rows[0].id);
    return rows[0].id;
  };
  const approval = async (type, payload) => {
    const id = randomUUID();
    await pool.query("INSERT INTO approval_requests (request_id,type,title,payload) VALUES ($1,$2,'Approval regression fixture',$3)", [id,type,JSON.stringify(payload)]);
    approvalIds.push(id);
    return id;
  };
  const act = async (requestId, action = "approve") => {
    const res = await fetch(new URL("/api/approvals", base), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({requestId,action,reason:"Regression test"}) });
    return {status:res.status,body:await res.json()};
  };
  const state = async id => (await pool.query("SELECT status FROM approval_requests WHERE request_id=$1", [id])).rows[0].status;
  const payment = async id => (await pool.query("SELECT payment_status FROM invoices WHERE id=$1", [id])).rows[0].payment_status;

  await t.test("single invoice approval updates the request, invoice, and summary source", async () => {
    const before = await fetch(new URL("/api/approvals", base)).then(r => r.json());
    const approvedBefore = before.requests.filter(r => r.status === "approved").length;
    const invoiceId = await invoice();
    const id = await approval("payment_block", {invoiceId});
    const result = await act(id);
    assert.equal(result.status, 200);
    assert.equal(result.body.request.requestId, id);
    assert.equal(result.body.request.status, "approved");
    assert.equal(await state(id), "approved");
    assert.equal(await payment(invoiceId), "blocked");
    const list = await fetch(new URL("/api/approvals", base)).then(r => r.json());
    assert.equal(list.requests.find(r => r.requestId === id).status, "approved");
    assert.equal(list.requests.filter(r => r.status === "approved").length, approvedBefore + 1);
    assert.equal((await act(id)).status, 409);
  });
  await t.test("multiple invoices are approved together", async () => {
    const ids = [await invoice(), await invoice()];
    const id = await approval("payment_block", {invoiceIds:ids});
    assert.equal((await act(id)).status, 200);
    for (const item of ids) assert.equal(await payment(item), "blocked");
  });
  await t.test("invalid or stale invoice links leave all records untouched", async () => {
    const first = await invoice(), second = await invoice();
    await pool.query("UPDATE invoices SET payment_status='paid' WHERE id=$1",[second]);
    const id = await approval("payment_block", {invoiceIds:[first,second]});
    assert.equal((await act(id)).status, 409);
    assert.equal(await state(id), "pending");
    assert.equal(await payment(first), "pending");
    assert.equal(await payment(second), "paid");
    const malformed = await approval("payment_block", {invoiceIds:[first,"invalid"]});
    assert.equal((await act(malformed)).status, 409);
    assert.equal(await payment(first), "pending");
  });
  await t.test("legacy requests fail visibly and can be rejected", async () => {
    for (const type of ["purchase_requisition","payment_block"]) {
      const id = await approval(type, {findings:2});
      const result = await act(id);
      assert.equal(result.status, 409);
      assert.ok(result.body.error);
      assert.equal(await state(id), "pending");
      assert.equal((await act(id,"reject")).body.request.status, "rejected");
    }
  });
  await t.test("valid requisition approval cannot later be overwritten by a stale request", async () => {
    const prNumber = "TEST-" + randomUUID();
    await pool.query("INSERT INTO purchase_requisitions (pr_number,description,quantity) VALUES ($1,'Approval test fixture',1)",[prNumber]);
    prNumbers.push(prNumber);
    const id = await approval("purchase_requisition", {prNumber});
    assert.equal((await act(id)).body.request.status,"approved");
    const duplicate = await approval("purchase_requisition", {prNumber});
    assert.equal((await act(duplicate)).status,409);
    assert.equal((await act(duplicate,"reject")).status,200);
    const row = await pool.query("SELECT status FROM purchase_requisitions WHERE pr_number=$1",[prNumber]);
    assert.equal(row.rows[0].status,"approved");
  });
});
