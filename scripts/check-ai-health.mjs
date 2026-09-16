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
for (const [name, url] of Object.entries({ 'chat-core-database': 'https://dcq.digitalworkplace.ai/dcq/api/health/database', 'support-database': 'https://dsq.digitalworkplace.ai/dsq/api/health' })) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const data = await response.json();
    console.log(JSON.stringify({ app: name, http: response.status, status: data.status }));
    if (!response.ok || data.status !== 'healthy') failed = true;
  } catch { console.error(`${name}: health check failed`); failed = true; }
}
process.exitCode = failed ? 1 : 0;
