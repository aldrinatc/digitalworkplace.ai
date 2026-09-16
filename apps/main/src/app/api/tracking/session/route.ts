import { NextRequest, NextResponse } from 'next/server';
import { clerkIdentity, workplaceFailure } from '@/lib/server/workplace';
import { getAdminDatabase } from '@/lib/server/supabase';
import { WorkplaceError } from '@/lib/server/user-store';
import { ownedSession, finishSession } from '@/lib/server/tracking-store';
import { syncCurrentUser } from '@/lib/server/workplace';

export async function POST(request: NextRequest) {
  try {
    const clerkId = await clerkIdentity();
    const body = await request.json();
    if (body.action !== 'start') throw new WorkplaceError(400, 'Invalid action');
    const db = getAdminDatabase();
    // Sync first: tracking and the dashboard otherwise race on a new account.
    const user = await syncCurrentUser();
    const userAgent = request.headers.get('user-agent') || '';
    const device = parseUserAgent(userAgent);
    const { data, error } = await db.from('user_sessions').insert({
      user_id: user.id, clerk_id: clerkId, user_agent: userAgent.slice(0, 2000),
      device_type: device.deviceType, browser: device.browser, os: device.os, is_active: true,
    }).select('id').single();
    if (error) throw error;
    return NextResponse.json({ sessionId: data.id, userId: user.id });
  } catch (error) { return workplaceFailure(error); }
}

export async function PUT(request: NextRequest) {
  try {
    const clerkId = await clerkIdentity();
    const { sessionId, action } = await request.json();
    const db = getAdminDatabase();
    if (action === 'end') await finishSession(db, clerkId, sessionId);
    else if (action === 'heartbeat') {
      const session = await ownedSession(db, clerkId, sessionId);
      if (!session.is_active) throw new WorkplaceError(409, 'Session has ended');
      const { error } = await db.from('user_sessions').update({ last_heartbeat_at: new Date().toISOString() })
        .eq('id', session.id).eq('clerk_id', clerkId);
      if (error) throw error;
    } else throw new WorkplaceError(400, 'Invalid action');
    return NextResponse.json({ success: true });
  } catch (error) { return workplaceFailure(error); }
}

// Helper to parse user agent
function parseUserAgent(ua: string): { deviceType: string; browser: string; os: string } {
  // Device type detection
  let deviceType = 'desktop';
  if (/Mobi|Android/i.test(ua)) {
    deviceType = /iPad|Tablet/i.test(ua) ? 'tablet' : 'mobile';
  }

  // Browser detection
  let browser = 'unknown';
  if (ua.includes('Chrome') && !ua.includes('Edg')) {
    browser = 'Chrome';
  } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
    browser = 'Safari';
  } else if (ua.includes('Firefox')) {
    browser = 'Firefox';
  } else if (ua.includes('Edg')) {
    browser = 'Edge';
  }

  // OS detection
  let os = 'unknown';
  if (ua.includes('Windows')) {
    os = 'Windows';
  } else if (ua.includes('Mac')) {
    os = 'macOS';
  } else if (ua.includes('Linux')) {
    os = 'Linux';
  } else if (ua.includes('Android')) {
    os = 'Android';
  } else if (ua.includes('iPhone') || ua.includes('iPad')) {
    os = 'iOS';
  }

  return { deviceType, browser, os };
}
