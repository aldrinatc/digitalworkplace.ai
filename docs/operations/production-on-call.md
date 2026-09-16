# Digital Workplace production operations

Updated 2026-09-16. Owner identity: `aldrin@atc.xyz`. Main launcher: https://www.digitalworkplace.ai/dashboard. Preserve all six existing app projects and their independent deployments.

## Monitoring and response

The work-fork default branch contains the active 15-minute GitHub Actions configuration in `.github/workflows/ai-reliability.yml`. It performs 25 read-only probes: six public pages, Clerk key discovery, two protected main routes, ten protected sub-app API checks, four AI readiness checks and two database checks. The first expanded cloud run [35105590721](https://github.com/aldrinatc/digitalworkplace.ai/actions/runs/35105590721) passed all probes at approximately 14:00 UTC on 16 September 2026 and retained its evidence artifact.

The manual cloud run proves execution from GitHub, not execution of the recurring schedule. Verify a run whose event is `schedule` before claiming the scheduler has been observed. GitHub documents that schedules can be delayed, run only from the default branch, and can be disabled after 60 days of inactivity in public repositories. [GitHub scheduling reference](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

The existing Codex heartbeat **Digital Workplace uptime and repairs** is ACTIVE at a 15-minute interval. It checks the sites and cloud-monitor freshness, confirms an apparent failure once, diagnoses incidents, performs authorized targeted repairs, and notifies the owner on meaningful failures or completed repairs. Its prompt treats missing successful cloud health evidence for more than 45 minutes as a monitor fault. It remains quiet when nothing actionable changes. Registration is verified; no execution or notification-delivery guarantee is implied by registration. This local automation depends on host and scheduler availability and is not a staffed 24-hour on-call service.

To run the probes locally:

```sh
node scripts/check-site-auth-health.mjs
node scripts/check-ai-health.mjs
```

To inspect cloud checks or run one manually:

```sh
gh run list --repo aldrinatc/digitalworkplace.ai --workflow ai-reliability.yml --event schedule --limit 5
gh workflow run ai-reliability.yml --repo aldrinatc/digitalworkplace.ai --ref main
```

Manual dispatch and scheduled runs perform health checks only. Pushes and pull requests run regression tests. Health failures preserve a failing job status, and structured results are retained for seven days. No user credentials are stored in the monitor. Its only cookie is GRC's transient public-demo session, held in memory and restricted to the same origin. Reports contain fixed status fields rather than cookies, response bodies or arbitrary exception text.

GitHub notifications depend on the work account's existing Actions notification preferences; delivery has not been independently verified. Codex notifications are attached to the existing task. No new email, SMS, Slack or paging service has been configured.

## Capacity settings verified

Read-only Vercel API checks on 16 September 2026 confirmed the Pro work team and all six independent Next.js projects with Node 24, Fluid Compute, elastic concurrency, and function region `iad1`:

| App | Vercel project | Production host |
| --- | --- | --- |
| Main | digitalworkplace-ai | www.digitalworkplace.ai |
| Support | support-iq | dsq.digitalworkplace.ai |
| Intranet | intranet-iq | diq.digitalworkplace.ai |
| Chat Core | chat-core-iq | dcq.digitalworkplace.ai |
| Test Pilot | test-iq | dtq.digitalworkplace.ai |
| GRC | auctorgrc | auctorgrc.vercel.app |

These are configured platform scaling capabilities, not measured application capacity. [Vercel Fluid Compute](https://vercel.com/docs/fluid-compute) reuses instance capacity and scales with demand. Application bottlenecks and shared-service quotas still apply.

Existing safeguards inspected in the deployed recovery source/configuration:

- Support and Chat Core use the Supabase transaction pooler on port 6543. Their local copies of deployment settings specify `pgbouncer=true`, `connection_limit=2`, and `pool_timeout=10`; this review did not change or re-pull credentials.
- Chat Core reuses its module database client with a maximum of two connections, disabled prepared statements for pooler compatibility, a 10-second connection timeout, a 20-second idle timeout and a 15-second statement timeout.
- Support reuses a module-level Prisma client. Its connection limit is controlled by the pooler URL. Pooling reduces connection churn; the shared database remains a common failure point.
- AI calls use bounded provider timeouts and disable SDK retries to avoid multiplying fallback requests. Generation remains restricted to the approved gateway/OpenAI path with existing fallback behavior.
- Durable Support drafts and Chat Core logs/workflows/appointments use the database rather than relying only on per-instance memory. The cloud durable-workflow tests passed in the recorded run.
- Gateway funding checks expose readiness and low/exhausted state without exposing balances. Existing auto-refill settings remain a $5 trigger, $25 target, and $50/month automatic refill cap. This cap is not a hosting cap or an unlimited-usage guarantee.

A read-only aggregate database snapshot at approximately 14:07 UTC reported 60 configured connections, 12 observed database backends and 52,243,603 bytes of database storage. This includes shared/provider connections and does not establish safe application headroom. No production stress test was performed, and no maximum concurrent-user count is certified. Higher traffic requires a measured load profile, staging/load verification, shared-database/provider quota review, and an explicit spending decision if current limits are inadequate. Do not increase limits, replicate databases, add regions or purchase services merely to claim scalability.

## Incident procedure

1. Identify the failing page/API and timestamp. Retry once; distinguish a real server failure from a missing login, wrong URL, network fault or GRC cookie redirect.
2. Check the last production-health job and its artifact. If the monitor itself is stale, inspect workflow state and dispatch its existing health job without changing app code.
3. For auth failures, verify Clerk key discovery, the public sign-in page, existing-session behavior, and the actual protected API. Main's anonymous 404 is a valid denial only with the Clerk protection headers. Never restore permissive database writes to make auth appear successful.
4. For AI failures, inspect gateway/funding readiness and bounded error logs. Preserve the approved provider/data-flow routes and refill cap; escalate credit limits instead of silently increasing spending.
5. For database failures, check the appropriate least-privileged connection and pooler. Avoid credential dumping, broad database grants or large diagnostic queries. Preserve durable records.
6. For an identified deployment regression, inspect the existing project's deployment history and select the last compatible known-good deployment. Restore only that app, then repeat its health and affected workflow checks. Do not deploy the entire deferred branch or roll back security migration 021.
7. Record the incident, impact, cause, test evidence, deployment/rollback IDs and remaining dependency. Notify on a meaningful state change, not on every routine check.

## Functionality that remains unresolved

Availability and unauthorized-access checks are not end-to-end acceptance tests. Main's new-user provisioning/profile/admin repair remains prepared but undeployed until its server-only Supabase credential is specifically approved and configured. Existing owner sessions work, but profile updates have logged errors. Fresh-account provisioning is not certified.

Intranet's search UI still uses sample data rather than its working keyword-search API. Support customer email delivery still lacks the complete Zoho configuration. GRC's full private source is inaccessible to the work GitHub account, and fresh analysis/PDF export remains unverified. Several integrations and Test Pilot execution remain intentionally simulated. See the main recovery savepoint for exact evidence and next steps; do not report every workflow as fully functional.

The pending embedding opt-in and server credential approval are separate from monitoring activation. Do not activate them or copy credentials merely because the sites are reachable.
