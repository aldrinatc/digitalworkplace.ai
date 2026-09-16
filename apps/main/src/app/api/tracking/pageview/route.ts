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
    const { data, error } = await db.from('page_views').insert({
      session_id: session.id, user_id: session.user_id,
      project_code: trackingText(body.projectCode, 10, true), page_path: trackingText(body.pagePath, 500, true),
      page_title: trackingText(body.pageTitle, 255), referrer: trackingText(body.referrer, 500),
      referrer_project_code: trackingText(body.referrerProjectCode, 10),
    }).select('id').single();
    if (error) throw error;
    return NextResponse.json({ pageViewId: data.id });
  } catch (error) { return workplaceFailure(error); }
}

export async function PUT(request: NextRequest) {
  try {
    const clerkId = await clerkIdentity();
    const body = await request.json();
    const db = getAdminDatabase();
    const { data: page, error: lookupError } = await db.from('page_views').select('id,session_id')
      .eq('id', trackingText(body.pageViewId, 36, true)).maybeSingle();
    if (lookupError) throw lookupError;
    if (!page) throw new WorkplaceError(404, 'Page view not found');
    await ownedSession(db, clerkId, page.session_id);
    const { error } = await db.from('page_views').update({
      exited_at: new Date().toISOString(), time_on_page_seconds: boundedMetric(body.timeOnPageSeconds, 86400),
      scroll_depth_percent: boundedMetric(body.scrollDepthPercent, 100), click_count: boundedMetric(body.clickCount, 100000),
    }).eq('id', page.id).eq('session_id', page.session_id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) { return workplaceFailure(error); }
}
