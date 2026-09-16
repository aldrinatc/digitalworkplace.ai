import { NextRequest, NextResponse } from 'next/server';
import { clerkIdentity, workplaceFailure } from '@/lib/server/workplace';
import { getAdminDatabase } from '@/lib/server/supabase';
import { WorkplaceError } from '@/lib/server/user-store';
import { ownedSession, boundedMetric, trackingText } from '@/lib/server/tracking-store';

export async function POST(request: NextRequest) {
  try {
    const clerkId = await clerkIdentity();
    const body = await request.json();
    const db = getAdminDatabase();
    const session = await ownedSession(db, clerkId, body.sessionId);
    const type = body.navigation_type || 'click';
    if (!['click', 'redirect', 'direct', 'back'].includes(type)) throw new WorkplaceError(400, 'Invalid navigation type');
    const { error } = await db.from('cross_app_navigation').insert({
      session_id: session.id, user_id: session.user_id,
      from_project_code: trackingText(body.from_project_code, 10, true), to_project_code: trackingText(body.to_project_code, 10, true),
      from_page_path: trackingText(body.from_page_path, 500), to_page_path: trackingText(body.to_page_path, 500),
      navigation_type: type, time_in_source_seconds: boundedMetric(body.time_in_source_seconds, 86400),
    });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) { return workplaceFailure(error); }
}
