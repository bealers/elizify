-- ElizaOS Schema Migration for Existing Databases
-- Fixes the UUID/TEXT type mismatch between server_agents.server_id and message_servers.id

-- Step 1: Drop the problematic foreign key constraint if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'server_agents_server_id_fkey'
        AND table_name = 'server_agents'
    ) THEN
        ALTER TABLE server_agents DROP CONSTRAINT server_agents_server_id_fkey;
        RAISE NOTICE 'Dropped existing foreign key constraint server_agents_server_id_fkey';
    END IF;
END $$;

-- Step 2: Convert server_agents.server_id from UUID to TEXT
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'server_agents' 
        AND column_name = 'server_id' 
        AND data_type = 'uuid'
    ) THEN
        ALTER TABLE server_agents ALTER COLUMN server_id TYPE TEXT USING server_id::TEXT;
        RAISE NOTICE 'Converted server_agents.server_id from UUID to TEXT';
    ELSE
        RAISE NOTICE 'server_agents.server_id is already TEXT type';
    END IF;
END $$;

-- Step 3: Add the foreign key constraint with matching types
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'server_agents_server_id_fkey'
        AND table_name = 'server_agents'
    ) THEN
        ALTER TABLE server_agents 
            ADD CONSTRAINT server_agents_server_id_fkey 
            FOREIGN KEY (server_id) REFERENCES message_servers(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added foreign key constraint with matching TEXT types';
    ELSE
        RAISE NOTICE 'Foreign key constraint already exists';
    END IF;
END $$;

-- Step 4: Verify the fix
DO $$
DECLARE
    server_id_type TEXT;
    message_servers_id_type TEXT;
BEGIN
    -- Get the data types
    SELECT data_type INTO server_id_type
    FROM information_schema.columns 
    WHERE table_name = 'server_agents' AND column_name = 'server_id';
    
    SELECT data_type INTO message_servers_id_type
    FROM information_schema.columns 
    WHERE table_name = 'message_servers' AND column_name = 'id';
    
    RAISE NOTICE 'Schema verification:';
    RAISE NOTICE '  server_agents.server_id type: %', server_id_type;
    RAISE NOTICE '  message_servers.id type: %', message_servers_id_type;
    
    IF server_id_type = message_servers_id_type THEN
        RAISE NOTICE 'SUCCESS: Schema types now match!';
    ELSE
        RAISE NOTICE 'ERROR: Schema types still do not match!';
    END IF;
END $$; 