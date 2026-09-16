# Recovery savepoint — 16 September 2026

Updated: **14:08 UTC / 18:08 Asia/Dubai**. This continuation record includes activated cloud monitoring, the 15-minute response heartbeat, and the scaling-configuration review.

## Current state

The latest instruction is **"make sure its scalable and on call , website and sub websites all work"**. This resumes operational work after the requested closure. The tested monitoring expansion is now published on work-fork `main`; the existing incident-response heartbeat is ACTIVE every 15 minutes. All six sites and the AI/database dependencies passed a full cloud run. No new application deployment, credential change, database mutation, paid upgrade or customer message occurred during this monitoring activation. The previous project tabs remain closed.

The overall objective remains a functional main launcher and five independently deployed sub-apps. Known feature/auth dependencies remain open. Do not claim 100% functionality, unlimited capacity, a staffed on-call service or guaranteed uptime.

Code is committed on `codex/deferred-workplace-repairs`, implementation commit `d516c4a`, previous savepoint commit `44bdfaa`; this document is committed in its successor. Monitor work is published on `codex/site-uptime-monitor` and work-fork `main` at `d8a0795`, and merged into the saved repair branch without deploying pending application code. The permanent checkout is `/Users/aldo-m5/Documents/digitalworkplace-ai`; the working recovery checkout is `/private/tmp/digitalworkplace-recovery-20260916`. Neither environment files nor credentials belong in Git. The previous recovery baseline `f478e8e` remains on `codex/restore-multi-app-ai`.

## Live inventory and latest evidence

