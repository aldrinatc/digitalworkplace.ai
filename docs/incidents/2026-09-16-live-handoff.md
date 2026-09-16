# Live suite handoff — 16 September 2026

## Current instruction

Keep `digitalworkplace.ai` as the main launcher and the five sub-apps on their existing independent Vercel projects. Defer further diagnosis, feature work and releases. No new app deployment was made during this final availability check. Unfinished main/Test Pilot changes are saved on a separate local branch and must not be promoted as a verified release.

## Live entry points

| App | Existing Vercel project | Entry point | Latest check |
| --- | --- | --- | --- |
| Main | digitalworkplace-ai | https://www.digitalworkplace.ai/dashboard | Reloaded successfully in the existing Clerk session; all five launch cards present |
| Support IQ | support-iq | https://dsq.digitalworkplace.ai/dsq/demo/cor | HTTP 200; AI and database health healthy |
| Intranet IQ | intranet-iq | https://diq.digitalworkplace.ai/diq/dashboard | HTTP 200; AI health healthy |
| Chat Core IQ | chat-core | https://dcq.digitalworkplace.ai/dcq/Home/index.html | HTTP 200; AI and database health healthy |
| Test Pilot IQ | test-iq | https://dtq.digitalworkplace.ai/dtq/dashboard | HTTP 200; AI health healthy |
| GRC IQ | auctorgrc | https://auctorgrc.vercel.app | Dashboard rendered in browser |

An unauthenticated Node request to the protected main dashboard returned 404; a fresh signed-in browser load succeeded. A Node request to GRC failed with a transport error; the browser loaded its dashboard successfully. Availability does not certify every workflow.

Separate deployments already exist. The suite still shares Clerk, Supabase and AI billing where configured; this is not complete infrastructure isolation. No DNS, project ownership, database split or authentication migration was performed. Existing hourly health monitoring and the approved $25 gateway target / $5 trigger / $50 monthly auto-reload cap remain in place.

## Production database change requiring follow-up

Migration `021_users_server_writes.sql` **has already been applied to production**, although the accompanying main-app server repair is **not deployed**. It restricts the previously unrestricted `public.users` insert policy to `service_role` and revokes browser-role INSERT/UPDATE/DELETE. Verified `anon` INSERT and `authenticated` UPDATE privileges are false. Existing user records and assigned roles were not changed.

**New-account provisioning and browser-based administration remain limited until the server-backed main repair is activated.** Existing owner access and the launcher were verified. Do not restore the permissive insert policy: it allowed callers to choose privileged roles. The main repair requires the existing Supabase service key in a server-only Vercel environment variable; specific approval remains pending and no key was copied or configured.

## Deferred local work

The live recovery baseline is commit `f478e8e` (Support submodule `0137117`). The deferred branch contains:

- Main: verified Clerk identity synchronization, server-only user/role administration, ownership-checked analytics tracking, database health and visible error states. Fourteen regression tests, targeted lint/typecheck and the main production build passed. No rollout without the required server credential and a fresh end-to-end check.
- Test Pilot: explicit simulation labels, browser-persisted reports/persona, queue and schedule controls. Three history tests passed. A queued synthetic run and report persistence were verified locally. Schedule persistence did not complete verification; final lint/build and scheduling checks remain outstanding. This is still a demo engine, not real external test execution.
- CI: adds the prepared main/history regression tests. This workflow change is local only.

The local Test Pilot development server was stopped. No real booking, customer email, CRM action or external notification was performed.

## Remaining service limits

- Intranet keyword retrieval works; the separately proposed Vercel/OpenAI embedding route remains disabled pending approval. The original direct embedding account remains unfunded.
- Support drafts work, but actual Zoho Desk email delivery has no complete sender configuration.
- Existing simulated CRM, telephony, calendar and testing connectors remain demonstrations.
- GRC's live assistant answered a synthetic check earlier in this phase. Its sample architecture report rendered; that cached sample is not a fresh vision-analysis test. PDF download completion is unverified. The full original source repository remains inaccessible to the work GitHub account. The local EIDS Auctor design snapshot is incomplete and must not be deployed as GRC.

Resume later from this handoff and `2026-09-16-recovery.md`; verify current deployment IDs and health before changing live services.
