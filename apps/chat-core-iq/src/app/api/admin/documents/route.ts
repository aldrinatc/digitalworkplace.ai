import {NextRequest,NextResponse} from 'next/server';
import {validateAdminRequest} from '@/lib/api-auth';
import {listDocuments} from '@/lib/server/document-store';
export {DELETE,POST} from '../../documents/route';
export async function GET(request:NextRequest) {
 const authError=await validateAdminRequest(request);if(authError)return authError;
 try {const documents=await listDocuments();return NextResponse.json({documents,stats:{total:documents.length,pdfs:documents.filter(d=>d.type==='pdf').length,docx:documents.filter(d=>d.type==='docx').length,txt:documents.filter(d=>d.type==='txt').length,totalChunks:documents.reduce((n,d)=>n+d.chunks,0),totalSize:documents.reduce((n,d)=>n+d.size,0)}});}catch{return NextResponse.json({error:'Could not load documents'},{status:503});}
}
