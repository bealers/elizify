-- Fix ElizaOS database schema type mismatch
-- Issue: message_servers.id is TEXT but server_agents.server_id is UUID
-- This prevents the foreign key constraint from being created

BEGIN;

-- First, check if the constraint already exists (avoid errors on re-run)
DO $$
BEGIN
    -- Drop existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'server_agents_server_id_fkey'
        AND table_name = 'server_agents'
    ) THEN
        ALTER TABLE server_agents DROP CONSTRAINT server_agents_server_id_fkey;
    END IF;
END
$$;

-- Convert message_servers.id from TEXT to UUID
-- This is safer than converting server_agents.server_id because:
-- 1. message_servers has fewer rows typically
-- 2. The data is already in UUID format, just stored as text

-- Step 1: Add a new UUID column
ALTER TABLE message_servers ADD COLUMN id_new UUID;

-- Step 2: Convert the text UUID to proper UUID type
UPDATE message_servers SET id_new = id::UUID;

-- Step 3: Update all references to use the new UUID column
-- Update channels table reference
ALTER TABLE channels DROP CONSTRAINT channels_server_id_fkey;
UPDATE channels SET server_id = (
    SELECT id_new FROM message_servers WHERE message_servers.id = channels.server_id
)::TEXT;

-- Step 4: Drop old column and rename new one
ALTER TABLE message_servers DROP COLUMN id;
ALTER TABLE message_servers RENAME COLUMN id_new TO id;

-- Step 5: Add primary key constraint back
ALTER TABLE message_servers ADD PRIMARY KEY (id);

-- Step 6: Recreate foreign key constraints with correct types
ALTER TABLE channels 
    ADD CONSTRAINT channels_server_id_fkey 
    FOREIGN KEY (server_id) REFERENCES message_servers(id) ON DELETE CASCADE;

-- Step 7: Add the missing server_agents foreign key constraint
ALTER TABLE server_agents 
    ADD CONSTRAINT server_agents_server_id_fkey 
    FOREIGN KEY (server_id) REFERENCES message_servers(id) ON DELETE CASCADE;

COMMIT;

-- Verify the fix
\echo 'Schema fix completed. Verifying...'
\d message_servers
\d server_agents 