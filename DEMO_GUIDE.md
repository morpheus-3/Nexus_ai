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
