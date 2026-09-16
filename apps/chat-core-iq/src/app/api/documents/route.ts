import {NextRequest,NextResponse} from 'next/server';
import {validateStrictAdminRequest,validateAdminRequest} from '@/lib/api-auth';
import {parseDocument,chunkDocument,chunksToKnowledgeBase} from '@/lib/document-parser';
import {storeDocument,listDocuments,archiveDocument} from '@/lib/server/document-store';
export async function POST(request:NextRequest) {
 const authError=await validateStrictAdminRequest(request);if(authError)return authError;
 try {
  const form=await request.formData();const file=form.get('file');
  if(!(file instanceof File)||!file.size) return NextResponse.json({error:'Choose a nonempty PDF, DOCX, or TXT file'},{status:400});
  if(!/\.(pdf|docx|txt)$/i.test(file.name))return NextResponse.json({error:'Supported formats: PDF, DOCX, TXT'},{status:400});
  if(file.size>4*1024*1024)return NextResponse.json({error:'Maximum file size is 4MB'},{status:413});
  const category=String(form.get('category')||'Documents').slice(0,100);
  const baseUrl=String(form.get('baseUrl')||'');
  if(baseUrl&&!/^https?:\/\//.test(baseUrl))return NextResponse.json({error:'Source URL must use http or https'},{status:400});
  const content=Buffer.from(await file.arrayBuffer());const parsed=await parseDocument(content,file.name);
  const entries=chunksToKnowledgeBase(chunkDocument(parsed,file.name,{maxChunkSize:1000,overlap:100}),category,baseUrl);
  const id=await storeDocument({name:file.name,type:file.type,content},entries);
  return NextResponse.json({success:true,id,chunks:entries.length,document:{title:parsed.title,format:parsed.format,pages:parsed.pages,wordCount:parsed.wordCount},message:'Document saved and available to chatbot knowledge search'});
 }catch(error){console.error('[documents]',error instanceof Error?error.name:'failed');return NextResponse.json({error:'Could not parse or save the document. Please retry.'},{status:500});}
}
export async function GET(request:NextRequest) {
 const authError=await validateAdminRequest(request);if(authError)return authError;
 try {const documents=await listDocuments();return NextResponse.json({documents,totalEntries:documents.reduce((n,d)=>n+d.chunks,0)});}catch{return NextResponse.json({error:'Could not load documents'},{status:503});}
}
export async function DELETE(request:NextRequest) {
 const authError=await validateStrictAdminRequest(request);if(authError)return authError;
 const id=request.nextUrl.searchParams.get('id');
 if(!id||!/^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i.test(id))return NextResponse.json({error:'Valid document ID required'},{status:400});
 try{return NextResponse.json({success:await archiveDocument(id)});}catch{return NextResponse.json({error:'Could not archive document'},{status:503});}
}
