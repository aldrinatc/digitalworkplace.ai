import type { TestRun, PersonaType } from './types';

const prefix = 'dtq-demo-executions-v1:';
export const demoHistoryEvent = 'dtq-demo-executions-updated';

export function mergeDemoRuns(runs: TestRun[], existing: TestRun[]): TestRun[] {
  return [...new Map([...existing, ...runs].map(run => [run.id, run])).values()]
    .sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime()).slice(0, 100);
}
export function readDemoRuns(persona: PersonaType): TestRun[] {
  if (typeof window === 'undefined') return [];
  try {
    const records = JSON.parse(localStorage.getItem(prefix + persona) || '[]');
    if (!Array.isArray(records)) return [];
    return records.filter(run => typeof run.id === 'string' && typeof run.featureId === 'string' &&
      typeof run.featureName === 'string' && ['passed', 'failed'].includes(run.status) &&
      Number.isFinite(Date.parse(run.executedAt)))
      .map(run => ({ ...run, executedAt: new Date(run.executedAt) })).slice(0, 100);
  } catch { return []; }
}
export function saveDemoRuns(persona: PersonaType, runs: TestRun[]) {
  const merged = mergeDemoRuns(runs, readDemoRuns(persona));
  localStorage.setItem(prefix + persona, JSON.stringify(merged));
  window.dispatchEvent(new Event(demoHistoryEvent));
}
