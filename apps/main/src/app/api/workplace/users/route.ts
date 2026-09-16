import { NextResponse } from 'next/server';
import { clerkIdentity, workplaceFailure } from '@/lib/server/workplace';
import { getAdminDatabase } from '@/lib/server/supabase';
import { requireSuperAdmin, userColumns } from '@/lib/server/user-store';

export async function GET() {
  try {
    const id = await clerkIdentity();
    const db = getAdminDatabase();
    await requireSuperAdmin(db, id);
    const { data, error } = await db.from('users').select(userColumns).order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) { return workplaceFailure(error); }
}
