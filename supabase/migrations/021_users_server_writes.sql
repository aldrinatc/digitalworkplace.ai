-- User identities and global roles are managed only by the verified main server.
-- The former anonymous INSERT policy allowed callers to choose their own role.
BEGIN;
ALTER POLICY "Allow insert for new users" ON public.users TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.users FROM anon, authenticated;
-- Existing runtime roles retain their narrowly scoped role/access reads.
-- No account, role value or user data is modified by this migration.
COMMIT;
