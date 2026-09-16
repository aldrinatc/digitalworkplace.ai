import { NextResponse } from 'next/server';
import { database } from '@/lib/server/database';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    await database()`select id from dcq.runtime_state limit 0`;
    await database()`select id from dcq.appointments limit 0`;
    return NextResponse.json({ status: 'healthy' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ status: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
