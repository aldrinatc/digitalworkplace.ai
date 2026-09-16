# Deployment verification — 16 September 2026

The latest Test Pilot release is `dpl_GMdq5LWkR1ZGaop5qbwpirsL6dfP`, READY on the existing `test-iq` project and aliased to https://dtq.digitalworkplace.ai. Dashboard, history, reports and AI readiness returned HTTP 200 after deployment. Main sign-in also returned HTTP 200.

Test Pilot's build and 17 main/history regression tests passed. Main/Test Pilot lint had zero errors, with 22/8 existing warnings respectively. No main or other sub-app deployment occurred in this resumed phase. The main server repair remains pending its required credential; the users-table permission migration is already live.

This is a bounded verification record, not a percentage score or certification of all features. [The savepoint](docs/incidents/2026-09-16-resume-savepoint.md) records outstanding work and evidence limits.
