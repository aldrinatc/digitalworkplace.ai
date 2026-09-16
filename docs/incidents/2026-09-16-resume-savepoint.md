# Recovery savepoint — 16 September 2026

## Stop state

The latest instruction is **"Savepoint for now"**. Work is paused. The overall objective remains to make the main app and five sub-apps functional according to their intended scope, retaining digitalworkplace.ai as the main launcher and each sub-app's independent deployment. Do not claim 100% completion; unresolved dependencies and unverified workflows remain.

Code is committed on `codex/deferred-workplace-repairs`, implementation commit `d516c4a`. The permanent checkout is `/Users/aldo-m5/Documents/digitalworkplace-ai`; the working recovery checkout is `/private/tmp/digitalworkplace-recovery-20260916`. Neither environment files nor credentials belong in Git. The previous recovery baseline `f478e8e` remains on `codex/restore-multi-app-ai`.

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

No service key was copied/configured and the embedding opt-in remains disabled. Do not treat the pause or elapsed time as approval. A Supabase project dashboard tab was opened read-only during this phase; there were no new SQL changes.

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
- Latest work was a local Test Pilot verification/deployment and read-only diagnosis. No dev server is intentionally left running.
