# StudyTogether WebApp --- Project Understanding & Audit Handoff

**Purpose:** Use this document as context in future AI/code-review
sessions, preserve current understanding, and independently verify
previous audit findings with evidence.

**Important:** All findings listed here are preliminary hypotheses. Do
not label a bug or vulnerability as confirmed until it has been checked
against the current source code, configuration, and---where
necessary---runtime behavior.

## 1. Project overview

StudyTogether appears to be an academic resource-sharing web
application. The initial repository review indicated the following
technologies and features:

-   React 19 + Vite frontend
-   Node.js + Express backend
-   MongoDB + Mongoose
-   Cloudinary-based PDF/file storage
-   A separate AI service for PDF ingestion, text chunking,
    embeddings/retrieval, and study tools
-   User accounts, paper uploads/approval, coins,
    contribution/leaderboard, and admin features
-   Razorpay payment integration
-   AI study features such as chat, notes, quizzes, and flashcards

Do not assume that a feature is fully implemented or operational merely
because it appears in a README, route, or UI. Verify the actual code
paths, configuration, and tests.

## 2. Preliminary architecture map

``` mermaid
flowchart TD
    Client[React / Vite client] --> API[Main Express API]
    API --> DB[(MongoDB / Mongoose)]
    API --> Cloudinary[Cloudinary storage]
    API --> Razorpay[Razorpay payments]
    Client --> AI[AI API / service]
    API --> AI
    AI --> Ingest[PDF extraction / OCR]
    Ingest --> Retrieval[Chunking / embeddings / retrieval]
    Retrieval --> Study[AI study tools / chat]
```

Initially identified directories:

-   `client/` --- frontend UI, routing, authentication state, and API
    calls
-   `server/` --- main API, business logic, authentication, papers,
    coins, payments, and admin
-   `ai/` --- AI API, ingestion, retrieval, and study features

This is only a preliminary map. Inspect the current repository to
confirm the actual architecture and service-to-service request paths.

## 3. Preliminary audit hypotheses to verify

### Finding A --- Authentication on AI internal endpoints

The earlier review did not clearly identify route-level authentication
for these paths in `ai/server.js`:

-   `/api/v1/internal/ai/process`
-   `/reprocess`
-   `/knowledge/:paperId`

Verify:

1.  The exact HTTP methods, route definitions, and router/middleware
    order.
2.  Whether global authentication, an API gateway, reverse proxy,
    network policy, or service-to-service secret protects the routes.
3.  The exact reprocessing and knowledge-deletion endpoints.
4.  Whether an unauthenticated request can actually trigger processing
    or deletion.
5.  Whether a minimal, safe local reproduction or regression test is
    possible.

The absence of middleware directly on a route does not by itself prove
an exploitable vulnerability. Check network reachability and
compensating controls.

### Finding B --- Coin purchase route

The earlier review raised a concern that `server/routes/coin.js` may
expose `/coins/purchase` that credits coins without verifying an
external payment, while `server/routes/payment.routes.js` contains a
Razorpay flow.

Verify:

1.  Whether `/coins/purchase` is registered and enabled.
2.  Whether it is intended only for development/mock use and whether it
    is reachable in production.
3.  Its authentication and authorization requirements.
4.  Whether the client can control the user identity, amount, or coin
    quantity.
5.  Where Razorpay signatures/webhooks are verified and where credits
    are issued.
6.  Whether a production-reachable path can grant coins without verified
    payment.
7.  Never make a real payment or use a production provider account
    during testing.

### Finding C --- Docker MongoDB port and AI service

The earlier review suspected that `docker-compose.yml` may use a Mongo
URI such as `mongodb:27107`, while the MongoDB container's usual
internal port is `27017`. The Compose configuration may also omit the AI
service even though the main API calls it.

Verify:

1.  Compose `ports`, `expose`, service names, and database
    URI/environment values.
2.  Which host and port the application container actually uses.
3.  Whether the AI service is deployed through another Compose
    file/profile or a remote service.
4.  `docker compose config`, health checks, and a clean startup where
    safe and possible.
5.  Never print `.env` secrets.

### Finding D --- Coin balance and transaction consistency

The earlier review suspected that `server/utils/coinManager.js` may
update a balance and create a transaction record in separate database
operations.

Verify:

1.  The exact functions and every call site.
2.  Whether MongoDB sessions/transactions are used.
3.  Whether concurrent spend/credit requests can cause a negative
    balance, duplicate credit, or missing transaction.
