/**
 * Conversation State Management
 *
 * Tracks multi-step workflow state for chat sessions.
 * Stores state in memory with session ID mapping.
 */

import { Language } from './i18n';
import { AsyncLocalStorage } from 'node:async_hooks';
import { database, inTransaction, pruneExpiredState } from './server/database';

// This map is scoped to one locked database transaction, never shared across requests.
const stateContext = new AsyncLocalStorage<Map<string, ConversationState>>();
function states() {
  const store = stateContext.getStore();
  if (!store) throw new Error('Workflow operation requires a durable session');
  return store;
}

export async function withConversationState<T>(sessionId: string, action: () => Promise<T>): Promise<T> {
  if (!sessionId || sessionId.length > 200) throw new Error('Invalid session identifier');
  return inTransaction(async () => {
    const sql = database();
    await pruneExpiredState();
    await sql`select pg_advisory_xact_lock(hashtextextended(${`workflow:${sessionId}`}, 0))`;
    const rows = await sql`select data from dcq.runtime_state where namespace='workflow' and id=${sessionId} and expires_at > now()`;
    const store = new Map<string, ConversationState>();
    if (rows.length) store.set(sessionId, rows[0].data as ConversationState);
    return stateContext.run(store, async () => {
      const result = await action();
      const state = store.get(sessionId);
      if (state) {
        await sql`insert into dcq.runtime_state (namespace,id,data,expires_at) values ('workflow',${sessionId},${sql.json(state as unknown as Record<string, never>)},now()+interval '30 minutes')
          on conflict(namespace,id) do update set data=excluded.data,expires_at=excluded.expires_at,updated_at=now()`;
      } else {
        await sql`delete from dcq.runtime_state where namespace='workflow' and id=${sessionId}`;
      }
      return result;
    });
  });
}

// State cleanup interval (5 minutes)
const STATE_TTL_MS = 30 * 60 * 1000;

export type WorkflowType = 'appointment' | 'service-request' | null;

export interface AppointmentWorkflowData {
  selectedServiceId?: string;
  selectedServiceName?: string;
  selectedDate?: string;
  selectedTime?: string;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
}

export interface ServiceRequestWorkflowData extends Record<string, unknown> {
  category?: string;
  department?: string;
  description?: string;
  location?: string;
  priority?: 'low' | 'medium' | 'high';
  routingRuleId?: string;
}

export interface ConversationState {
  sessionId: string;
  activeWorkflow: WorkflowType;
  workflowStep: number;
  workflowData: AppointmentWorkflowData | ServiceRequestWorkflowData | Record<string, unknown>;
  lastUpdated: number;
  language: Language;
}

/**
 * Create a new conversation state
 */
export function createState(sessionId: string, language: Language = 'en'): ConversationState {
  const state: ConversationState = {
    sessionId,
    activeWorkflow: null,
    workflowStep: 0,
    workflowData: {},
    lastUpdated: Date.now(),
    language
  };

  states().set(sessionId, state);
  return state;
}

/**
 * Get conversation state by session ID
 */
export function getState(sessionId: string): ConversationState | null {
  const state = states().get(sessionId);

  if (!state) {
    return null;
  }

  // Check if state is expired
  if (Date.now() - state.lastUpdated > STATE_TTL_MS) {
    states().delete(sessionId);
    return null;
  }

  return state;
}

/**
 * Get or create conversation state
 */
export function getOrCreateState(sessionId: string, language: Language = 'en'): ConversationState {
  let state = getState(sessionId);

  if (!state) {
    state = createState(sessionId, language);
  }

  return state;
}

/**
 * Update conversation state
 */
export function updateState(
  sessionId: string,
  updates: Partial<Omit<ConversationState, 'sessionId' | 'lastUpdated'>>
): ConversationState | null {
  const state = getState(sessionId);

  if (!state) {
    return null;
  }

  // Merge updates
  Object.assign(state, updates, { lastUpdated: Date.now() });
  states().set(sessionId, state);

  return state;
}

/**
 * Start a new workflow
 */
