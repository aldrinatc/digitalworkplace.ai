import { randomUUID } from 'node:crypto';
import { database, inTransaction } from './database';
interface Entry {title:string; content:string; section:string; url:string; language?:string}
export async function storeDocument(file: {name:string;type:string;content:Buffer}, entries:Entry[]) {
  if (!entries.length || entries.length > 1000) throw new Error('Document has no usable text or is too large');
  return inTransaction(async () => {
    const sql=database(); const id=randomUUID();
    await sql`select pg_advisory_xact_lock(hashtextextended(${`document:${file.name}`},0))`;
    const previous=await sql`select id from dcq.documents where original_name=${file.name} and coalesce(metadata->>'archived','false')='false'`;
    for(const doc of previous) await archiveDocument(doc.id);
    await sql`insert into dcq.documents (id,filename,original_name,mime_type,file_size,chunks,processing_status,extracted_text,metadata,processed_at)
      values (${id},${file.name},${file.name},${file.type},${file.content.length},${entries.length},'completed',${entries.map(e=>e.content).join('\n')},${sql.json({archived:false})},now())`;
    await sql`insert into dcq.document_files (document_id,content) values (${id},${file.content})`;
    for (const entry of entries) {
      await sql`insert into dcq.knowledge_entries (id,title,content,section,url,source_type,language,is_active,metadata)
        values (${randomUUID()},${entry.title},${entry.content},${entry.section},${entry.url},'document_upload',${entry.language || 'en'},true,${sql.json({document_id:id,filename:file.name})})`;
    }
    return id;
  });
}
export async function listDocuments() {
  const rows=await database()`select id,filename,original_name,mime_type,file_size,chunks,uploaded_at from dcq.documents
    where coalesce(metadata->>'archived','false')='false' order by uploaded_at desc limit 1000`;
  return rows.map(r=>({id:r.id,filename:r.filename,originalName:r.original_name,type:r.filename.toLowerCase().endsWith('.pdf')?'pdf':r.filename.toLowerCase().endsWith('.docx')?'docx':'txt',size:r.file_size,chunks:r.chunks,uploadedAt:r.uploaded_at}));
}
export async function archiveDocument(id:string) {
  return inTransaction(async()=>{
    const sql=database();
    const rows=await sql`update dcq.documents set metadata=coalesce(metadata,'{}'::jsonb)||' {"archived":true}'::jsonb where id=${id}::uuid returning id`;
    await sql`update dcq.knowledge_entries set is_active=false,updated_at=now() where source_type='document_upload' and metadata->>'document_id'=${id}`;
    return rows.length>0;
  });
}
export async function searchDocumentEntries(query:string) {
  const rows=await database()`select id,title,content,section,url from dcq.knowledge_entries
    where is_active=true and source_type='document_upload'
      and to_tsvector('simple',coalesce(title,'')||' '||content) @@ plainto_tsquery('simple',${query.slice(0,500)})
    order by ts_rank(to_tsvector('simple',coalesce(title,'')||' '||content),plainto_tsquery('simple',${query.slice(0,500)})) desc limit 10`;
  return rows.map(r=>({id:r.id as string,title:r.title as string,content:r.content as string,section:(r.section||'Documents') as string,url:(r.url||'') as string,summary:(r.content as string).slice(0,300)}));
}
