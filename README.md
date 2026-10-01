# SAP Nexus AI

SAP Nexus AI is a database-backed enterprise operations prototype for SAP supply-chain monitoring, invoice-risk review, agent-assisted analysis, and safe BDC workflow demonstrations. It combines deterministic business rules with optional Groq-generated summaries. All SAP changes remain simulated.

## Capabilities

- Dashboard KPIs and seven-day agent activity calculated from PostgreSQL records.
- Supply Chain analysis for safety stock, shortages, delayed purchase orders, and pending requisitions.
- Fraud and compliance indicators for duplicates, mismatched invoice bank references, and watchlist vendors. Indicators require human review and are not proof of fraud.
- Command Center with optional AI planning, validated read-only specialist tools, local routing fallback, and persisted execution traces.
- CSV/XLSX validation and persistence for inventory, purchase orders, vendors, and invoices; BDC batch simulation with row-level results.
- Human approval requests for payment-block recommendations and requisitions, with audit and observability records.
- Settings for thresholds and SAP simulation configuration.

## Architecture and data flow

```text
Next.js App Router (server-rendered pages and API routes)
   ├─ Public demo pages and API routes with no sign-in flow
   ├─ Drizzle ORM ─ PostgreSQL (business data, runs, approvals, audit)
   └─ Deterministic agents ─ optional Groq narrative from aggregate counts only
                                  └─ deterministic fallback
```

The supervisor builds a plan and invokes specialist agents through an allowlist. Agents query persisted data and compute findings locally. Narrative generation sends only an agent name, aggregate numeric facts, and instructions to Groq. When **Use AI planning** is selected in Command Center, the current request text is also sent to Groq to select and order tools. Imported database records, conversation history, and database credentials are not sent to the planner. Avoid including sensitive information in requests sent for AI planning. The provider API key is used only for authentication. Agent runs persist the plan, execution steps, outcomes, timing, and planner fallback reason. Groq narratives remain separate from deterministic findings.

## Agent planning (first stage)

In **Command Center**, select **Use AI planning** and try: `Check inventory shortages, inspect invoice risk, and show recent BDC batch jobs.` The response includes a **Plan & execution** panel; the same trace is available when expanding the run in Observability.

