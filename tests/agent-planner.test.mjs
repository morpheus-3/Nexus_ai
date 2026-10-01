import test from "node:test";
import assert from "node:assert/strict";
import { createAgentPlan, executeAgentPlan, localPlan } from "../src/lib/agent-planner.ts";
import { generateWithGroq } from "../src/lib/groq.ts";

const step = tool => ({ tool, reason: "Inspect requested data" });
const generated = steps => async () => ({ source: "groq", model: "test-model", content: JSON.stringify({ steps }) });
const response = status => ({
  agent: "supply_chain", agentsInvoked: ["supply_chain_agent"], toolsUsed: ["get_inventory_status"],
  response: "Analysis result", status, executionMode: "simulated", responseSource: "deterministic_agent", durationMs: 1,
});

test("local routing includes BDC alongside other requested specialists", () => {
  assert.deepEqual(localPlan("Check inventory and batch jobs").steps.map(s => s.tool), ["inspect_inventory", "inspect_batch_jobs"]);
  assert.deepEqual(localPlan("Review invoices and batch status").steps.map(s => s.tool), ["inspect_invoice_risk", "inspect_batch_jobs"]);
  assert.equal(localPlan("Check stock, invoice risk, and BDC jobs").steps.length, 3);
});

test("local routing handles full reviews, unknown requests, and word boundaries", () => {
  assert.equal(localPlan("Run a full review").steps.length, 3);
  assert.equal(localPlan("Hello, tell me a joke").steps.length, 0);
  assert.equal(localPlan("What is important today?").steps.length, 0);
  assert.equal(localPlan("Check vendor risk").steps[0].tool, "inspect_invoice_risk");
});

test("planning without opt-in stays local", async () => {
  const plan = await createAgentPlan("Check stock");
  assert.equal(plan.source, "local");
  assert.equal(plan.fallbackReason, undefined);
});

test("AI plan chooses tools and execution preserves its order", async () => {
  const plan = await createAgentPlan("Check invoice risk before inventory", generated([step("inspect_invoice_risk"), step("inspect_inventory")]));
  assert.equal(plan.source, "groq");
  assert.equal(plan.model, "test-model");
  const calls = [];
  const { execution, results } = await executeAgentPlan(plan, async tool => {
    calls.push(tool);
    return response("completed");
  });
  assert.deepEqual(calls, ["inspect_invoice_risk", "inspect_inventory"]);
  assert.equal(results.length, 2);
  assert.equal(execution.steps.every(s => s.status === "completed"), true);
});

test("unsupported AI requests call no tools", async () => {
  const plan = await createAgentPlan("Tell me a joke", generated([]));
  const { execution } = await executeAgentPlan(plan, async () => assert.fail("no tools should run"));
  assert.deepEqual(execution.steps, []);
});

test("invalid plans fall back before executing any model-selected tool", async t => {
  for (const [name, content] of [
    ["unknown tool", { steps: [step("execute_sap")] }],
    ["prototype property", { steps: [step("constructor")] }],
    ["duplicate tool", { steps: [step("inspect_inventory"), step("inspect_inventory")] }],
    ["over budget", { steps: Array.from({ length: 4 }, () => step("inspect_inventory")) }],
    ["SQL argument", { steps: [{ ...step("inspect_inventory"), sql: "DELETE FROM invoices" }] }],
    ["extra root field", { steps: [], command: "approve" }],
    ["missing reason", { steps: [{ tool: "inspect_inventory" }] }],
    ["oversized reason", { steps: [{ tool: "inspect_inventory", reason: "a".repeat(241) }] }],
    ["wrong shape", []],
  ]) await t.test(name, async () => {
    const plan = await createAgentPlan("Show batch jobs", async () => ({ source: "groq", model: "test", content: JSON.stringify(content) }));
    assert.equal(plan.source, "local");
    assert.equal(plan.fallbackReason, "invalid_plan");
    assert.deepEqual(plan.steps.map(s => s.tool), ["inspect_batch_jobs"]);
  });
});

test("malformed JSON and thrown planner failures safely use local routing", async () => {
  for (const generate of [
    async () => ({ source: "groq", model: "test", content: "not JSON" }),
    async () => { throw new Error("private provider details"); },
  ]) {
    const plan = await createAgentPlan("Review invoices", generate);
    assert.equal(plan.fallbackReason, "invalid_plan");
    assert.equal(JSON.stringify(plan).includes("private provider details"), false);
    assert.equal(plan.steps[0].tool, "inspect_invoice_risk");
  }
});

test("provider failures preserve the fallback reason and requested specialists", async () => {
  for (const fallbackReason of ["missing_api_key", "invalid_api_key", "rate_limited", "timeout", "network_error", "invalid_model"]) {
    const plan = await createAgentPlan("Review stock and batch jobs", async () => ({ source: "deterministic_fallback", model: "test", fallbackReason }));
    assert.equal(plan.fallbackReason, fallbackReason);
    assert.equal(plan.steps.length, 2);
  }
});

test("executor validates the entire plan before calling tools", async () => {
  await assert.rejects(executeAgentPlan({ source: "groq", steps: [step("inspect_inventory"), step("delete_records")] }, async () => assert.fail("must validate before calls")));
});

test("a failed tool retains successful results from the other tools without reruns", async () => {
  const calls = [];
  const { execution, results } = await executeAgentPlan(localPlan("Inventory, invoices and batch jobs"), async tool => {
    calls.push(tool);
    if (tool === "inspect_invoice_risk") throw new Error("secret database connection details");
    return response("completed");
  });
  assert.equal(calls.length, 3);
  assert.deepEqual(execution.steps.map(s => s.status), ["completed", "failed", "completed"]);
  assert.equal(results[1].status, "failed");
  assert.equal(JSON.stringify({ execution, results }).includes("secret database"), false);
});

test("returned failure is reflected in execution and is never labeled completed", async () => {
  const { execution } = await executeAgentPlan(localPlan("Check stock"), async () => response("failed"));
  assert.equal(execution.steps[0].status, "failed");
  assert.deepEqual(execution.steps[0].toolsUsed, ["get_inventory_status"]);
});

test("Groq JSON mode is opt-in and does not change existing narrative requests", async t => {
  const oldKey = process.env.GROQ_API_KEY;
  t.after(() => { if (oldKey === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = oldKey; });
  process.env.GROQ_API_KEY = "test-key";
  for (const jsonMode of [true, false]) {
    await generateWithGroq("Return JSON", "{}", async (_url, init) => {
      const body = JSON.parse(init.body);
      assert.deepEqual(body.response_format, jsonMode ? { type: "json_object" } : undefined);
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"steps":[]}' } }] }));
    }, { jsonMode });
  }
});
