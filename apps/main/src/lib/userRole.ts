export type UserRole = 'user' | 'admin' | 'super_admin';

export interface UserData {
  id: string;
  clerk_id: string | null;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

async function workplaceRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/workplace/${path}`, { ...init, cache: 'no-store' });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Workplace request failed');
  return body.data as T;
}

export const getCurrentUser = () => workplaceRequest<UserData | null>('me');
export const syncUserWithClerk = () => workplaceRequest<UserData>('me', { method: 'POST' });
export const getAllUsers = () => workplaceRequest<UserData[]>('users');
export async function updateUserRole(userId: string, role: UserRole): Promise<UserData> {
  return workplaceRequest<UserData>(`users/${encodeURIComponent(userId)}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }),
  });
}
