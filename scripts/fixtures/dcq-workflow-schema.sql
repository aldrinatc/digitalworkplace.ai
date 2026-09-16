-- Isolated test database only; mirrors production column names used by the workflow adapter.
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF; IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF; END $$;
DROP SCHEMA IF EXISTS dcq CASCADE;
CREATE SCHEMA dcq;
CREATE TABLE dcq.appointment_config (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), department varchar NOT NULL,department_id varchar,location varchar,
 available_days integer[] DEFAULT '{1,2,3,4,5}',time_slots jsonb DEFAULT '[]',slot_duration integer DEFAULT 30,
 max_per_slot integer DEFAULT 1,advance_days integer DEFAULT 30,is_active boolean DEFAULT true,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now()
);
CREATE TABLE dcq.appointments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),config_id uuid REFERENCES dcq.appointment_config,conversation_id uuid,
 user_name varchar NOT NULL,user_email varchar,user_phone varchar,appointment_date date NOT NULL,time_slot varchar NOT NULL,
 department varchar,reason text,status varchar DEFAULT 'confirmed',notes text,reminder_sent boolean DEFAULT false,cancelled_at timestamptz,cancellation_reason text,
 created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now()
);
CREATE TABLE dcq.workflow_routing (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),intent_pattern varchar,workflow_type_id uuid,conditions jsonb DEFAULT '{}',priority integer DEFAULT 0,is_active boolean DEFAULT true,created_at timestamptz DEFAULT now()
);
CREATE TABLE dcq.service_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),conversation_id uuid,request_number varchar,category varchar NOT NULL,subcategory varchar,department varchar,
 description text NOT NULL,location text,location_lat numeric,location_lng numeric,priority varchar DEFAULT 'normal',status varchar DEFAULT 'submitted',reporter_name varchar,
 reporter_email varchar,reporter_phone varchar,assigned_to uuid,attachments jsonb DEFAULT '[]',resolution_notes text,submitted_at timestamptz DEFAULT now(),resolved_at timestamptz,
 created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now()
);

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='user_role') THEN CREATE TYPE public.user_role AS ENUM ('user','admin','super_admin'); END IF; END $$;
CREATE TABLE IF NOT EXISTS public.users(id uuid PRIMARY KEY,clerk_id text,role public.user_role,email text);
CREATE TABLE IF NOT EXISTS public.projects(id uuid PRIMARY KEY,code text);
CREATE TABLE IF NOT EXISTS public.user_project_access(user_id uuid,project_id uuid,role text);

CREATE TABLE dcq.documents(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),filename text NOT NULL,original_name text NOT NULL,mime_type text,file_size integer,chunks integer DEFAULT 0,processing_status text,extracted_text text,metadata jsonb DEFAULT '{}',uploaded_at timestamptz DEFAULT now(),processed_at timestamptz);
CREATE TABLE dcq.knowledge_entries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),title text,content text,section text,url text,source_type text,language text,is_active boolean,metadata jsonb DEFAULT '{}',updated_at timestamptz DEFAULT now());
DROP TABLE IF EXISTS public.dsq_draft_versions,public.dsq_drafts,public.dsq_draft_analytics CASCADE;
DROP TYPE IF EXISTS public."DSQDraftStatus",public."DSQDraftPriority",public."DSQDraftEditType" CASCADE;
