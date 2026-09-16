import { runChecks } from './site-auth-health.mjs';

const results = await runChecks();
for (const result of results) console.log(JSON.stringify(result));
console.log(JSON.stringify({ summary: true, checkedAt: new Date().toISOString(), passed: results.filter(result => result.status === 'passed').length, total: results.length, coverage: 'Public pages, Clerk key discovery, and unauthorized access rejection. Does not certify sign-in, new-user provisioning, or all workflows.' }));
process.exitCode = results.some(result => result.status === 'failed') ? 1 : 0;
