"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { usePathname } from 'next/navigation';
import {
  endSession,
  endPageView,
  setupBeaconTracking,
  setCurrentSessionId,
  trackPageView,
  stopHeartbeat,
  CrossAppNavigation,
} from '@/lib/tracking';

interface UseTrackingOptions {
  projectCode: string;
  enabled?: boolean;
}

interface TrackingState {
  sessionId: string | null;
  userId: string | null;
  isTracking: boolean;
}


export function useTracking({ projectCode, enabled = true }: UseTrackingOptions) {
  const { user, isLoaded } = useUser();
  const pathname = usePathname();
  const clerkId = user?.id;
  // Use useState for values returned to components (must not access ref during render)
  const [trackingState, setTrackingState] = useState<TrackingState>({
    sessionId: null,
    userId: null,
    isTracking: false,
  });
  // Use refs for internal state that doesn't need to trigger re-renders
  const stateRef = useRef<TrackingState>(trackingState);
  const lastPathRef = useRef<string | null>(null);
  const scrollDepthRef = useRef<number>(0);
  const clickCountRef = useRef<number>(0);

  // Keep ref in sync with state
  useEffect(() => {
    stateRef.current = trackingState;
  }, [trackingState]);

  // Track scroll depth
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent = docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 0;
      scrollDepthRef.current = Math.max(scrollDepthRef.current, scrollPercent);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [enabled]);

  // Track clicks
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const handleClick = () => {
      clickCountRef.current++;
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [enabled]);

  // Initialize session
  useEffect(() => {
    if (!enabled || !isLoaded || !clerkId) return;

    let cancelled = false;
    let removeBeacon: (() => void) | undefined;
    const initSession = async () => {
      // Get user ID from Supabase
      const response = await fetch('/api/tracking/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          clerkId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (cancelled) {
          if (data.sessionId) await endSession(data.sessionId);
          return;
        }
        if (data.sessionId && data.userId) {
          setCurrentSessionId(data.sessionId);
          const newState = {
            sessionId: data.sessionId,
            userId: data.userId,
            isTracking: true,
          };
          stateRef.current = newState;
          setTrackingState(newState);

          removeBeacon = setupBeaconTracking(data.userId, data.sessionId);
        }
      }
    };

    initSession().catch(() => console.warn('Workplace tracking is temporarily unavailable'));

    // Cleanup on unmount
    return () => {
      cancelled = true;
      removeBeacon?.();
      stopHeartbeat();
      if (stateRef.current.sessionId) {
        void endPageView(scrollDepthRef.current, clickCountRef.current).catch(() => {});
      }
    };
  }, [enabled, isLoaded, clerkId]);

  // Track page views on pathname change
  useEffect(() => {
    if (!enabled || !stateRef.current.isTracking || !pathname) return;
    if (pathname === lastPathRef.current) return;

    const trackView = async () => {
      // End previous page view
      if (lastPathRef.current && stateRef.current.userId) {
        await endPageView(scrollDepthRef.current, clickCountRef.current);
      }

      // Reset metrics for new page
      scrollDepthRef.current = 0;
      clickCountRef.current = 0;

      // Track new page view
      if (stateRef.current.userId) {
        await trackPageView(stateRef.current.userId, projectCode, pathname, document.title,
          lastPathRef.current ? `${projectCode}:${lastPathRef.current}` : document.referrer);
      }

      lastPathRef.current = pathname;
    };

    trackView().catch(() => console.warn('Page tracking is temporarily unavailable'));
  }, [enabled, pathname, projectCode, trackingState.isTracking]);

  // Manual navigation tracking function
  const trackNavigation = useCallback(async (navigation: Omit<CrossAppNavigation, 'from_project_code' | 'from_page_path'>) => {
    if (!enabled || !stateRef.current.userId) return;

    await fetch('/api/tracking/navigation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: stateRef.current.userId,
        sessionId: stateRef.current.sessionId,
        from_project_code: projectCode,
        from_page_path: pathname,
        ...navigation,
      }),
    });
  }, [enabled, projectCode, pathname]);

  // End session function
  const endCurrentSession = useCallback(async () => {
    if (!stateRef.current.sessionId) return;

    await endPageView(scrollDepthRef.current, clickCountRef.current);
    await endSession(stateRef.current.sessionId);

    const newState = { sessionId: null, userId: null, isTracking: false };
    stateRef.current = newState;
    setTrackingState(newState);
  }, []);

  return {
    sessionId: trackingState.sessionId,
    userId: trackingState.userId,
    isTracking: trackingState.isTracking,
    trackNavigation,
    endSession: endCurrentSession,
  };
}
