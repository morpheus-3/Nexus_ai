# SAP Nexus AI — 5–7 Minute Demo Guide

## Before the demo

1. Start PostgreSQL, push the Drizzle schema, and start the app using the commands in [README.md](README.md).
2. Open the local URL directly; no account is required. Use **Load demo dataset** in BDC Data Automation to add sample records.
3. Keep the Groq API key optional. If configured, use Settings → **Test Groq connection** to verify an actual request. If not, show the deterministic fallback label.
4. Confirm the banner and BDC page show simulation mode. Do not use a production database or real vendor/invoice data for an HR demo.

## Walkthrough

| Time | Step | What to show |
| --- | --- | --- |
| 0:00–0:45 | Dashboard | Open directly, persisted KPI values, and the seven-day agent chart. Explain that the chart is queried from agent runs. |
| 0:45–1:30 | Data import | On an empty demo database, load the sample dataset. Show imported counts and validation outcomes. On a preloaded database, show that repeated import does not create duplicate invoices. |
| 1:30–2:20 | Supply Chain | Review stock against safety thresholds, delayed POs, and pending requisitions. Explain that recommendations are not purchase orders. |
| 2:20–3:10 | Fraud & Compliance | Run Fraud analysis; point out duplicate, mismatch, and watchlist indicators. State that findings require review and do not prove fraud. |
| 3:10–4:10 | Command Center | Ask for a supply-chain or finance review. Show agent identity, tools, duration, execution status, response source, model, or fallback reason. |
| 4:10–5:15 | Human approval | Submit a payment-block recommendation. Confirm payment remains pending, approve the request and show the resulting state. Actions are not attributed to named users. |
| 5:15–6:15 | BDC, audit, observability | Validate a sample file and run simulation; show batch history. Show the corresponding agent run and audit event. |
| 6:15–6:45 | Safety boundary | Point out the persistent simulation warning. State that there is no SAP adapter and no arbitrary ABAP execution. |

## Evidence to capture during an actual run

Record the date, whether the database and Groq request succeeded, imported/validated counts, run/approval IDs, and any errors. Do not include passwords, session tokens, API keys, bank account values, tax IDs, or raw invoice/vendor exports in screenshots. No screenshots are committed because none were captured as part of this pass.

## Agent planning verification

1. Start PostgreSQL and the app, then load or import demo data.
2. In Command Center, leave **Use AI planning** off and request `Check inventory and BDC batch jobs`. Verify both specialists appear in **Plan & execution**.
3. Enable **Use AI planning** with a working Groq key and request `Inspect invoice risk, then inventory shortages and recent batch jobs`. Verify the trace identifies the AI planner and shows the actual step outcomes. The request text is sent to Groq; database records stay local.
4. With no Groq key, repeat the request. Verify the local planner and `missing_api_key` reason are visible and the database analysis still runs.
5. Ask an unrelated question with local routing. Verify no tools are called and the response asks for a supported analysis.
6. Expand the run in Observability and verify its stored execution trace matches Command Center.
7. Verify chat has not created approval requests. Use the existing agent Run controls to submit supported recommendations, then review them in Approvals.

The automated reliability suite covers invalid plans, unsupported tools, duplicate steps, call limits, provider failures, partial tool failures, BDC routing, and the existing import and approval recommendation checks. Browser and database checks above require running local services. Conversation memory and adaptive replanning are later stages.

### First-stage verification results

- All 38 reliability checks, TypeScript, ESLint, and the production build passed.
- The built Command Center returned HTTP 200 and included the planning control. Blank requests, malformed JSON, and invalid planning flags returned HTTP 400.
- Against the existing local PostgreSQL data, local multi-agent routing, provider network fallback, and unsupported-request handling passed (verification runs 67–69).
- A live Groq request selected invoice risk, inventory, then BDC. All three tools completed; the saved trace matched the chat-history and Observability API responses (verification run 70). Approval request counts remained unchanged.
- These were automated and HTTP/API checks; no interactive browser inspection or screenshots were performed. Verification runs remain in the local run history.
