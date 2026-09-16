import { NextResponse } from 'next/server';
import { clerkIdentity, syncCurrentUser, workplaceFailure } from '@/lib/server/workplace';
import { getAdminDatabase } from '@/lib/server/supabase';
import { userColumns } from '@/lib/server/user-store';

export async function GET() {
  try {
    const id = await clerkIdentity();
    const { data, error } = await getAdminDatabase().from('users').select(userColumns).eq('clerk_id', id).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) { return workplaceFailure(error); }
}

export async function POST() {
  try { return NextResponse.json({ data: await syncCurrentUser() }); }
  catch (error) { return workplaceFailure(error); }
}
