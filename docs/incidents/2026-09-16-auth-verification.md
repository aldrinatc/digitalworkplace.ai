# Production/auth verification and closure — 16 September 2026

Saved at 13:48 UTC / 17:48 Asia/Dubai. Latest request: “Do Savepoint and close all to make sure it’s workable”. Foreground work is paused. The production apps remain live, and all five open project browser tabs were closed. No development server was started in this review.

## Verified production behavior

At **13:45:23 UTC**, all 19 probes in the prepared monitor passed on their first attempt:

| Coverage | Result |
| --- | --- |
| Main `/sign-in` | HTTP 200, expected title |
| Support `/dsq/demo/cor` | HTTP 200, expected title |
| Intranet `/diq/dashboard` | HTTP 200, expected title |
| Chat Core `/dcq/Home/index.html` | HTTP 200, expected title |
| Test Pilot `/dtq/dashboard` | HTTP 200, expected title |
| GRC `/` → `/dashboard` | HTTP 200 after same-origin demo cookie/redirect; expected title |
| Clerk public signing keys | HTTP 200, RSA verification key present |
| Main `/dashboard`, `/admin` without a session | HTTP 404 with Clerk `signed-out` and `protect-rewrite` headers, confirming protected routing |
| Support `/dsq/api/drafts`, anonymous and invalid token | Both JSON 401 |
| Chat Core `/dcq/api/admin/access`, `/documents`, `/log`, `/analytics`, each anonymous and invalid token | All JSON 401 |

The four AI readiness endpoints plus Chat Core and Support database readiness also returned healthy HTTP 200 during this review, with AI gateway/funding available. These readiness checks do not perform generation.

In the existing canonical work-account browser session:

- Main dashboard was reloaded and rendered the owner greeting and all five product cards.
- Support drafts was reloaded and completed session loading, showing the work identity and empty real draft queue without an access error.
- Chat Core content administration was reloaded and completed session loading, rendering its content controls under the owner identity.
- Main admin navigation rendered the owner identity and user totals.

These are **existing-session persistence and access tests**. Fresh sign-in, password/MFA recovery, new-account provisioning, role changes by a non-owner, and every sub-app workflow were not certified. Public demo entry points are intentionally accessible and are not evidence of Clerk authentication.

## Auth issue still outstanding

Main browser console reported `Error updating user: Object` after reload. The production environment listing has Clerk credentials and public Supabase settings but **no `SUPABASE_SERVICE_ROLE_KEY`**. The prepared server-only user/profile/role/analytics repair remains undeployed at implementation commit `d516c4a`.

Migration 021 already closed unsafe browser writes to `public.users`; do not undo that protection. Existing owner sign-in works, but new-user provisioning and browser role/profile writes remain limited until the safe server repair is activated. Specific approval to save the existing service credential in the main Vercel server environment is still unanswered. The separate embedding data-flow opt-in is also pending and was not changed.

No production application code, credentials, database records, roles or billing settings were changed in this auth review. No customer communications were sent. The observed errors were recorded rather than hidden.

## Saved monitoring work

- Separate branch: `codex/site-uptime-monitor`, commit `e71950f`, backed up to the ATC work fork `aldrinatc/digitalworkplace.ai`.
- Worktree: `/private/tmp/dwp-uptime-monitor-20260916`; branch is also retained in the permanent repository's Git history after savepoint synchronization.
- Ten monitor tests passed, covering wrong pages, retry recovery, cookie handling, cross-origin refusal, redirect loops, Clerk denial markers, unauthorized APIs, key discovery, log redaction and bounded concurrency.
- Proposed 15-minute cloud schedule and result artifacts are **not activated on work-fork `main`**. No expanded scheduled cloud run is claimed.
- Existing hourly cloud workflow remains configured. Its scheduled-run query still returned no executions; ordinary CI/manual successes do not prove scheduled execution.
- Existing hourly Codex heartbeat remains ACTIVE. Its prompt was updated at closure to keep healthy-state feature work paused, preserve pending approvals, and only perform authorized outage monitoring/repair.

## Resume safely

Read `SAVEPOINT.md` and the comprehensive recovery savepoint first. Check current branch and deployment state. Keep application changes separate from monitor activation. Resolve the main server credential dependency before deploying the main repair, then verify existing and new users, least-privilege roles, tracking, and admin persistence. Retain the approved gateway refill limits and existing app projects.
