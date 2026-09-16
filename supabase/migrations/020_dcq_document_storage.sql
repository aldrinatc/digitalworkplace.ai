BEGIN;
CREATE TABLE IF NOT EXISTS dcq.document_files (
 document_id uuid PRIMARY KEY REFERENCES dcq.documents(id),
 content bytea NOT NULL CHECK (octet_length(content)<=4194304),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE dcq.document_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON dcq.document_files FROM anon,authenticated,PUBLIC;
GRANT SELECT,INSERT,UPDATE ON dcq.document_files,dcq.documents,dcq.knowledge_entries TO dcq_runtime;
CREATE POLICY dcq_document_files_runtime ON dcq.document_files TO dcq_runtime USING (true) WITH CHECK (true);
CREATE POLICY dcq_documents_runtime ON dcq.documents TO dcq_runtime USING (true) WITH CHECK (true);
CREATE POLICY dcq_knowledge_runtime ON dcq.knowledge_entries TO dcq_runtime USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS dcq_document_source_idx ON dcq.knowledge_entries ((metadata->>'document_id')) WHERE source_type='document_upload';
COMMIT;
