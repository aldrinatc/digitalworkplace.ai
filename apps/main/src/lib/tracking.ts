export interface SessionData {
  id: string;
  user_id: string;
  clerk_id: string;
  started_at: string;
  last_heartbeat_at: string;
  is_active: boolean;
  device_type: string;
  browser: string;
  os: string;
}

export interface PageViewData {
  id: string;
  session_id: string;
  user_id: string;
  project_code: string;
  page_path: string;
  page_title: string;
  entered_at: string;
  time_on_page_seconds: number;
}

export interface CrossAppNavigation {
  from_project_code: string;
  from_page_path: string;
  to_project_code: string;
  to_page_path: string;
  navigation_type: 'click' | 'redirect' | 'direct' | 'back';
}

async function trackingRequest(path: string, body: unknown, method = 'POST') {
  const response = await fetch(`/api/tracking/${path}`, {
    method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true,
  });
  if (!response.ok) throw new Error('Tracking request failed');
  return response.json();
}

let currentSessionId: string | null = null;
let currentPageViewId: string | null = null;
let pageEnteredAt = Date.now();
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

export function stopHeartbeat() {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = null;
}
export function setCurrentSessionId(sessionId: string) {
  currentSessionId = sessionId;
  stopHeartbeat();
  heartbeatInterval = setInterval(() => {
    trackingRequest('session', { sessionId, action: 'heartbeat' }, 'PUT').catch(() => stopHeartbeat());
  }, 30000);
}
export async function endSession(sessionId?: string) {
  stopHeartbeat();
  const id = sessionId || currentSessionId;
  currentSessionId = null;
  if (id) await trackingRequest('session', { sessionId: id, action: 'end' }, 'PUT');
}
export async function trackPageView(userId: string, projectCode: string, pagePath: string, pageTitle: string, referrer?: string) {
  if (!currentSessionId) return null;
  const data = await trackingRequest('pageview', { userId, sessionId: currentSessionId, projectCode, pagePath, pageTitle, referrer });
  currentPageViewId = data.pageViewId;
  pageEnteredAt = Date.now();
  return currentPageViewId;
}
export async function endPageView(scrollDepthPercent = 0, clickCount = 0) {
  const pageViewId = currentPageViewId;
  currentPageViewId = null;
  if (!pageViewId) return;
  await trackingRequest('pageview', { pageViewId, scrollDepthPercent, clickCount,
    timeOnPageSeconds: Math.min(86400, Math.floor((Date.now() - pageEnteredAt) / 1000)),
  }, 'PUT');
}
export function setupBeaconTracking(userId: string, sessionId: string) {
  const handleUnload = () => {
    navigator.sendBeacon('/api/tracking/session/end', new Blob([JSON.stringify({ session_id: sessionId })], { type: 'application/json' }));
  };
  window.addEventListener('pagehide', handleUnload);
  return () => window.removeEventListener('pagehide', handleUnload);
}
