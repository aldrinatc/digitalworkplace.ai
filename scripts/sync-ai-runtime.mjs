import { copyFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
for (const app of ['intranet-iq', 'chat-core-iq', 'test-iq', 'support-iq']) {
  copyFileSync(new URL('packages/ai-runtime/provider.ts', root), new URL(`apps/${app}/src/lib/ai-provider.ts`, root));
}
