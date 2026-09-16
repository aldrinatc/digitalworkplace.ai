/** Verify the shared workplace identity before accessing private administration. */
import { timingSafeEqual } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { NextRequest, NextResponse } from 'next/server';
import { database } from './server/database';

const issuer = 'https://clerk.digitalworkplace.ai';
const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`), {
  timeoutDuration: 5000,
});
const origins = new Set([
  'https://dcq.digitalworkplace.ai',
  'https://www.digitalworkplace.ai',
  'https://digitalworkplace.ai',
  'https://digitalworkplace-ai.vercel.app',
]);
function matchesSecret(actual: string | null, expected: string | undefined) {
  if (!actual || !expected) return false;
  const a = Buffer.from(actual),
    b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export async function validateAdminRequest(
  request: NextRequest,
  strict = false,
): Promise<NextResponse | null> {
  if (
    matchesSecret(
      request.headers.get('x-api-key'),
      process.env.INTERNAL_API_KEY,
    )
  )
    return null;
  const origin = request.headers.get('origin');
  if (
    origin &&
    !origins.has(origin) &&
    !(
      process.env.NODE_ENV !== 'production' &&
      /^http:\/\/localhost:\d+$/.test(origin)
    )
  ) {
    return NextResponse.json(
      { error: 'Untrusted request origin' },
      { status: 403 },
    );
  }
  const token =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    request.cookies.get('__session')?.value;
  if (!token)
    return NextResponse.json(
      { error: 'Sign in to Digital Workplace to manage this app' },
      { status: 401 },
    );
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      algorithms: ['RS256'],
    });
    if (!payload.sub || (payload.azp && !origins.has(String(payload.azp))))
      return NextResponse.json(
        { error: 'Invalid workplace session' },
        { status: 401 },
      );
    const allowed = strict
      ? ['admin', 'owner', 'super_admin']
      : ['admin', 'owner', 'super_admin', 'editor'];
    const rows = await database()`select exists (
      select 1 from public.users u where u.clerk_id=${payload.sub}
        and (u.role = any(${['admin', 'super_admin']}::text[]) or exists (
          select 1 from public.user_project_access a join public.projects p on p.id=a.project_id
          where a.user_id=u.id and lower(p.code)='dcq' and a.role=any(${allowed}::text[])
        ))
    ) as allowed`;
    if (rows[0]?.allowed) return null;
    return NextResponse.json(
      { error: 'Chat Core administrator access is required' },
      { status: 403 },
    );
  } catch {
    return NextResponse.json(
      { error: 'Could not verify the workplace session' },
      { status: 401 },
    );
  }
}
export function validateStrictAdminRequest(request: NextRequest) {
  return validateAdminRequest(request, true);
}
