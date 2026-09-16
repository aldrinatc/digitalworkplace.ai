const apps = { diq: 'intranet', dcq: 'chat-core', dtq: 'test-pilot', dsq: 'support' };
let failed = false;
for (const [prefix, name] of Object.entries(apps)) {
  try {
    const response = await fetch(`https://${prefix}.digitalworkplace.ai/${prefix}/api/health/ai`, { signal: AbortSignal.timeout(15000) });
    const data = await response.json();
    console.log(JSON.stringify({ app: name, http: response.status, ...data }));
    if (!response.ok || data.status !== 'healthy') failed = true;
  } catch { console.error(`${name}: health check failed`); failed = true; }
}
process.exitCode = failed ? 1 : 0;
