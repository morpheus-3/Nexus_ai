# SAP Nexus AI — Project Summary

## Problem

Enterprise teams need a practical way to review supply-chain exceptions, invoice risk indicators, and legacy SAP batch workflows without allowing an AI model to execute financial or SAP changes autonomously.

## Solution

SAP Nexus AI is a Next.js and PostgreSQL prototype that combines deterministic business analysis, optional aggregate-only Groq narratives, publicly accessible demo workflows, and human approval workflows. SAP actions are simulated.

## Features and architecture

- Next.js 16 App Router UI and API routes, TypeScript, Tailwind CSS, Radix UI, and Recharts.
- PostgreSQL persistence through Drizzle ORM for inventory, POs, vendors, invoices, batches, agent runs, approvals, settings, and audit events.
- Keyword-routed supervisor with Supply Chain, Fraud & Compliance, and BDC specialists.
- CSV/XLSX field mapping, validation, persistence, and BDC simulation.
- Public pages and API routes that require no account or session.
- Audit metadata records action, actor, workflow status, tool names, model/source, and fallback classification without storing provider keys.

## AI and safety design

Inventory findings, invoice risk indicators, duplicate and mismatch flags, and workflow results are computed deterministically from database records. When configured, Groq receives aggregate counts for narrative generation only; source records and credentials are excluded. The UI labels deterministic and Groq-generated sections, and provider failures fall back to deterministic output. Risk findings are review indicators, not proof of fraud. Approval workflows are available directly in the demo experience. SAP execution is unavailable and BDC always runs in simulation mode.

## Verification evidence

Run `pnpm run lint`, `pnpm run typecheck`, `pnpm run build`, and `pnpm run test:reliability`. Database-backed import, agent, and approval checks require PostgreSQL and demo data. Record the actual command results and database/browser availability in the final submission; do not infer them from this summary.

## Current status and limitations

The repository contains the described prototype workflows. Whether each external service and end-to-end workflow is available depends on local PostgreSQL, seeded/imported data, and optional Groq credentials. The Qwen 3.8 model default is Preview; owners must confirm an approved model and account limits. There is no production SAP adapter. Production use also requires security review, operational monitoring, rate limiting, backups, and environment-specific secret management.

## Future scope

Add automated browser tests, provider contract tests, ingestion transaction/idempotency tests, deployment monitoring and rate limits, formal data-retention controls, and an SAP adapter only after separate security and operational approval.
