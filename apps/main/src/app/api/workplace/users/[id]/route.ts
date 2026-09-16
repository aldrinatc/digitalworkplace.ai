import { NextRequest, NextResponse } from 'next/server';
import { clerkIdentity, workplaceFailure } from '@/lib/server/workplace';
import { getAdminDatabase } from '@/lib/server/supabase';
import { changeRole, WorkplaceError } from '@/lib/server/user-store';

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await clerkIdentity();
    const body = await request.json().catch(() => { throw new WorkplaceError(400, 'Invalid request'); });
    const { id } = await context.params;
    return NextResponse.json({ data: await changeRole(getAdminDatabase(), actor, id, body?.role) });
  } catch (error) { return workplaceFailure(error); }
}
