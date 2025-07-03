-- Simple fix for ElizaOS database schema type mismatch
-- Convert server_agents.server_id from UUID to TEXT to match message_servers.id

BEGIN;

-- Step 1: Drop the existing foreign key constraint if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'server_agents_server_id_fkey'
        AND table_name = 'server_agents'
    ) THEN
        ALTER TABLE server_agents DROP CONSTRAINT server_agents_server_id_fkey;
    END IF;
END
$$;

-- Step 2: Convert server_id column from UUID to TEXT
ALTER TABLE server_agents ALTER COLUMN server_id TYPE TEXT USING server_id::TEXT;

-- Step 3: Add the foreign key constraint with matching types
ALTER TABLE server_agents 
    ADD CONSTRAINT server_agents_server_id_fkey 
    FOREIGN KEY (server_id) REFERENCES message_servers(id) ON DELETE CASCADE;

COMMIT;

\echo 'Schema fix completed successfully!'
\echo 'Verifying table structures:'
\d message_servers
\d server_agents 