4.  Whether payment webhooks use idempotency keys or unique constraints.
5.  How conditional atomic updates, unique payment event IDs, retries,
    and reconciliation work.
6.  Whether a replica set is required and configured for MongoDB
    transactions.

### Finding E --- PDF access and paywall

The earlier review raised an access-control concern because
`GET /papers/:id` may return a `pdfLink`.

Verify:

1.  Authentication, ownership, approval, and purchase checks on the
    endpoint.
2.  The policies for preview and download endpoints.
3.  Whether PDF URLs are public, signed, expiring, or token-protected.
4.  Whether Cloudinary delivery configuration allows a paywall to be
    bypassed with a direct URL.
5.  Whether changing a paper ID can expose another user's private or
    unapproved content.
6.  The intended policy for public approved papers versus paid/private
    resources.

Do not call this a confirmed paywall bypass until the intended access
policy and actual delivery configuration have been checked.

### Finding F --- AI retrieval and PDF ingestion capacity

The earlier review raised a concern that `ai/services/vectorSearch.js`
may perform retrieval/scoring in application memory, and that
`ai/services/ingestor.js` may have substantial PDF/OCR workload.

Verify:

1.  Actual query limits, filters, candidate counts, chunk counts, and
    memory use.
2.  Whether a vector database/index is used or scoring occurs in
    application code.
3.  Upload file-size, page-count, and file-type limits.
4.  Whether PDF/OCR processing is synchronous or handled by background
    workers.
5.  Timeouts, concurrency limits, retries, job deduplication, and
    cleanup.
6.  Do not make scalability or throughput claims without representative
    load tests.

### Finding G --- Test and CI reliability

The earlier review suspected that a CI workflow may contain a pattern
such as `npm test || echo "Tests passed or ignored"` and that the
backend `package.json` may lack a test script.

Verify:

1.  The current workflow file and exact command.
2.  Whether the job genuinely fails when tests fail.
3.  Package scripts and tests at the root, `client/`, `server/`, and
    `ai/`.
4.  Build, lint, unit, integration, and end-to-end test coverage.
5.  Record the actual outcome of each test command. Clearly mark
    commands that were not run.

## 4. Required production-readiness audit areas

### Security

-   Authentication, authorization, and role checks
-   User-to-user IDOR/BOLA
-   Admin route protection
-   AI service-to-service authentication
-   Secrets/environment handling and token/secret leakage in logs
-   CORS, CSRF where applicable, XSS, and input validation
-   Rate limiting, abuse prevention, and upload validation
-   Direct PDF-link and paywall access
-   Prompt injection and treating retrieved document content as
    untrusted input
-   Isolation of sensitive user and chat data

### Money and business logic

-   Atomicity of coin earn/spend operations
-   Negative-balance prevention
-   Payment signature and webhook verification
-   Idempotency and duplicate webhook handling
-   Amount, currency, and order-ownership verification
-   Refunds, failed payments, and reconciliation
-   Development/mock payment routes disabled in production
-   Audit trails and admin actions

### Multi-user correctness

-   Concurrent requests
-   Duplicate uploads and jobs
-   Chat-history ownership
-   Pagination and bounded queries
-   MongoDB indexes and unique constraints
-   Race conditions
-   Transaction/session support

### Reliability and scale

-   Request timeouts and error handling
-   Background queues and workers
-   CPU/RAM protection for PDF/OCR work
-   Retry/backoff and dead-letter handling
-   Caching, bounded retrieval, and database-query efficiency
-   Structured logs, metrics, and error monitoring
-   Health/readiness checks
-   Backup/restore and migration strategy
-   Load tests with explicit workload and measurements

### Deployment and quality

-   Docker Compose consistency
-   Environment-variable validation
-   CI must fail when tests/build fail
-   Unit, integration, and end-to-end tests
-   Staging smoke tests
-   Dependency and vulnerability scans
-   Graceful shutdown
-   Rollback strategy

## 5. Required evidence format for every finding

Report each finding using this format:

-   **ID / Title**
-   **Severity:** Critical / High / Medium / Low / Informational
-   **Status:** Confirmed / Likely / Not reproduced / False positive /
    Needs runtime verification
-   **Evidence:** exact file path and line number, or a short code
    excerpt
-   **Impact:** what could happen and under which preconditions
-   **Reproduction:** safe local steps only; no destructive or paid
    external operations