export function startWorkflow(
  sessionId: string,
  workflowType: 'appointment' | 'service-request',
  initialData: Record<string, unknown> = {}
): ConversationState {
  const state = getOrCreateState(sessionId);

  state.activeWorkflow = workflowType;
  state.workflowStep = 1;
  state.workflowData = initialData;
  state.lastUpdated = Date.now();

  states().set(sessionId, state);
  return state;
}

/**
 * Advance to next workflow step
 */
export function advanceWorkflow(
  sessionId: string,
  dataUpdates: Record<string, unknown> = {}
): ConversationState | null {
  const state = getState(sessionId);

  if (!state || !state.activeWorkflow) {
    return null;
  }

  state.workflowStep += 1;
  state.workflowData = { ...state.workflowData, ...dataUpdates };
  state.lastUpdated = Date.now();

  states().set(sessionId, state);
  return state;
}

/**
 * Clear active workflow (cancel or complete)
 */
export function clearWorkflow(sessionId: string): ConversationState | null {
  const state = getState(sessionId);

  if (!state) {
    return null;
  }

  state.activeWorkflow = null;
  state.workflowStep = 0;
  state.workflowData = {};
  state.lastUpdated = Date.now();

  states().set(sessionId, state);
  return state;
}

/**
 * Delete session state entirely
 */
export function deleteState(sessionId: string): boolean {
  return states().delete(sessionId);
}

/**
 * Check if user is in an active workflow
 */
export function isInWorkflow(sessionId: string): boolean {
  const state = getState(sessionId);
  return Boolean(state?.activeWorkflow);
}

/**
 * Get current workflow type
 */
export function getWorkflowType(sessionId: string): WorkflowType {
  const state = getState(sessionId);
  return state?.activeWorkflow || null;
}

/**
 * Get current workflow step
 */
export function getWorkflowStep(sessionId: string): number {
  const state = getState(sessionId);
  return state?.workflowStep || 0;
}

/**
 * Get workflow data
 */
export function getWorkflowData<T extends Record<string, unknown>>(sessionId: string): T | null {
  const state = getState(sessionId);
  return state?.workflowData as T | null;
}

/**
 * Set language preference
 */
export function setLanguage(sessionId: string, language: Language): void {
  const state = getOrCreateState(sessionId, language);
  state.language = language;
  state.lastUpdated = Date.now();
  states().set(sessionId, state);
}

/**
 * Get language preference
 */
export function getLanguage(sessionId: string): Language {
  const state = getState(sessionId);
  return state?.language || 'en';
}

/**
 * Cleanup expired states (call periodically)
 */
export function cleanupExpiredStates(): number {
  let cleaned = 0;
  const now = Date.now();

  for (const [sessionId, state] of states().entries()) {
    if (now - state.lastUpdated > STATE_TTL_MS) {
      states().delete(sessionId);
      cleaned++;
    }
  }

  return cleaned;
}


/**
 * Export state store size for monitoring
 */
export function getStateCount(): number {
  return states().size;
}

/**
 * Appointment workflow steps
 */
export const APPOINTMENT_STEPS = {
  SELECT_SERVICE: 1,
  SELECT_DATE: 2,
  SELECT_TIME: 3,
  COLLECT_INFO: 4,
  CONFIRM: 5
} as const;

/**
 * Service request workflow steps
 */
export const SERVICE_REQUEST_STEPS = {
  COLLECT_DETAILS: 1,
  COLLECT_LOCATION: 2,
  CONFIRM: 3
} as const;

/**
 * Get step name for appointment workflow
 */
export function getAppointmentStepName(step: number): string {
  const stepNames: Record<number, string> = {
    1: 'select-service',
    2: 'select-date',
    3: 'select-time',
    4: 'collect-info',
    5: 'confirm'
  };
  return stepNames[step] || 'unknown';
}

/**
 * Get step name for service request workflow
 */
export function getServiceRequestStepName(step: number): string {
  const stepNames: Record<number, string> = {
    1: 'collect-details',
    2: 'collect-location',
    3: 'confirm'
  };
  return stepNames[step] || 'unknown';
}
