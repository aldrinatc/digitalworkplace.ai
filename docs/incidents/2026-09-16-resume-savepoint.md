# Recovery savepoint — 16 September 2026

Updated: **13:48 UTC / 17:48 Asia/Dubai**. This is the comprehensive continuation record, including the latest auth checks and the requested savepoint/closure.

## Stop state

The latest instruction is **"Do Savepoint and close all to make sure it’s workable"**, following a request to verify production, especially auth. Foreground implementation is paused again. All five open Digital Workplace browser tabs were closed; no project development server was started in this review. The existing hourly uptime heartbeat remains ACTIVE, but its prompt now explicitly pauses feature work and publication of pending repairs while availability is healthy. The overall objective remains to make the main app and five sub-apps functional according to their intended scope, retaining digitalworkplace.ai as the main launcher and each sub-app's independent deployment. Do not claim 100% completion or guaranteed uptime; unresolved dependencies and unverified workflows remain.

Code is committed on `codex/deferred-workplace-repairs`, implementation commit `d516c4a`, previous comprehensive savepoint commit `dae96ce`; this document is committed in its successor. Separate unpublished monitor work is backed up on `codex/site-uptime-monitor` at `e71950f`. The permanent checkout is `/Users/aldo-m5/Documents/digitalworkplace-ai`; the working recovery checkout is `/private/tmp/digitalworkplace-recovery-20260916`. Neither environment files nor credentials belong in Git. The previous recovery baseline `f478e8e` remains on `codex/restore-multi-app-ai`.

## Live inventory and latest evidence

Latest: **13:45:23 UTC / 17:45:23 Dubai**, all **19 public-site/auth probes passed on their first attempt** (six page checks, Clerk signing-key discovery, two main protection checks, and ten anonymous/invalid-token API checks). See [the auth verification record](2026-09-16-auth-verification.md). Existing signed-in main, Support and Chat Core sessions also survived reload during this review. Main admin read access rendered, but the console reported profile-update failures; the pending main repair is still necessary. Fresh login and new-account provisioning are not certified.

At approximately **13:21 UTC / 17:21 Dubai**, all six site entry points were also verified available. Main was freshly reloaded in the existing signed-in browser session and rendered all five product cards. Main sign-in and Support/Intranet/Chat Core/Test Pilot entry pages returned HTTP 200 with expected titles and no detected server error page. GRC rendered its dashboard in the browser; see its cookie/redirect behavior below.

| App | Canonical entry point | Vercel project | Last recorded deployed repair |
| --- | --- | --- | --- |
| Main | https://www.digitalworkplace.ai/dashboard | digitalworkplace-ai | Existing live release; pending server repair NOT deployed |
| Support | https://dsq.digitalworkplace.ai/dsq/demo/cor | support-iq | `dpl_9yUKQyj19V5t2Pur95P4dxVkqNby` |
| Intranet | https://diq.digitalworkplace.ai/diq/dashboard | intranet-iq | Earlier AI/provider and route-prefix recovery; healthy in latest check |
| Chat Core | https://dcq.digitalworkplace.ai/dcq/Home/index.html | chat-core | `dpl_62kinqrtgx2eP5rGSSpmcBrSHJHc` |
| Test Pilot | https://dtq.digitalworkplace.ai/dtq/dashboard | test-iq | `dpl_GMdq5LWkR1ZGaop5qbwpirsL6dfP` |
| GRC | https://auctorgrc.vercel.app | auctorgrc | Existing `dpl_6JvrXimxyBK2NJycBxvLDkbbk6zv`; no source changes |

All **six dependency checks passed**: four AI readiness endpoints at `/{diq,dsq,dcq,dtq}/api/health/ai`, Chat Core `/dcq/api/health/database`, and Support `/dsq/api/health`. AI health reported gateway and funding available. These probes do not perform generation and do not certify all workflows. No production app was changed during these final availability/monitoring checks.

The main protected dashboard returns 404 to a cookieless script; use `/sign-in` for public uptime and a signed-in browser for dashboard verification. Canonical work-owner sign-in and existing access were verified. New-user provisioning has the separate limitation below.

## Monitoring: actual state versus planned work

### ACTIVE hourly Codex heartbeat

