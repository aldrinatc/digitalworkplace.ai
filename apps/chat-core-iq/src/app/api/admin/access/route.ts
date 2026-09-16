import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/api-auth';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  return (await validateAdminRequest(request)) || NextResponse.json({ authorized: true }, { headers: { 'Cache-Control': 'no-store' } });
}
