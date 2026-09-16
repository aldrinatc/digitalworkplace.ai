import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeDemoRuns, readDemoRuns, saveDemoRuns } from '../apps/test-iq/src/lib/dtq/demo-history';
import type { TestRun } from '../apps/test-iq/src/lib/dtq/types';
const run = (id: string, time: number, passed = 1): TestRun => ({ id, featureId: 'tl-f1', featureName: 'Synthetic test', executedAt: new Date(time), status: 'passed', totalTests: passed, passedTests: passed, failedTests: 0, duration: 1 });

test('explicit executions retain the latest record and deduplicate after remount', () => {
  assert.deepEqual(mergeDemoRuns([run('same', 1000, 2)], [run('same', 0), run('earlier', 1)])
    .map(item => [item.id, item.passedTests]), [['same', 2], ['earlier', 1]]);
});
test('saved demo history is bounded without discarding newest runs', () => {
  const result = mergeDemoRuns(Array.from({length: 120}, (_, i) => run(String(i), i)), []);
  assert.equal(result.length, 100);
  assert.equal(result[0].id, '119');
});
test('stored executions reload as Dates and remain separated by persona', () => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });
  try {
    saveDemoRuns('techlead', [run('saved', 1000)]);
    assert.equal(readDemoRuns('techlead')[0].executedAt.getTime(), 1000);
    assert.equal(readDemoRuns('manager').length, 0);
    saveDemoRuns('techlead', [run('saved', 1000)]);
    assert.equal(readDemoRuns('techlead').length, 1);
  } finally {
    Reflect.deleteProperty(globalThis, 'localStorage'); Reflect.deleteProperty(globalThis, 'window');
  }
});
