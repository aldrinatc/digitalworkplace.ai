# Cloud schedule gap — MON-20260916-01

Status: **OPEN — automatic schedule execution unverified; fallback checks healthy.** Detected by the authorized Codex heartbeat at 14:51 UTC / 18:51 Dubai on 16 September 2026.

## Impact and evidence

No website outage was detected. The local heartbeat passed all 19 site/auth probes on their first attempt at 14:50:05 UTC and all six AI/database checks immediately afterward. Main new-user/profile provisioning remains the previously documented unresolved dependency; these probes do not certify that workflow.

The GitHub schedule-event query returned no runs. At 14:51:10 UTC, the latest successful cloud health run was still `35106177495`, last updated at 14:06:01 UTC, crossing the 45-minute freshness threshold. This is a cloud scheduling/observability fault, distinct from an application outage.

Read-only investigation confirmed:

- Work CLI identity `aldrinatc`; inspected scheduler-related commit author/committer also map to `aldrinatc`.
- Repository default branch `main`, not archived or disabled; Actions enabled and all actions allowed.
- Workflow ID `359513081` is active, and default-branch YAML contains the intended UTC minute 2/17/32/47 schedule and production-health job conditions.
- Public workflow UI showed successful push/manual runs and no disabling banner. The temporary diagnostic tab was closed without changing browser account or settings.
- GitHub's [status summary](https://www.githubstatus.com/api/v2/summary.json) reported Actions operational during investigation. This does not rule out a repository-specific or delayed scheduling fault.

No definite root cause was established. Do not claim that the scheduler is repaired merely because a manual dispatch succeeds.

## Fallback action and verification

Dispatched the existing read-only default-branch health workflow. [Run 35111394084](https://github.com/aldrinatc/digitalworkplace.ai/actions/runs/35111394084) was created at 14:51:32 UTC and completed successfully by 14:51:51 UTC. Its production-health job passed all 25 probes; regression and durable-workflow jobs were correctly skipped for manual dispatch.

Fresh cloud evidence is restored, but the **automatic schedule fault remains open**. The existing 15-minute Codex heartbeat continues to perform direct checks and may refresh cloud evidence when it becomes stale. This fallback depends on the local host/scheduler and is not independent always-on cloud coverage.

No application deployment, database mutation, credential change, security relaxation, spending increase or customer communication occurred. No new automation or monitoring service was created.

## Subsequent checks

1. Check for a real `schedule` event and inspect its production-health job; a push or `workflow_dispatch` event cannot close this incident.
2. Keep direct site/auth/AI/database checks running. Use the existing safe manual cloud check if successful cloud evidence is older than 45 minutes.
3. Track schedule health separately from manual-run freshness. A healthy manual refresh must not erase this open fault.
4. Notify only on a new failure, meaningful diagnostic change, required action or verified automatic-schedule recovery. Do not repeat the same alert on every heartbeat while this incident is unchanged.
5. Preserve the paused feature work and outstanding auth/data-flow approvals.
