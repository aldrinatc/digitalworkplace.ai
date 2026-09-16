import { NextRequest, NextResponse } from 'next/server';
import { clerkIdentity, workplaceFailure } from '@/lib/server/workplace';
import { getAdminDatabase } from '@/lib/server/supabase';

import { finishSession } from '@/lib/server/tracking-store';

// Same-origin sendBeacon carries the Clerk session cookie; ownership remains mandatory.
export async function POST(request: NextRequest) {
  try {
    const id = await clerkIdentity();
    const body = await request.json();
    await finishSession(getAdminDatabase(), id, body.session_id);
    return NextResponse.json({ success: true });
  } catch (error) { return workplaceFailure(error); }
}
