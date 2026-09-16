'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BaseModal from './modals/BaseModal';
import { saveDemoRuns } from '@/lib/dtq/demo-history';
import { Terminal } from 'lucide-react';
import { ExecutionConfig, TestRun } from '@/lib/dtq/types';
import { useExecutionSimulation } from '@/hooks/useExecutionSimulation';
import FeatureSelectionPanel, { TECH_LEAD_FEATURES } from './execution/FeatureSelectionPanel';
import ConfigurationBar from './execution/ConfigurationBar';
import ActionButtons from './execution/ActionButtons';
import ExecutionStatusPanel from './execution/ExecutionStatusPanel';

type DemoJob = {
  id: string;
  featureIds: string[];
  config: ExecutionConfig;
  scheduledAt: number;
};
const queueKey = 'dtq-simulation-queue-v1';

interface TechLeadExecutionConsoleProps {
  onTestRunsGenerated?: (runs: TestRun[]) => void;
}

export default function TechLeadExecutionConsole({ onTestRunsGenerated }: TechLeadExecutionConsoleProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(TECH_LEAD_FEATURES.slice(0, 6).map((f) => f.id))
  );
  const [config, setConfig] = useState<ExecutionConfig>({
    environment: 'staging',
    browser: 'chromium',
    parallelInstances: 5,
  });

  const {
    phase,
    featureStates,
    consoleLogs,
    overallProgress,
    passCount,
    failCount,
    activeSlots,
    elapsedSeconds,
    execute,
    reset,
    generatedRuns,
  } = useExecutionSimulation();

  const [jobs, setJobs] = useState<DemoJob[]>([]);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduledTime, setScheduledTime] = useState('');
  const [queueMessage, setQueueMessage] = useState('');
  const [historyError, setHistoryError] = useState('');
  const handledRuns = useRef<string | null>(null);
  const activeJob = useRef<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem(queueKey) || '[]');
      if (Array.isArray(stored)) queueMicrotask(() => setJobs(stored.filter(job =>
        typeof job.id === 'string' && Array.isArray(job.featureIds) &&
        job.featureIds.length > 0 && job.featureIds.every((id: string) => TECH_LEAD_FEATURES.some(f => f.id === id)) &&
        Number.isFinite(job.scheduledAt) && job.config &&
        Number.isInteger(job.config.parallelInstances) && job.config.parallelInstances >= 1 && job.config.parallelInstances <= 20
      ).slice(0, 20)));
    } catch { /* Ignore invalid saved demo state. */ }
  }, []);

  const updateQueue = useCallback((next: DemoJob[]) => {
    try {
      sessionStorage.setItem(queueKey, JSON.stringify(next));
      setJobs(next);
      return true;
    } catch { setQueueMessage('Browser storage is unavailable; the queue could not be saved.'); return false; }
  }, []);

  const enqueue = (scheduledAt: number) => {
    if (jobs.length >= 20) { setQueueMessage('The queue is full. Remove a job before adding another.'); return; }
    if (!Number.isFinite(scheduledAt) || scheduledAt < Date.now() - 1000) {
      setQueueMessage('Choose a future date and time.'); return;
    }
    if (!updateQueue([...jobs, { id: crypto.randomUUID(), featureIds: [...selectedIds], config: { ...config }, scheduledAt }])) return;
    setQueueMessage('Simulation saved. Keep this dashboard open to run it; overdue jobs resume when you return.');
    setScheduleOpen(false);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      if (phase === 'running' || activeJob.current) return;
      const next = [...jobs].sort((a, b) => a.scheduledAt - b.scheduledAt).find(job => job.scheduledAt <= Date.now());
      if (!next) return;
      activeJob.current = next.id;
      setActiveJobId(next.id);
      execute(TECH_LEAD_FEATURES.filter(feature => next.featureIds.includes(feature.id)), next.config);
    }, 1000);
    return () => clearInterval(timer);
  }, [jobs, execute, phase]);

  // Notify parent when execution completes with generated runs
  useEffect(() => {
    if (!generatedRuns.length || handledRuns.current === generatedRuns[0].id) return;
    handledRuns.current = generatedRuns[0].id;
    queueMicrotask(() => {
    try {
      saveDemoRuns('techlead', generatedRuns);
      setHistoryError('');
    } catch { setHistoryError('Simulation finished, but browser storage is full. Results are available until you leave this page.'); }
    onTestRunsGenerated?.(generatedRuns);
    if (activeJob.current) {
      updateQueue(jobs.filter(job => job.id !== activeJob.current));
      activeJob.current = null;
      setActiveJobId(null);
    }
    });
  }, [generatedRuns, onTestRunsGenerated, jobs, updateQueue]);

  const handleToggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(TECH_LEAD_FEATURES.map((f) => f.id)));
  }, []);

  const handleClearAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleExecute = useCallback(() => {
    const selected = TECH_LEAD_FEATURES.filter((f) => selectedIds.has(f.id));
    execute(selected, config);
  }, [selectedIds, config, execute]);

  const isRunning = phase === 'running';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="card overflow-hidden"
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-4 border-b"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(34, 211, 238, 0.15)' }}
        >
          <Terminal className="w-4 h-4" style={{ color: 'var(--chart-secondary)' }} />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            Simulate Regression Tests
          </h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Synthetic test execution. Results are saved in this browser for the Tech Lead reports.
          </p>
        </div>
        <ActionButtons
          phase={phase}
          selectedCount={selectedIds.size}
          onExecute={handleExecute}
          onReset={reset}
          onQueue={() => enqueue(Date.now())}
          onSchedule={() => { setQueueMessage(''); setScheduleOpen(true); }}
        />
      </div>

      {historyError && <p role="alert" className="px-5 py-3 text-sm" style={{ color: 'var(--status-error)' }}>{historyError}</p>}
      {queueMessage && <p role="status" className="px-5 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{queueMessage}</p>}
      {jobs.length > 0 && <section aria-label="Simulation queue" className="px-5 py-3 space-y-2">
        <h3 className="text-sm font-semibold">Simulation queue ({jobs.length})</h3>
        {jobs.map(job => <div key={job.id} className="flex items-center justify-between gap-3 text-xs">
          <span>{job.featureIds.length} features · {new Date(job.scheduledAt).toLocaleString()}{activeJobId === job.id ? ' · running' : ''}</span>
          <button disabled={activeJobId === job.id} className="underline disabled:opacity-40" onClick={() => updateQueue(jobs.filter(item => item.id !== job.id))}>Remove</button>
        </div>)}
      </section>}
      <BaseModal isOpen={scheduleOpen} onClose={() => setScheduleOpen(false)} title="Schedule simulation"
        description="Runs while this dashboard is open. Saved jobs resume when you return to this tab.">
        <form className="p-5 space-y-4" onSubmit={event => { event.preventDefault(); enqueue(new Date(scheduledTime).getTime()); }}>
          <label className="block text-sm">Start time (your local time)
            <input required aria-label="Simulation start time" type="datetime-local" value={scheduledTime} onChange={event => setScheduledTime(event.target.value)}
              className="block w-full mt-2 rounded-lg border p-3" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', borderColor: 'var(--border-subtle)' }} />
          </label>
          {queueMessage && <p role="alert" className="text-sm" style={{ color: 'var(--status-error)' }}>{queueMessage}</p>}
          <button type="submit" className="rounded-lg px-4 py-2 text-sm" style={{ background: 'var(--accent-primary)', color: 'white' }}>Save schedule</button>
        </form>
      </BaseModal>
      {/* Body */}
      <div className="p-5 space-y-5">
        {/* Feature Selection + Configuration (shown when not running) */}
        <AnimatePresence mode="wait">
          {phase !== 'running' && phase !== 'complete' && (
            <motion.div
              key="config"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <FeatureSelectionPanel
                selectedIds={selectedIds}
                onToggle={handleToggle}
                onSelectAll={handleSelectAll}
                onClearAll={handleClearAll}
                disabled={isRunning}
              />
              <div
                className="pt-4 border-t"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <ConfigurationBar
                  config={config}
                  onChange={setConfig}
                  disabled={isRunning}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Execution Status (shown when running or complete) */}
        <AnimatePresence>
          {(phase === 'running' || phase === 'complete') && (
            <ExecutionStatusPanel
              phase={phase}
              featureStates={featureStates}
              consoleLogs={consoleLogs}
              overallProgress={overallProgress}
              passCount={passCount}
              failCount={failCount}
              activeSlots={activeSlots}
              parallelInstances={config.parallelInstances}
              elapsedSeconds={elapsedSeconds}
            />
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