-   **Root cause**
-   **Recommended fix**
-   **Regression test**
-   **Confidence:** High / Medium / Low

Do not label a route exploitable just because route-level middleware is
not visible. Check global middleware, network boundaries, and runtime
behavior. Likewise, do not call a race condition confirmed without
code-level proof or a concurrency test.

## 6. Rules of engagement

1.  Inspect repository structure, package scripts, routes, middleware,
    models, services, deployment files, and tests first.
2.  Never expose `.env` contents, API keys, payment secrets, tokens, or
    private user data.
3.  Do not edit application code during the initial audit.
4.  Clearly distinguish evidence from assumptions and uncertainty.
5.  Run safe local tests where possible; explain why any test could not
    run.
6.  Never make real payment-provider charges or mutate production data.
7.  Present findings and priorities before proposing code changes.
8.  After approval, make small changes, add regression tests, and review
    the diff.
9.  Do not claim "all bugs fixed," "secure," or "supports 10,000
    concurrent users" without sufficient evidence.
10. Update `PROJECT_CONTEXT.md`, `AUDIT_REPORT.md`, and, when useful,
    `FIX_PLAN.md`.

------------------------------------------------------------------------

# Prompt 1 --- Understand the project and create its context document

Copy and paste this prompt first, with the project ZIP/repository
available:

``` text
You are a senior full-stack engineer and security-minded code auditor.
Review the entire StudyTogether WebApp repository, not just README claims.

First inspect the repository structure, package scripts, frontend, backend,
AI service, models, routes, middleware, external integrations, tests and
deployment configuration. Do not modify application code in this first pass.

Create or update PROJECT_CONTEXT.md with:
1. What the product does and its user roles.
2. Architecture and service-to-service data flow.
3. Main routes/features and important files.
4. Database models, relationships, indexes and data ownership.
5. Authentication, authorization and session/token flow.
6. Coin economy and payment lifecycle.
7. PDF upload/storage/access lifecycle.
8. AI ingestion, retrieval, chat and user-data isolation.
9. Environment variables by name only; never include secret values.
10. How to run locally, test and deploy, including missing prerequisites.
11. Known uncertainties, technical debt and missing tests.
12. A Mermaid architecture diagram if useful.

For every important claim, cite exact repository file paths and line numbers.
Separate verified facts from assumptions. Do not invent functionality.
Do not print secrets. Do not change application code.

At the end, list which folders/files you actually inspected and what you
could not verify. If a file cannot be read or a command cannot run, say so.
The only files you may create/update in this pass are documentation files
such as PROJECT_CONTEXT.md. Do not change application source, config,
dependencies, lockfiles, database data, or runtime behavior.
```

## After Prompt 1

Review `PROJECT_CONTEXT.md`. Check that it cites actual files and does
not merely repeat README claims. If it is incomplete, ask the AI to
correct the documentation only. Do not proceed to fixes yet.

------------------------------------------------------------------------

# Prompt 2 --- Verify the earlier findings and audit production readiness

Run this only after the project context document has been
created/reviewed:

``` text
Act as a senior application-security engineer and production-readiness auditor.
Use the repository currently available in this workspace. Read PROJECT_CONTEXT.md
if it exists, but verify every claim against the current source code.

IMPORTANT:
- Audit first; do not edit application code in this pass.
- Do not trust previous audit statements without checking them.
- Do not expose secrets or perform real payments.
- Do not claim a runtime exploit unless you safely reproduce it or provide
  clear code-level proof and state the relevant assumptions.
- Inspect global middleware, reverse proxies, deployment boundaries and
  all call sites before declaring an endpoint unprotected.

Verify these hypotheses:

A. AI service endpoints:
   Inspect ai/server.js routes for /api/v1/internal/ai/process, /reprocess
   and /knowledge/:paperId. Confirm exact methods, router order, global
   middleware, service authentication, network exposure, and whether
   unauthorized requests can trigger processing or deletion.

B. Coin purchase:
   Compare server/routes/coin.js /coins/purchase with
   server/routes/payment.routes.js and the Razorpay flow. Determine whether
   any production-reachable route can credit coins without verified payment.
   Check client-controlled amount/coin values, user identity, webhook
   signature, order ownership, idempotency, and environment guards.

C. Docker/deployment:
   Check docker-compose.yml MongoDB service ports and database URI,
   service names, health checks, AI service availability, environment-variable
   consistency, and clean-start behavior. Do not print secret values.

D. Coin and payment consistency:
   Inspect server/utils/coinManager.js and all callers, balance updates,
   transaction creation, payment webhooks, refunds and duplicate events.
   Check atomicity, MongoDB sessions/transactions, conditional updates,
   unique constraints, and concurrent requests.

E. PDF access/paywall:
   Inspect paper routes/controllers, preview/download flows, response fields,
   ownership/approval/purchase checks, and Cloudinary URL configuration.
   Test whether changing IDs or using direct URLs can expose content that
   policy says should be private/paid. Distinguish public approved papers
   from paid/private papers.

F. AI ingestion/retrieval capacity:
   Inspect ai/services/vectorSearch.js, ai/services/ingestor.js and callers.
   Report query bounds, chunk limits, file/page limits, synchronous versus
   background work, OCR concurrency, timeouts, retry behavior, and likely
   memory/CPU bottlenecks. Do not make unsupported throughput claims.

G. Test/CI reliability:
   Inspect every package.json and CI workflow. Verify whether failed tests
   can still pass CI, which scripts actually exist, and whether build/test
   commands can be run safely.

Also audit:
- IDOR/BOLA and user-to-user data isolation
- Admin authorization
- Rate limits and input/file validation
- Secrets handling and error/log leakage
- Authentication/session/token lifecycle
- Database indexes, pagination, and N+1/unbounded queries
- Duplicate uploads/jobs and race conditions
- AI prompt injection/data leakage risks
- Production configuration, health checks, and backups

For each finding report:
ID, title, severity, status (Confirmed/Likely/Not reproduced/False positive/
Needs runtime verification), exact file path + line numbers, evidence,
preconditions, impact, safe reproduction steps, root cause, recommended fix,
and a regression test.

Run only safe local checks that are available. List commands run and their
actual outcomes. Do not run destructive operations or real external payments.
If MongoDB/Cloudinary/Razorpay/Ollama or other services are unavailable,
clearly mark related runtime checks as unverified.

Prioritize P0/P1/P2/P3, then give a fix plan ordered by risk and dependencies.
Do not modify application code until I approve the report.

Create or update AUDIT_REPORT.md with evidence, caveats, actual test results,
and a short executive summary. You may create/update FIX_PLAN.md as a
proposal, but do not implement fixes. Never claim the project is fully secure
or production-ready without sufficient evidence.

Only documentation files may be created or updated in this pass. Do not
change application source, configuration, dependencies, lockfiles, database
data, or runtime behavior.
```

## After Prompt 2

Read `AUDIT_REPORT.md`. Check each finding's evidence and status. False
positives must be recorded as false positives. Findings that require
unavailable external services must remain unverified. Do not let the AI
silently convert assumptions into confirmed bugs.

------------------------------------------------------------------------

# Prompt 3 --- Fix only approved findings

Use this only after you have reviewed and explicitly approved the audit
report and fix plan:

``` text
Use the approved AUDIT_REPORT.md and FIX_PLAN.md. Fix only the findings
I have approved, one logical change at a time.

Before each change:
1. Explain the root cause and intended behavior.
2. Identify impacted files and backward-compatibility risks.
3. State the regression test that will verify the fix.

During each change:
- Implement the smallest robust fix.
- Add a regression test that fails before the fix and passes after it.
- Preserve existing behavior unless the approved plan says otherwise.
- Use atomic/idempotent operations for money-related flows where appropriate.
- Never put secrets in source code or logs.
- Do not disable security controls just to make tests pass.
- Do not change unrelated features or refactor unrelated code.

After each change:
- Run relevant tests, lint, and build commands where available.
- Show exact command outcomes and remaining failures.
- Review the diff for unintended changes.
- Update AUDIT_REPORT.md and FIX_PLAN.md with status.
- Clearly separate tests that passed from tests that could not run.

Do not claim a fix is verified if its test could not run. Do not perform real
payments or modify production data. Stop and report if the fix requires a
design decision or an unapproved scope change.

Before finishing, summarize files changed, tests run, test results, remaining
risks, and how to roll back. Do not claim the entire project is bug-free or
production-ready without sufficient evidence.
```

## 7. Recommended documentation files

-   `PROJECT_CONTEXT.md` --- verified architecture and project knowledge
-   `AUDIT_REPORT.md` --- findings, evidence, severity, and test
    outcomes
-   `FIX_PLAN.md` --- approved fix sequence, dependencies, and status

This handoff preserves context across future sessions, but the next
session must still compare the documentation with the current repository
and verify all important claims.
