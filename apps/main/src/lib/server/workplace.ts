import 'server-only';
import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getAdminDatabase } from './supabase';
import { syncIdentity, WorkplaceError } from './user-store';

export async function clerkIdentity() {
  const { userId } = await auth();
  if (!userId) throw new WorkplaceError(401, 'Sign in to continue');
  return userId;
}

export async function syncCurrentUser() {
  await clerkIdentity();
  const user = await currentUser();
  const email = user?.emailAddresses.find(item => item.id === user.primaryEmailAddressId);
  if (!user || !email) throw new WorkplaceError(403, 'A verified email is required');
  return syncIdentity(getAdminDatabase(), {
    id: user.id, email: email.emailAddress, verified: email.verification?.status === 'verified',
    name: user.fullName, avatar: user.imageUrl,
  });
}

export function workplaceFailure(error: unknown) {
  if (error instanceof WorkplaceError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error('Workplace database request failed');
  return NextResponse.json({ error: 'Workplace data is temporarily unavailable. Please try again.' }, { status: 503 });
}
