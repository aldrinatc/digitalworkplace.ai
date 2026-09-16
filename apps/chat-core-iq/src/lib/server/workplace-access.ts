import {database} from './database';
export async function hasWorkplaceAdminAccess(clerkId:string,strict=false) {
 const roles=strict?['admin','owner','super_admin']:['admin','owner','super_admin','editor'];
 const rows=await database()`select exists (
   select 1 from public.users u where u.clerk_id=${clerkId}
   and (u.role::text = any(${['admin','super_admin']}::text[]) or exists (
     select 1 from public.user_project_access a join public.projects p on p.id=a.project_id
     where a.user_id=u.id and lower(p.code)='dcq' and a.role=any(${roles}::text[])
   ))
 ) as allowed`;
 return rows[0]?.allowed===true;
}
