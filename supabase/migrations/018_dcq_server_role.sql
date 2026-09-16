-- Least-privilege server connection for Chat Core. Login secret is set separately.
BEGIN;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='dcq_runtime') THEN
    CREATE ROLE dcq_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END $$;
GRANT USAGE ON SCHEMA dcq, public TO dcq_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON dcq.appointment_config, dcq.appointments,
  dcq.workflow_routing, dcq.service_requests, dcq.runtime_state TO dcq_runtime;
GRANT SELECT (id,clerk_id,role) ON public.users TO dcq_runtime;
GRANT SELECT (id,code) ON public.projects TO dcq_runtime;
GRANT SELECT (user_id,project_id,role) ON public.user_project_access TO dcq_runtime;
DO $$ DECLARE tab text; BEGIN
  FOREACH tab IN ARRAY ARRAY['appointment_config','appointments','workflow_routing','service_requests','runtime_state'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='dcq' AND tablename=tab AND policyname='dcq_server_runtime') THEN
      EXECUTE format('CREATE POLICY dcq_server_runtime ON dcq.%I FOR ALL TO dcq_runtime USING (true) WITH CHECK (true)',tab);
    END IF;
  END LOOP;
END $$;
COMMIT;
