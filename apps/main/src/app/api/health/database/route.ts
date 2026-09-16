import { NextResponse } from 'next/server';
import { getAdminDatabase } from '@/lib/server/supabase';

export async function GET() {
  try {
    const db = getAdminDatabase();
    await Promise.all(['users', 'user_sessions', 'page_views', 'cross_app_navigation'].map(async (table) => {
      const { error } = await db.from(table).select('id', { head: true }).limit(0);
      if (error) throw error;
    }));
    return NextResponse.json({ status: 'healthy' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ status: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