Latest full cloud evidence: **14:00:37–14:00:40 UTC / 18:00 Dubai**, all **25 site/auth/AI/database probes passed** in [run 35105590721](https://github.com/aldrinatc/digitalworkplace.ai/actions/runs/35105590721). A subsequent health-only dispatch [35106177495](https://github.com/aldrinatc/digitalworkplace.ai/actions/runs/35106177495) also passed. The preceding local run passed at 13:59:35 UTC.

At **13:45:23 UTC / 17:45:23 Dubai**, all **19 public-site/auth probes passed on their first attempt** (six page checks, Clerk signing-key discovery, two main protection checks, and ten anonymous/invalid-token API checks). See [the auth verification record](2026-09-16-auth-verification.md). Existing signed-in main, Support and Chat Core sessions also survived reload during this review. Main admin read access rendered, but the console reported profile-update failures; the pending main repair is still necessary. Fresh login and new-account provisioning are not certified.

At approximately **13:21 UTC / 17:21 Dubai**, all six site entry points were also verified available. Main was freshly reloaded in the existing signed-in browser session and rendered all five product cards. Main sign-in and Support/Intranet/Chat Core/Test Pilot entry pages returned HTTP 200 with expected titles and no detected server error page. GRC rendered its dashboard in the browser; see its cookie/redirect behavior below.

| App | Canonical entry point | Vercel project | Last recorded deployed repair |
| --- | --- | --- | --- |
| Main | https://www.digitalworkplace.ai/dashboard | digitalworkplace-ai | Existing live release; pending server repair NOT deployed |
| Support | https://dsq.digitalworkplace.ai/dsq/demo/cor | support-iq | `dpl_9yUKQyj19V5t2Pur95P4dxVkqNby` |
| Intranet | https://diq.digitalworkplace.ai/diq/dashboard | intranet-iq | Earlier AI/provider and route-prefix recovery; healthy in latest check |
| Chat Core | https://dcq.digitalworkplace.ai/dcq/Home/index.html | chat-core-iq | `dpl_62kinqrtgx2eP5rGSSpmcBrSHJHc` |
| Test Pilot | https://dtq.digitalworkplace.ai/dtq/dashboard | test-iq | `dpl_GMdq5LWkR1ZGaop5qbwpirsL6dfP` |
| GRC | https://auctorgrc.vercel.app | auctorgrc | Existing `dpl_6JvrXimxyBK2NJycBxvLDkbbk6zv`; no source changes |

All **six dependency checks passed**: four AI readiness endpoints at `/{diq,dsq,dcq,dtq}/api/health/ai`, Chat Core `/dcq/api/health/database`, and Support `/dsq/api/health`. AI health reported gateway and funding available. These probes do not perform generation and do not certify all workflows. No production app was changed during these final availability/monitoring checks.

The main protected dashboard returns 404 to a cookieless script; use `/sign-in` for public uptime and a signed-in browser for dashboard verification. Canonical work-owner sign-in and existing access were verified. New-user provisioning has the separate limitation below.

## Monitoring: actual state versus planned work

### ACTIVE 15-minute Codex incident-response heartbeat

- Name: **Digital Workplace uptime and repairs**; ID `digital-workplace-uptime-and-repairs`; attached to the current task.
- Configuration: `/Users/aldo-m5/.codex/automations/digital-workplace-uptime-and-repairs/automation.toml`.
- Interval changed from hourly to 15 minutes; ACTIVE status and saved interval verified.
- Checks site/auth/AI/database readiness and the cloud monitor's production-health job. Missing successful cloud health evidence for more than 45 minutes is a monitoring fault to investigate.
- Confirms apparent failures, performs authorized targeted reversible incident repairs, tests/deploys only the affected existing app, and verifies recovery. No unrelated feature deployment when health is unchanged.
- Notifications remain quiet for unchanged state; notify on a meaningful failure/degradation, completed repair, monitor fault, changed blocker or required user action. Do not repeat unchanged approval requests.
- Preserve authentication/data, least privilege, approved spending and pending credential/data-flow approvals. No real customer messages/bookings or new credentials. EIDS is unrelated.
- Registration is verified; a first automatic heartbeat execution has not yet been observed. It depends on host/scheduler availability and is not a staffed 24-hour response service.

### ACTIVE expanded GitHub cloud monitor

- Repository: `aldrinatc/digitalworkplace.ai`, PUBLIC, default branch `main`.
- Workflow: `.github/workflows/ai-reliability.yml`, ID `359513081`, API state **active**. Explicitly enabled after publishing the expansion.
- Published monitor/runbook commit: **`d8a0795`** on work-fork `main` and `codex/site-uptime-monitor`.
- Schedule: every 15 minutes, at UTC minute 2, 17, 32 and 47. Unlike the earlier savepoint, the expansion is now on the default branch.
- Coverage: six page checks, public Clerk signing-key discovery, two protected main-route checks, ten anonymous/invalid-token sub-app API checks, four AI readiness checks, and two database checks: **25 total**.
- First expanded manual cloud run **35105590721** passed production health, regression and durable-workflow tests. Health artifact creation succeeded.
- Subsequent health-only manual dispatch **35106177495** passed production health; regression/durable jobs were correctly skipped. Push/PR events retain those tests.
- **Automatic schedule execution is still pending verification:** the latest schedule-event query returned no runs. Enabled/default-branch configuration plus a successful dispatch is not evidence of an automatic scheduled run. The heartbeat now checks this gap independently and will flag stale monitoring.
- Site/auth probes use four concurrent workers, a 20-second timeout, one retry, bounded same-origin redirects, and no saved user credentials. GRC's public demo cookie stays in memory. Main's 404 passes only with Clerk denial headers; protected APIs must return JSON 401. Ten focused tests passed.
- The job has an eight-minute maximum and retains fixed-field health evidence for seven days. GitHub notification delivery depends on existing account settings and has not been tested. No new external paging service was configured.
- Worktree: `/private/tmp/dwp-uptime-monitor-20260916`; its work is now also merged into the saved repair branch/permanent checkout. Do not push the deferred application branch to work-fork `main` just to update monitoring.

### Scaling safeguards and limits

Read-only Vercel API review confirmed the Pro work team and all six existing Next.js projects, each with Node 24, Fluid Compute, elastic concurrency and `iad1` function region. Chat Core's correct project name is **`chat-core-iq`**, ID `prj_xHsmvgobAhiyy4mukWcUDBl4aCK1`.

Support and Chat Core's existing local deployment settings use the Supabase transaction pooler, a connection limit of two and ten-second pool wait. Chat Core additionally bounds connect/idle/query timeouts. AI transport bounds request timeouts and disables SDK retry multiplication. Durable database-backed workflow state was previously deployed and its cloud tests remain green.

A read-only aggregate snapshot through the existing least-privileged app role at approximately 14:07 UTC returned **60 configured database connections, 12 observed database backends, and 52,243,603 database bytes**. This is a point-in-time observation that includes shared/provider connections, not a safe concurrent-user limit or guaranteed spare capacity. No stress test or hosting/database upgrade was performed. Shared Clerk, Supabase and gateway limits still apply; the approved $50/month gateway auto-refill cap remains unchanged.

See [the production operations runbook](../operations/production-on-call.md) for incident steps, verified safeguards, evidence limits and outstanding dependencies.

## Safe resume order

1. Read this file; check current branch/dirty files and current deployment health. Preserve unrelated user changes.
2. Address the main server credential dependency when specifically approved, then validate and deploy that repair independently; this is the outstanding auth repair.
3. Verify an actual automatic schedule-event cloud run and heartbeat execution. The expansion is already activated; do not create a duplicate monitor. Preserve pending application repairs while maintaining monitoring.
4. Repair Intranet search and knowledge retrieval end to end, verify Test Pilot's deployed browser workflow, and complete other available source-backed fixes.
5. For Zoho delivery, GRC source access and other external dependencies, record the exact missing access rather than fabricate success or repeatedly request unchanged approvals.
6. Record per-app test evidence, release IDs and rollback targets. Do not roll back a security migration to an unsafe permissive policy or deploy the whole pending branch indiscriminately.

The original "I don't need auth app" comment concerned Vercel authenticator enrollment, not removing Clerk product authentication. Keep Clerk protections.

## Source and delivery map

- Active repair branch: `codex/deferred-workplace-repairs` in the permanent/recovery checkouts, backed up to the ATC work fork.
- Upstream monorepo: `aldrinstellus/digitalworkplace.ai`, recovery PR https://github.com/aldrinstellus/digitalworkplace.ai/pull/1. Work account cannot directly merge upstream.
- Support submodule: `apps/support-iq`, repair branch `codex/restore-ai-gateway`, commit `0137117`; work fork `aldrinatc/support-iq`; upstream PR https://github.com/aldrinstellus/support-iq/pull/2.
- GRC full source: private `aldrinstellus/auctor`, recorded commit `d9a89910321f2dc8b9789db1c34ce15d373fd2bd`; inaccessible to the work GitHub identity. Vercel deployment-file-tree retrieval returned 404. The local EIDS Auctor snapshot is a design reference only.
- Accounts: work identity `aldrin@atc.xyz`; preserve existing technical project/repository handles; do not use personal credentials as fallback.
- No dev server is intentionally running. No credentials, cookies or environment files are included in this savepoint.

## What changed since the earlier handoff

**Test Pilot repair is live.** Vercel project `test-iq`, deployment `dpl_GMdq5LWkR1ZGaop5qbwpirsL6dfP`, READY and aliased to https://dtq.digitalworkplace.ai. Deployment URL: https://test-dsy95h9i2-aldos-projects-8cf34b67.vercel.app.

The release includes simulation queue/schedule controls, browser-persisted execution reports and persona, and accurate demo/simulation labels. It remains the existing demo execution engine, not a real external test runner.

- Seventeen main/history regression tests passed (14 main, 3 Test Pilot).
- Test Pilot production build passed.
- Full main lint: zero errors, 22 warnings. Full Test Pilot lint: zero errors, 8 warnings. Targeted changed-file lint passed.
- Locally, a future scheduled simulation saved and survived reloading with the Tech Lead persona restored. The earlier rejected date was a browser automation field-entry problem: native date-field `setValue` worked. No scheduling source change was needed in this resumed phase.
- The synthetic future schedule was removed after verification. The local dev server was stopped.
- Earlier local queued execution and report persistence checks passed.
- After deployment, Test Pilot dashboard, history, reports and AI health returned HTTP 200; dashboard HTML contained the new demo label, and health reported gateway/funding available. Main sign-in returned HTTP 200.
- Production browser execution of the newly deployed queue/schedule workflow remains to be checked; local verification plus production page/readiness checks are not that test.

Other app releases and credentials were unchanged during this resumed phase. Main's build passed in the preceding phase, but its repaired server routes are still undeployed.

## Main app: highest-priority next step

The prepared main repair moves verified user synchronization, role administration and analytics tracking onto server-only Supabase access, with ownership and authorization checks. **It must not be deployed before the required server credential is configured.**

Migration `021_users_server_writes.sql` was already applied to production in the earlier phase. It closes unrestricted anonymous user insertion and revokes browser-role writes to `public.users`. Existing user records/roles were preserved, but new-account provisioning and browser-based administration remain limited until the server repair is activated. Do not revert to the unsafe caller-selected-role insert policy.

Specific approval was requested for both of these activations and remains **unanswered**:

1. Store the existing Supabase service key only in the main app's Vercel server environment.
2. Route search queries and indexed knowledge-base text through Vercel AI Gateway to OpenAI `text-embedding-3-small`, within the existing $50/month gateway auto-reload cap.

The latest read-only Vercel production environment listing confirmed that the main project still has no `SUPABASE_SERVICE_ROLE_KEY`. No service key was copied/configured and the embedding opt-in remains disabled. Do not treat the pause or elapsed time as approval. A Supabase project dashboard tab was opened read-only during this phase; there were no new SQL changes.

After authorized activation: deploy main, verify existing-user sync, new-user provisioning without role escalation, admin persisted updates, session/page tracking and analytics; add main database health to monitoring only after it is live and healthy.

## Intranet finding: diagnosed, no code change yet

Live POST `/diq/api/search` was tested with synthetic keyword and hybrid requests. Both returned HTTP 200, three stored results and an AI summary. Hybrid fell back to keyword. The API incorrectly reports `embeddingsEnabled: true` even when fallback is used.

The frontend `/diq/search` does **not** call this working search API. Its `search` callback filters five bundled `mockSearchResults` and bundled integration data. Search-mode and pagination arguments are ignored. Connecting the UI to the API was announced but **not implemented before the pause**.

Relevant code:

- `apps/intranet-iq/src/app/search/page.tsx`: mock callback around line 349; pagination can append duplicate records; AI summary error handling fabricates a fallback summary; result cards have no open handler.
- `apps/intranet-iq/src/app/api/search/route.ts`: live keyword retrieval works; validate inputs, truthful embedding status and pagination before wiring the UI. Hybrid RPC arguments appear inconsistent with the old checked-in SQL; verify current database metadata before changing them.
- `apps/intranet-iq/src/app/content/[id]/page.tsx`: only loads bundled numeric-ID sample articles. Actual database UUID results need a real article read path before linking. Its current HTML renderer is unsanitized; sanitize stored content before introducing live records.
- No existing `api/content/[id]` route was found. The knowledge page's delete action points there and cannot persist deletion. The knowledge tree itself uses mock categories/articles.
- `api-auth.ts` has a legacy origin/referer-based admin check and a demo-mode gate. Authentication integration needs review before enabling additional privileged writes; do not weaken protections to make buttons appear successful.

Preserve the established design and distinguish intentionally simulated integration content from actual knowledge-base records.

## Other remaining dependencies

- Support draft persistence and access checks were deployed earlier. Customer email delivery lacks complete Zoho Desk sender credentials. The send route uses a static access token; a separate refresh-capable client exists but uses a comments endpoint, so it is not a drop-in email-delivery replacement. No customer message was sent.
- GRC's dashboard and synthetic assistant check passed earlier, and a cached sample analysis rendered. Fresh vision analysis and completed PDF export are unverified. The work GitHub account cannot access full `aldrinstellus/auctor` source; the EIDS design snapshot is incomplete and must not be deployed as the app.
- Existing CRM, telephony, calendar and other demo integrations are not certified live connectors.
- Separate Vercel projects still share backend services. Do not claim full infrastructure isolation or guaranteed uninterrupted service.

## Operational references

- Earlier deployed repairs and six-endpoint monitoring: `docs/incidents/2026-09-16-recovery.md`.
- Previous live handoff and migration details: `docs/incidents/2026-09-16-live-handoff.md`; this savepoint supersedes its statement that Test Pilot repair is undeployed.
- Gateway billing remains approved/configured: $5 trigger, $25 target, $50/month automatic refill cap (not an all-services spending cap).
- Canonical work identity: `aldrin@atc.xyz`; GitHub/Vercel technical handle `aldrinatc`; Vercel team `aldos-projects-8cf34b67`; Supabase project `fhtempgkltrazrgbedrh`.
- Deployment log: `/private/tmp/dwp-testpilot-resumed-deploy.log`; build log: `/private/tmp/dwp-testpilot-resumed-build.log`.
- Latest work activated the cloud monitor, updated the existing response heartbeat to 15 minutes, verified cloud results and reviewed capacity settings. No application deployment, database mutation, credential change, paid upgrade or customer message occurred. Project tabs remain closed and no dev server was started. Production deployments remain live.
