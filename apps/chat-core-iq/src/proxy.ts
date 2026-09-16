import {NextRequest,NextResponse} from 'next/server';
import {validateAdminRequest} from './lib/api-auth';

/** Public citizen chat stays public; private admin records require workplace access. */
export async function proxy(request:NextRequest) {
  const path=request.nextUrl.pathname.replace(/^\/dcq(?=\/)/,'');
  const privateRead=/^\/api\/(admin|analytics|audit-logs|escalations|crm|sharepoint|debug-db|debug-knowledge)(\/|$)/.test(path)
    || (request.method==='GET' && ['/api/log','/api/feedback'].includes(path));
  const privateWrite=!['GET','HEAD','OPTIONS'].includes(request.method) && /^\/api\/(settings|banner-settings|announcements|languages|faqs|workflows\/types|workflows\/categories)(\/|$)/.test(path);
  if(privateRead||privateWrite) {
    const error=await validateAdminRequest(request);
    if(error)return error;
  }
  return NextResponse.next();
}
export const config={matcher:['/api/:path*']};