- Groq returns a JSON plan; the server validates it before executing any step. Unknown tools, extra arguments, repeated tools, and plans longer than three steps are rejected. This uses [Groq JSON Object Mode](https://console.groq.com/docs/structured-outputs), with application-side schema validation.
- Available tools call the existing Supply Chain, Fraud, and BDC analysis functions. The plan chooses specialist order; each specialist retains its existing deterministic checks. BDC reads the latest five jobs. Analysis currently covers all imported records; record and date filters are not supported.
- Without the checkbox, routing stays local. Missing keys, provider errors and invalid plans fall back to local routing with a visible reason. Set `AGENT_PLANNING_ENABLED=false` on the server to disable AI planning regardless of the checkbox; existing narrative settings remain unchanged.
- Tool failures remain failures in the trace; other selected tools still return their results. A failed run is never labeled fully completed. Unrecognized requests ask for a supported analysis instead of silently querying inventory.
- Chat only reads business data. It does not create approval requests or execute business changes. The existing **Run Supply Chain** / **Run Fraud** controls submit supported recommendations through the existing human approval workflow.
- User message, run, assistant message, and audit entry are saved in one database transaction, including execution metadata. No database migration is required.

This stage provides planning, specialist execution and a trace shown after completion. Adaptive replanning, conversation memory, streaming progress, and creating approvals directly from chat are not implemented yet. Each request is handled independently; the stored session is history, not model memory.

All demo navigation and API workflows are available without an account. Approval actions are part of the local demo workflow and are not tied to a named person.

## Local setup

Prerequisites: Node.js 22+, pnpm, and Docker Desktop or a local PostgreSQL 16+ server.

Clone the repository and enter the project folder:

```powershell
git clone https://github.com/morpheus-3/Nexus_ai.git
cd Nexus_ai
```

Then complete the first-time setup:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
# Edit only the required keys in .env; keep any existing values you need.
docker compose up -d postgres
pnpm install --frozen-lockfile
pnpm exec drizzle-kit push
pnpm run db:verify
pnpm dev
```

Open <http://localhost:3000>; it opens the dashboard directly. Use BDC Data Automation's **Load demo dataset** control to populate sample business records.

### Run the app after setup

From the project folder, start PostgreSQL and the development server:

```powershell
docker compose up -d postgres
pnpm dev
```

Open <http://localhost:3000>. Press `Ctrl+C` in the terminal to stop the app.

To build and run the production version locally, keep PostgreSQL running and use:

```powershell
pnpm build
pnpm start
```

The local PostgreSQL defaults are role `postgres`, database `app_db`, and host port `5432`. `docker compose up -d postgres` preserves the named `postgres_data` volume. PostgreSQL's `POSTGRES_USER` and `POSTGRES_DB` initialize an empty data directory only; changing them does not rename roles/databases in an existing volume. Keep `DATABASE_URL` aligned with the existing database, and percent-encode URL-reserved password characters.

## Environment variables

See [.env.example](.env.example). `DATABASE_URL` and `POSTGRES_PASSWORD` are required. The included PostgreSQL container defaults to role `postgres` and database `app_db`; set `POSTGRES_USER` and `POSTGRES_DB` to match when overriding those values. Run `pnpm run db:verify` to check connectivity without printing credentials. No login, `JWT_SECRET`, or demo password is required. `GROQ_API_KEY` is optional; without it the deterministic agent analysis still works. `GROQ_MODEL` defaults to `qwen/qwen3.8-27b`. Keep local provider and database secrets private.

## Groq and fallback behavior

Groq is the only supported LLM provider. The configured model is read from `GROQ_MODEL`; Settings reports whether a key is configured separately from whether a live request succeeded. Missing/invalid keys, rate limits, timeout, network failures, invalid models, and malformed responses fall back to deterministic output with a reason shown in the app. A configured key does not guarantee availability or account access.

The default `qwen/qwen3.8-27b` is listed by Groq as a Preview model, which Groq says is for evaluation and may be discontinued. Deployment owners must verify an account-approved, supported model and rate limits before staging or production use: [Groq model listing](https://console.groq.com/docs/models) and [Qwen 3.8 model page](https://console.groq.com/docs/model/qwen/qwen3.8-27b).

## SAP safety boundary

The current BDC interface validates and simulates batches. A request with `simulationMode: false` is rejected because no authorized SAP adapter is implemented. No LLM output is executed as ABAP or used to issue SAP transactions. Connecting SAP requires a separately reviewed, parameterized adapter, SAP-side authorization, and explicit operational approval.

## Checks

```powershell
pnpm run lint
pnpm run typecheck
pnpm run build
pnpm run test:reliability
```

Database-backed and browser verification require a running PostgreSQL database and seeded/imported demo records. See [DEMO_GUIDE.md](DEMO_GUIDE.md) for the evaluation walkthrough and required evidence.

To run approval regression checks against a running local app and its configured PostgreSQL database:

```powershell
$env:APPROVAL_TEST_URL='http://127.0.0.1:3000'
pnpm.cmd run test:approvals
```

These opt-in tests create temporary approval, invoice, and requisition fixtures and remove only those fixtures and their audit entries afterward. They cover single and multiple invoice approvals, stale or invalid links, repeated approvals, summary counts, and requisition decisions. Older approval requests without linked records cannot be approved; the UI displays the server error and allows rejecting outdated requests. Successful actions update the list and its summary directly from the committed server response.

## Current limitations

- This is an unauthenticated local demo, not a production deployment. Do not expose it publicly or load sensitive data. Production use requires authentication, role-based access, rate limiting, centralized audit retention, operational monitoring, security review, and backup/restore.
- Groq availability, preview model status, quotas, and account permissions are external dependencies; deterministic analysis remains available when the provider cannot be used.
- SAP execution is not connected. All shown BDC execution results are simulations.
- Browser automation screenshots are not included; no fabricated screenshots or deployment claims are made.
