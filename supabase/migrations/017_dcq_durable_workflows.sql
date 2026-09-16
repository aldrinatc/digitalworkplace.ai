-- Additive repair: preserve existing records and keep workflow data private.
BEGIN;
ALTER TABLE dcq.appointment_config
  ADD COLUMN IF NOT EXISTS legacy_id text,
  ADD COLUMN IF NOT EXISTS service_name text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS lead_time_hours integer NOT NULL DEFAULT 24;
CREATE UNIQUE INDEX IF NOT EXISTS dcq_appointment_config_legacy_id ON dcq.appointment_config(legacy_id) WHERE legacy_id IS NOT NULL;
ALTER TABLE dcq.workflow_routing
  ADD COLUMN IF NOT EXISTS legacy_id text,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS keywords text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_department text,
  ADD COLUMN IF NOT EXISTS urgency text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS sla_hours integer NOT NULL DEFAULT 48,
  ADD COLUMN IF NOT EXISTS auto_assign boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS dcq_workflow_routing_legacy_id ON dcq.workflow_routing(legacy_id) WHERE legacy_id IS NOT NULL;
ALTER TABLE dcq.service_requests ADD COLUMN IF NOT EXISTS sla_hours integer NOT NULL DEFAULT 48;
CREATE TABLE IF NOT EXISTS dcq.runtime_state (
  namespace text NOT NULL,
  id text NOT NULL,
  data jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(namespace, id)
);
CREATE INDEX IF NOT EXISTS dcq_runtime_state_expiry ON dcq.runtime_state(expires_at);
ALTER TABLE dcq.runtime_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON dcq.runtime_state FROM anon, authenticated;
COMMENT ON TABLE dcq.runtime_state IS 'Server-only workflow and channel sessions. No browser/PostgREST access.';
COMMIT;