- Name: **Digital Workplace uptime and repairs**.
- Automation ID: `digital-workplace-uptime-and-repairs`.
- Kind: heartbeat attached to this task; hourly; status ACTIVE, confirmed by its saved configuration and automation view.
- Configuration: `/Users/aldo-m5/.codex/automations/digital-workplace-uptime-and-repairs/automation.toml`.
- Scope: verify sites/dependencies, confirm apparent outages, diagnose and make targeted reversible repairs within existing authorization, test/deploy only the affected app, and maintain a secret-free savepoint. Updated at closure: remain paused when availability is healthy; do not resume features or publish pending monitoring/repair work without user resumption.
- Notifications: remain quiet for unchanged/non-actionable state; report meaningful outages, degradation, completed repairs, changed blockers or required input. Do not repeatedly ask about the same pending dependency.
- Guardrails: preserve authentication/data, existing hosting projects, spending cap and pending credential/data-flow approvals; no real customer messages or bookings. Do not edit EIDS, whose directory is merely the task's unrelated current working directory.
- Registration is verified; no first heartbeat execution has yet been observed. Do not treat this local app automation as continuously running cloud remediation or promise it runs regardless of host/scheduler availability.

### Existing GitHub cloud workflow

- Work repository: `aldrinatc/digitalworkplace.ai`, PUBLIC, default branch `main`.
- Workflow: `.github/workflows/ai-reliability.yml`, ID `359513081`, API state **active**.
- Current frequency: hourly. Current production probes: four AI + two database checks. Main and GRC page checks are not yet part of this script.
- Earlier manual production health run `35091260998` passed. Recent push regression run `35096829446` passed (created 12:36:38 UTC).
- **Automatic scheduling is not yet proven:** querying this workflow's latest `schedule` runs at this savepoint returned an empty list. Investigate GitHub scheduling/registration before claiming an operational scheduled cloud monitor. Enabled configuration is not execution evidence.
- The current script is `scripts/check-ai-health.mjs`. GitHub failure notifications use existing account preferences; delivery has not been independently tested. No new external messaging integration was configured.

### Prepared cloud-monitor expansion — tested, NOT activated

The isolated worktree `/private/tmp/dwp-uptime-monitor-20260916`, branch **`codex/site-uptime-monitor`**, now contains committed work at **`e71950f`**, backed up to `aldrinatc/digitalworkplace.ai` on that branch. It remains separate from both work-fork `main` and the deferred application repair branch. The earlier failed patch changed nothing, but implementation was completed during the subsequent auth-verification review.

- Added `scripts/site-auth-health.mjs`, `scripts/check-site-auth-health.mjs`, and `scripts/site-auth-health.test.mjs`.
- Six page checks, public Clerk key discovery, two protected main routes, and five protected sub-app APIs tested anonymously and with an invalid token: **19 probes**. Existing AI/database script adds six checks.
- Requests use bounded concurrency (four), a 20-second timeout and one retry. Main's cookieless 404 counts as protected only with Clerk's denial headers. API checks require JSON 401, not a generic page. GRC's public demo cookie stays in memory and on the same origin; redirects are bounded.
- Ten focused tests passed; all 19 production probes passed on the first attempt at 13:45:23 UTC. Only fixed result fields are logged; no cookies, credentials or response bodies are retained.
- Prepared workflow runs the probes with failure-preserving Bash pipelines, retains result artifacts for seven days, and proposes a 15-minute schedule. **That schedule is NOT active on the default branch.** It was not manually dispatched or observed as a scheduled cloud run before the user requested closure. A backup-branch push can run ordinary CI but does not install the default-branch schedule.
- To activate after user resumption, apply only these monitor files to work-fork `main`, preserve any later regression-test additions, run/inspect the cloud job, and verify an actual scheduled execution. Do not merge or deploy pending application code as a shortcut.
- Main Vercel Git linkage was verified as upstream `aldrinstellus/digitalworkplace.ai`, not the work fork.

## Safe resume order

1. Read this file; check current branch/dirty files and current deployment health. Preserve unrelated user changes.
2. Respect the closure pause. On user resumption, address the main server credential dependency when specifically approved, then validate and deploy that repair independently; this is the outstanding auth repair.
3. Activate the prepared monitoring expansion separately if resumed, and obtain evidence of automatic cloud execution without deploying application code.
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
- Latest work was read-only production/auth verification, local monitor preparation and savepoint/cleanup. No application deployment, database change, credential change or customer message occurred in this review. All project browser tabs were closed; no dev server was started. Production deployments and the existing monitor remain running.
